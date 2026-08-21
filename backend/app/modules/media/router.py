"""
Review media upload (spec §19, §29, §45, §46).

Everything here is untrusted public input — this is the highest-risk endpoint
in the application. The validation chain, in order, and none of it optional:

  1. Authentication, then **ownership of the target review**
  2. Per-review quota (images and video counted separately)
  3. Declared MIME against the allow-list
  4. Byte size against the configured cap
  5. **Actual decode** — images through Pillow, video through a container
     parse. The declared type is a claim, not evidence.
  6. **Video duration ≤ 30s, measured from the container header** (spec §29).
     Not from a form field the client filled in.
  7. Images are re-encoded from raw pixels, stripping EXIF (GPS, camera serial)
     and discarding anything appended after the image data
  8. Stored under `{user_id}/{review_id}/{random}` — never the uploaded
     filename, and the storage RLS policy pins the first path segment to
     `auth.uid()`, so one user cannot write into another's folder

Frontend validation is a convenience and nothing more.
"""

from __future__ import annotations

import io
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError

# Lives on PIL.Image, not on the package root, and subclasses Exception
# directly — which is exactly why it slipped past the OSError/ValueError clause.
from PIL.Image import DecompressionBombError
from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, owns_or_admin
from app.core.limiter import WRITE, limiter
from app.core.storage import remove, sign_url, upload
from app.core.video import UnknownDuration, probe_duration
from app.models import Review, ReviewMedia
from app.schemas.product import MediaOut

router = APIRouter()

MAX_EDGE = 1600  # review photos need less resolution than product shots
PILLOW_FORMAT = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
VIDEO_EXT = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}


async def _load_own_review(db: DbSession, review_id: uuid.UUID, user) -> Review:
    review = await db.get(Review, review_id)
    # 404 rather than 403 on someone else's review: whether it exists is not
    # information this endpoint should confirm.
    if review is None or not owns_or_admin(review.user_id, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    return review


@router.post("/review", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
# The most expensive endpoint on the public surface: it accepts up to 50 MB,
# decodes it, and re-encodes it. Metered tighter than a read for that reason
# alone, quite apart from abuse.
@limiter.limit(WRITE)
async def upload_review_media(
    request: Request,
    user: CurrentUser,
    db: DbSession,
    review_id: Annotated[uuid.UUID, Form()],
    file: Annotated[UploadFile, File()],
) -> MediaOut:
    """Attach one image or short video to your own review."""
    review = await _load_own_review(db, review_id, user)

    declared = (file.content_type or "").lower()
    is_image = declared in settings.ALLOWED_IMAGE_MIME
    is_video = declared in settings.ALLOWED_VIDEO_MIME

    if not (is_image or is_video):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Only JPEG, PNG, WebP images or MP4, MOV, WebM video.",
        )

    # --- quota, counted per kind (spec §29) ---
    kind = "image" if is_image else "video"
    used = (
        await db.execute(
            select(func.count())
            .select_from(ReviewMedia)
            .where(ReviewMedia.review_id == review_id, ReviewMedia.kind == kind)
        )
    ).scalar_one()
    limit = settings.MAX_REVIEW_IMAGES if is_image else settings.MAX_REVIEW_VIDEOS
    if used >= limit:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Limit reached: {limit} {kind}{'s' if limit != 1 else ''} per review.",
        )

    # --- size, read with a hard ceiling so a huge upload cannot exhaust memory ---
    cap = settings.MAX_IMAGE_BYTES if is_image else settings.MAX_VIDEO_BYTES
    raw = await file.read(cap + 1)
    if len(raw) > cap:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds {cap // (1024 * 1024)} MB",
        )
    if not raw:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty file")

    if is_image:
        media, signed = await _store_image(db, review, user, raw, declared)
    else:
        media, signed = await _store_video(db, review, user, raw, declared)

    await db.flush()

    return MediaOut(
        id=media.id,
        kind=media.kind,  # type: ignore[arg-type]
        url=signed or "",
        width=media.width,
        height=media.height,
        duration_seconds=media.duration_seconds,
        display_order=media.display_order,
    )


async def _next_order(db: DbSession, review_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.coalesce(func.max(ReviewMedia.display_order), -1) + 1).where(
                ReviewMedia.review_id == review_id
            )
        )
    ).scalar_one()


