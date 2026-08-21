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
"""

from __future__ import annotations

import io
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import delete, func, select

from app.core import audit
from app.core.config import settings
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.storage import remove, sign_url, upload
from app.models import Product, ProductMedia
from app.schemas.product import MediaOut

router = APIRouter()

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

    # --- 5. random key; the uploaded filename is never used ---
    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]
    path = f"{product_id}/{uuid.uuid4().hex}.{ext}"

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
        meta={"bytes": len(clean), "original_bytes": len(raw), "dimensions": f"{img.width}x{img.height}"},
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


@router.delete(
    "/media/product/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_product_image(
    media_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Remove an image from the product and from storage.

    The storage object goes first: an orphaned row is a cosmetic problem, an
    orphaned file that is still reachable by signed URL is not.
    """
    media = await db.get(ProductMedia, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    product_id = media.product_id
    await remove("product-media", [media.storage_path])
    await db.execute(delete(ProductMedia).where(ProductMedia.id == media_id))

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.media.delete",
        entity_type="product",
        entity_id=product_id,
        summary="Deleted a product image",
        ip_address=client_ip(request),
    )
