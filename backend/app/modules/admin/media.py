"""
Product media upload (spec §19, §45, §46).

Every uploaded file is untrusted, even from an admin — an admin account is a
compromise target, and a malicious image that executes in the app's origin
would be worse coming from a trusted uploader, not better.

The validation chain, in order:

  1. Declared MIME against the allow-list
  2. Byte size against the configured cap
  3. **Actual decode with Pillow** — the declared type is a claim, not evidence.
     A file that will not decode as an image is not an image, whatever its
     extension or Content-Type says. This is stronger than a magic-byte check,
     because it rejects truncated and malformed files too.
  4. Re-encode from raw pixels, which **strips EXIF** (GPS, camera serial) and
     discards any appended payload after the image data.
  5. Store under a random key — never the user's filename, which could carry
     path traversal or a double extension.

Files land in a PRIVATE bucket and are served only through signed URLs, so a
draft product's imagery is not reachable before publication (spec §38).

-------------------------------------------------------------------------------
ONE FILE, MANY PRODUCTS

An object in the bucket is **not owned by a product**. Several `product_media`
rows may point at the same `storage_path`, which is how the same photograph can
appear on a product and on the accessory that ships with it without being
stored twice. Two things create that state:

  * an upload whose bytes hash to a digest we already hold (step 6 below), and
  * `POST /media/product/{id}/attach`, which points a new row at an existing
    object chosen from the media library.

The rule that makes this safe lives in `delete_product_image`: the storage
object is removed **only when the row being deleted is the last one
referencing it**. Every other read path — signing, the product page, the
library — needs to know nothing about any of this, because a shared object is
still just a path in a column.
"""

from __future__ import annotations

import hashlib
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, Body, File, Form, HTTPException, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError

# Lives on PIL.Image, not on the package root, and subclasses Exception
# directly — which is exactly why it slipped past the OSError/ValueError clause.
from PIL.Image import DecompressionBombError
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select

from app.core import audit
from app.core.config import settings
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.storage import remove, sign_url, upload
from app.models import Product, ProductMedia
from app.schemas.product import MediaOut

router = APIRouter()


class Strict(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class AttachIn(Strict):
    """Point this product at an object the library already holds."""

    media_id: uuid.UUID


# Largest dimension we keep. Beyond this adds bytes without adding usable
# detail on a product page, and caps the memory a decode can consume.
MAX_EDGE = 2400
PILLOW_FORMAT = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


@router.post(
    "/media/product/{product_id}",
    response_model=MediaOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_product_image(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    file: Annotated[UploadFile, File()],
    alt: Annotated[str | None, Form()] = None,
) -> MediaOut:
    """Upload one product image.

    Position is appended; reorder afterwards with
    `PUT /admin/products/{id}/media/order`, where index 0 becomes the primary.
    """
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    # --- 1. declared MIME ---
    declared = (file.content_type or "").lower()
    if declared not in settings.ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported type. Allowed: {', '.join(settings.ALLOWED_IMAGE_MIME)}",
        )

    # --- 2. size, read with a hard ceiling ---
    raw = await file.read(settings.MAX_IMAGE_BYTES + 1)
    if len(raw) > settings.MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image exceeds {settings.MAX_IMAGE_BYTES // (1024 * 1024)} MB",
        )
    if not raw:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty file")

    # --- 3. decode: the claim must survive contact with a real parser ---
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()  # structural check; consumes the object
        img = Image.open(io.BytesIO(raw))  # reopen — verify() leaves it unusable
        img.load()
    except DecompressionBombError:
        # Raised from `Exception`, not OSError/ValueError, so it was not caught
        # by the clause below and became an uncaught 500. Same rejection as any
        # other unusable file — an admin account is a compromise target, and
        # "the uploader is trusted" is not a reason to decode a bomb.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "That image declares dimensions far too large to process.",
        ) from None
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "That file is not a readable image.",
        )

    # --- 4. re-encode from pixels: drops EXIF and any appended payload ---
    fmt = PILLOW_FORMAT.get(declared, "JPEG")
    if fmt == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    buf = io.BytesIO()
    save_kwargs = {"optimize": True}
    if fmt in ("JPEG", "WEBP"):
        save_kwargs["quality"] = 88
    # A fresh Image object is written out — nothing from the original container
    # survives except the decoded pixels.
    img.save(buf, format=fmt, **save_kwargs)
    clean = buf.getvalue()

    # --- 5. content-addressed key; the uploaded filename is never used ---
    #
    # The digest is taken over `clean`, the bytes we are about to store, not
    # over `raw`. That is the whole basis of de-duplication here: two people
    # uploading the same photograph will almost never send byte-identical
    # files (different EXIF, different container padding), but they decode to
    # the same pixels and therefore re-encode to the same object.
    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]
    digest = hashlib.sha256(clean).hexdigest()
    path = f"shared/{digest}.{ext}"

    # --- 6. do we already hold these exact bytes? ---
    #
    # If so, skip the upload entirely and point this row at the existing
    # object. The bucket keeps one copy however many products use it, and the
    # library shows one tile rather than N identical ones.
    #
    # Matched on `checksum`, not on `path`, so an object stored under the old
    # per-product key scheme (`{product_id}/{uuid}.ext`) is reused in place
    # once it has been hashed rather than being rewritten to a new key.
    existing_path = (
        await db.execute(
            select(ProductMedia.storage_path)
            .where(
                ProductMedia.checksum == digest,
                ProductMedia.storage_path.is_not(None),
            )
            .limit(1)
        )
    ).scalar_one_or_none()

    if existing_path:
        path = existing_path
    else:
        ok = await upload("product-media", path, clean, declared)
        if not ok:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Storage upload failed")

    next_order = (
        await db.execute(
            select(func.coalesce(func.max(ProductMedia.display_order), -1) + 1).where(
                ProductMedia.product_id == product_id
            )
        )
    ).scalar_one()

    media = ProductMedia(
        product_id=product_id,
        kind="image",
        storage_path=path,
        checksum=digest,
        alt=(alt or "").strip()[:300] or None,
        mime_type=declared,
        size_bytes=len(clean),
        width=img.width,
        height=img.height,
        display_order=next_order,
    )
    db.add(media)
    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.media.upload",
        entity_type="product",
        entity_id=product_id,
        summary=f"Uploaded image to “{product.title}”",
        meta={
            "bytes": len(clean),
            "original_bytes": len(raw),
            "dimensions": f"{img.width}x{img.height}",
            # Worth recording: it says the bucket did not grow, and it is the
            # only trace that this upload was a duplicate of something.
            "deduplicated": bool(existing_path),
        },
        ip_address=client_ip(request),
    )

    signed = await sign_url("product-media", path)
    return MediaOut(
        id=media.id,
        kind="image",
        url=signed or "",
        alt=media.alt,
        width=media.width,
        height=media.height,
        display_order=media.display_order,
    )