async def _store_image(db: DbSession, review: Review, user, raw: bytes, declared: str):
    # --- decode: the claim must survive contact with a real parser ---
    try:
        Image.open(io.BytesIO(raw)).verify()
        img = Image.open(io.BytesIO(raw))  # reopen — verify() leaves it unusable
        img.load()
    except DecompressionBombError:
        # A decompression bomb: a few KB of file that declares enormous
        # dimensions and expands to gigabytes of pixels on decode. Pillow
        # raises this from `Exception`, NOT from OSError or ValueError, so it
        # slipped past the clause below and surfaced as an uncaught 500 —
        # which is a crash report for us and an unexplained failure for the
        # uploader. It is a rejected file, and it says so.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "That image declares dimensions far too large to process.",
        ) from None
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "That file is not a readable image."
        )

    # --- re-encode from pixels: drops EXIF and any appended payload ---
    fmt = PILLOW_FORMAT.get(declared, "JPEG")
    if fmt == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    buf = io.BytesIO()
    kwargs = {"optimize": True}
    if fmt in ("JPEG", "WEBP"):
        kwargs["quality"] = 85
    img.save(buf, format=fmt, **kwargs)
    clean = buf.getvalue()

    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]
    # First segment is the uploader's uid — the storage RLS policy pins it to
    # auth.uid(), so this path cannot be redirected into someone else's folder.
    path = f"{user.id}/{review.id}/{uuid.uuid4().hex}.{ext}"

    if not await upload("review-media", path, clean, declared):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Storage upload failed")

    media = ReviewMedia(
        review_id=review.id,
        kind="image",
        storage_path=path,
        mime_type=declared,
        size_bytes=len(clean),
        width=img.width,
        height=img.height,
        moderation_status="pending",
        display_order=await _next_order(db, review.id),
    )
    db.add(media)
    return media, await sign_url("review-media", path)


async def _store_video(db: DbSession, review: Review, user, raw: bytes, declared: str):
    """Video path. The duration check is the whole point of this function."""
    try:
        info = probe_duration(raw)
    except UnknownDuration as exc:
        # Fails CLOSED. "We could not read the length" must never resolve to
        # "the length is probably fine" on an endpoint enforcing a length cap.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Could not read the video length, so it cannot be accepted ({exc}).",
        )

    limit = settings.MAX_REVIEW_VIDEO_SECONDS
    # Half a second of slack: containers round, and a genuine 30.0s recording
    # sometimes reports 30.02. Rejecting that would be indistinguishable from
    # a bug to the person uploading it.
    if info.duration_seconds > limit + 0.5:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Video is {info.duration_seconds:.1f}s — the limit is {limit}s. Trim it and try again.",
        )

    # Video is stored as uploaded: re-encoding needs ffmpeg, and the container
    # parse above has already established it is a real, short video. It is
    # served from a private bucket via short-lived signed URLs, on a separate
    # origin, and held as `pending` until a moderator approves it.
    ext = VIDEO_EXT.get(declared, "mp4")
    path = f"{user.id}/{review.id}/{uuid.uuid4().hex}.{ext}"

    if not await upload("review-media", path, raw, declared):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Storage upload failed")

    media = ReviewMedia(
        review_id=review.id,
        kind="video",
        storage_path=path,
        mime_type=declared,
        size_bytes=len(raw),
        # Rounded up, then CLAMPED to the limit.
        #
        # The 0.5s tolerance above accepts a 30.2s clip, but rounding that up
        # gives 31, which the `review_media_video_max_30s` CHECK constraint
        # rejects — the request would 500 after the file had already been
        # written to storage. Clamping keeps the two layers in agreement.
        duration_seconds=min(max(1, int(info.duration_seconds + 0.999)), limit),
        moderation_status="pending",
        display_order=await _next_order(db, review.id),
    )
    db.add(media)
    return media, await sign_url("review-media", path)


@router.delete("/review/{media_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_review_media(media_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    """Ownership verified server-side before the object leaves storage."""
    media = await db.get(ReviewMedia, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    review = await db.get(Review, media.review_id)
    if review is None or not owns_or_admin(review.user_id, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    await remove("review-media", [media.storage_path])
    await db.execute(delete(ReviewMedia).where(ReviewMedia.id == media_id))