@router.post(
    "/media/product/{product_id}/attach",
    response_model=MediaOut,
    status_code=status.HTTP_201_CREATED,
)
async def attach_existing_image(
    product_id: uuid.UUID,
    payload: Annotated[AttachIn, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> MediaOut:
    """Attach an image the library already holds to this product.

    Nothing is uploaded and nothing is copied. A new `product_media` row is
    written pointing at the *same* object, which is why this is the answer to
    "we keep re-uploading the same photo": the bucket does not grow at all.

    Only images. A linked video is not an object in our bucket — it is a
    provider and an id — and re-linking one is `POST /products/{id}/videos`,
    which already exists and already does the right validation.
    """
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    source = await db.get(ProductMedia, payload.media_id)
    if source is None or source.kind != "image" or not source.storage_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That image is not in the library")

    # Attaching the same object twice to one product would put two identical
    # tiles in the manager and make "which one is primary" a coin toss.
    already = (
        await db.execute(
            select(ProductMedia.id).where(
                ProductMedia.product_id == product_id,
                ProductMedia.storage_path == source.storage_path,
            )
        )
    ).first()
    if already:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That image is already on this product."
        )

    next_order = (
        await db.execute(
            select(func.coalesce(func.max(ProductMedia.display_order), -1) + 1).where(
                ProductMedia.product_id == product_id
            )
        )
    ).scalar_one()

    media = ProductMedia(
        product_id=product_id,
        kind="image",
        storage_path=source.storage_path,
        checksum=source.checksum,
        # Alt text describes the picture, not the product, so it travels with
        # the object. It stays editable per product.
        alt=source.alt,
        mime_type=source.mime_type,
        size_bytes=source.size_bytes,
        width=source.width,
        height=source.height,
        display_order=next_order,
    )
    db.add(media)
    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.media.attach",
        entity_type="product",
        entity_id=product_id,
        summary=f"Attached a library image to “{product.title}”",
        meta={"storage_path": source.storage_path, "source_media_id": str(source.id)},
        ip_address=client_ip(request),
    )

    signed = await sign_url("product-media", source.storage_path)
    return MediaOut(
        id=media.id,
        kind="image",
        url=signed or "",
        alt=media.alt,
        width=media.width,
        height=media.height,
        display_order=media.display_order,
    )


@router.delete(
    "/media/product/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_product_image(
    media_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Detach an image from its product, and delete the file if nothing else
    still points at it.

    **This is reference-counted, and it has to be.** Since an object can be
    shared between products (see the module docstring), the old behaviour —
    unconditionally removing the file — would delete a photograph out from
    under every other product using it, leaving them with rows whose signed
    URLs 404. The count is taken over `storage_path` rather than `checksum`
    because the path is what `remove()` acts on, and rows written before
    hashing existed have no checksum to count.

    The row is deleted first here, and the ordering is deliberate: it makes
    the count below include only rows that genuinely survive this request, so
    "am I the last one?" is answered by the database rather than by arithmetic.
    An orphaned row is a cosmetic problem; a deleted file that other products
    still reference is data loss.
    """
    media = await db.get(ProductMedia, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    product_id = media.product_id
    path = media.storage_path

    await db.execute(delete(ProductMedia).where(ProductMedia.id == media_id))
    await db.flush()

    shared_with = 0
    if path:
        shared_with = (
            await db.execute(
                select(func.count())
                .select_from(ProductMedia)
                .where(ProductMedia.storage_path == path)
            )
        ).scalar_one()

        if shared_with == 0:
            await remove("product-media", [path])

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.media.delete",
        entity_type="product",
        entity_id=product_id,
        summary=(
            "Deleted a product image"
            if shared_with == 0
            else f"Detached an image still used by {shared_with} other product(s)"
        ),
        meta={"storage_path": path, "file_removed": shared_with == 0},
        ip_address=client_ip(request),
    )
