"""
Community reviews (spec §28–§31).

Authentication is enforced here, server-side. Hiding the review button in the
frontend is explicitly not sufficient (spec §27), and Row Level Security
enforces ownership at the database as well.

Nothing a user writes reaches the public site unmoderated: reviews are created
`pending`, and editing one returns it to `pending` so approved content cannot
be swapped out afterwards.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, owns_or_admin
from app.core.limiter import WRITE, limiter
from app.core.storage import sign_many
from app.models import Product, Review, ReviewMedia, ReviewReport
from app.modules.products.repository import ProductRepository
from app.schemas.common import MAX_PAGE, Page
from app.schemas.product import MediaOut
from app.schemas.review import ReviewOut

router = APIRouter()

REPORT_REASONS = {
    "spam",
    "fake",
    "offensive",
    "irrelevant",
    "promotional",
    "inappropriate_media",
}


class Strict(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class ReviewCreate(Strict):
    product_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=200)
    # Matches the CHECK constraint on the table, so validation fails here with
    # a readable message rather than as a database error.
    body: str = Field(min_length=20, max_length=5000)


class ReviewUpdate(Strict):
    rating: int | None = Field(default=None, ge=1, le=5)
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, min_length=20, max_length=5000)


class ReportRequest(Strict):
    reason: str
    detail: str | None = Field(default=None, max_length=1000)


def _owns_path(review: Review, storage_path: str | None) -> bool:
    """Does this media row point inside its own author's storage folder?

    Objects are written as `{user_id}/{review_id}/{file}` by the upload handler
    and the storage RLS policy pins the first segment to `auth.uid()`. But the
    *database row* naming the object is a separate thing from the object, and
    `sign_many` below signs with the service-role key — which is exempt from
    storage RLS by design.

    So a row whose `storage_path` points at another user's folder would have
    been signed and served. The RLS `with check` added in migration
    20260821000011 stops such a row being written; this stops one that already
    exists, or one written by any future path that forgets, from being read.
    Two independent checks, because the consequence of missing it is one user
    reading another's private media.
    """
    if not storage_path:
        return False
    return storage_path.startswith(f"{review.user_id}/")


async def _to_out(db: DbSession, reviews: list[Review], include_pending_media: bool) -> list[ReviewOut]:
    """Map to the wire type, signing media URLs in one batch."""
    paths = [
        m.storage_path
        for r in reviews
        for m in r.media
        if (include_pending_media or m.moderation_status == "approved")
        and _owns_path(r, m.storage_path)
    ]
    urls = await sign_many("review-media", paths) if paths else {}

    out: list[ReviewOut] = []
    for r in reviews:
        media = [
            MediaOut(
                id=m.id,
                kind=m.kind,  # type: ignore[arg-type]
                url=urls.get(m.storage_path, ""),
                width=m.width,
                height=m.height,
                duration_seconds=m.duration_seconds,
                display_order=m.display_order,
            )
            for m in sorted(r.media, key=lambda x: x.display_order)
            if (include_pending_media or m.moderation_status == "approved")
            # Dropped rather than rendered with an empty URL: a row pointing
            # outside its author's folder is not a broken image, it is a row
            # that should not exist, and showing a placeholder for it would
            # make the anomaly look like an ordinary storage hiccup.
            and _owns_path(r, m.storage_path)
        ]
        out.append(
            ReviewOut(
                id=r.id,
                product_id=r.product_id,
                author={
                    "id": r.user.id if r.user else uuid.UUID(int=0),
                    "display_name": r.user.display_name if r.user else "Anonymous",
                    "avatar_url": r.user.avatar_url if r.user else None,
                },  # type: ignore[arg-type]
                rating=r.rating,
                title=r.title,
                body=r.body,
                media=media,
                status=r.status,  # type: ignore[arg-type]
                is_featured=r.is_featured,
                helpful_count=r.helpful_count,
                created_at=r.created_at,
            )
        )
    return out


@router.get("/product/{product_id}", response_model=Page[ReviewOut])
async def list_reviews(
    product_id: uuid.UUID,
    db: DbSession,
    response: Response,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> Page[ReviewOut]:
    """Approved reviews only; featured first (spec §30).

    Media is filtered to `approved` as well — a review can be published while
    one of its photos is still pending.
    """
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}"
    )

    base = select(Review).where(Review.product_id == product_id, Review.status == "approved")
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows = list(
        (
            await db.execute(
                base.options(selectinload(Review.user), selectinload(Review.media))
                .order_by(Review.is_featured.desc(), Review.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .unique()
        .scalars()
        .all()
    )

    return Page(
        items=await _to_out(db, rows, include_pending_media=False),
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + len(rows) < total,
    )


@router.get("/mine", response_model=Page[ReviewOut])
async def my_reviews(
    user: CurrentUser,
    db: DbSession,
    response: Response,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> Page[ReviewOut]:
    """Your own reviews, in every state — so you can see what is still pending."""
    response.headers["Cache-Control"] = "no-store, private"

    base = select(Review).where(Review.user_id == user.id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows = list(
        (
            await db.execute(
                base.options(selectinload(Review.user), selectinload(Review.media))
                .order_by(Review.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .unique()
        .scalars()
        .all()
    )

    return Page(
        items=await _to_out(db, rows, include_pending_media=True),
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + len(rows) < total,
    )


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(WRITE)
async def create_review(
    request: Request,
    payload: Annotated[ReviewCreate, Body()],
    user: CurrentUser,
    db: DbSession,
) -> ReviewOut:
    """Create a review. Always lands in `pending` (spec §30).

    `status` and `is_featured` are set here, never read from the payload —
    `extra="forbid"` means a request trying to send them is rejected outright.
    """
    product = (
        await db.execute(
            select(Product).where(
                Product.id == payload.product_id, Product.status == "published"
            )
        )
    ).scalar_one_or_none()
    if product is None:
        # 404 for a draft too: its existence is not public information.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    review = Review(
        product_id=payload.product_id,
        user_id=user.id,
        rating=payload.rating,
        title=(payload.title or "").strip() or None,
        body=payload.body.strip(),
        status="pending",
        is_featured=False,
    )
    db.add(review)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # The unique constraint is the source of truth — a check-then-insert
        # would race two concurrent submissions.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You have already reviewed this product. Edit your existing review instead.",
        )

    await db.refresh(review, ["user", "media"])
    return (await _to_out(db, [review], include_pending_media=True))[0]


@router.patch("/{review_id}", response_model=ReviewOut)
@limiter.limit(WRITE)
async def update_review(
    request: Request,
    review_id: uuid.UUID,
    payload: Annotated[ReviewUpdate, Body()],
    user: CurrentUser,
    db: DbSession,
) -> ReviewOut:
    """Edit your own review.

    Returns it to `pending`: otherwise an approved review could be edited into
    something that would never have passed moderation.
    """
    review = await db.get(Review, review_id)
    if review is None or not owns_or_admin(review.user_id, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if not data:
        await db.refresh(review, ["user", "media"])
        return (await _to_out(db, [review], include_pending_media=True))[0]

    if "rating" in data:
        review.rating = data["rating"]
    if "title" in data:
        review.title = (data["title"] or "").strip() or None
    if "body" in data:
        review.body = data["body"].strip()

    was_approved = review.status == "approved"
    review.status = "pending"
    review.moderated_at = None
    review.moderated_by = None
    await db.flush()

    # It was live and now is not — recompute so the product's rating does not
    # keep counting a review that is no longer published.
    if was_approved:
        await ProductRepository(db).recompute_rating(review.product_id)

    await db.refresh(review, ["user", "media"])
    return (await _to_out(db, [review], include_pending_media=True))[0]


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_review(review_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    """Delete your own review. 404 on someone else's — existence is not confirmed."""
    review = await db.get(Review, review_id)
    if review is None or not owns_or_admin(review.user_id, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    product_id = review.product_id
    media = (
        await db.execute(select(ReviewMedia).where(ReviewMedia.review_id == review_id))
    ).scalars().all()

    if media:
        from app.core.storage import remove

        await remove("review-media", [m.storage_path for m in media])

    await db.delete(review)  # media rows cascade
    await db.flush()
    await ProductRepository(db).recompute_rating(product_id)


@router.post("/{review_id}/report", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(WRITE)
async def report_review(
    request: Request,
    review_id: uuid.UUID,
    payload: Annotated[ReportRequest, Body()],
    user: CurrentUser,
    db: DbSession,
) -> dict:
    """Report a review for moderation (spec §30).

    Always returns 202, including for a duplicate report — telling someone
    "you already reported this" leaks that their earlier report exists, and
    the outcome is identical either way.
    """
    if payload.reason not in REPORT_REASONS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Reason must be one of: {', '.join(sorted(REPORT_REASONS))}",
        )

    review = await db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    db.add(
        ReviewReport(
            review_id=review_id,
            reporter_id=user.id,
            reason=payload.reason,
            detail=(payload.detail or "").strip() or None,
        )
    )

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return {"accepted": True}

    # Flag it for a moderator, but leave an approved review visible until a
    # human decides — otherwise a single report becomes a censorship button.
    if review.status == "approved":
        open_reports = (
            await db.execute(
                select(func.count())
                .select_from(ReviewReport)
                .where(ReviewReport.review_id == review_id, ReviewReport.resolved.is_(False))
            )
        ).scalar_one()
        if open_reports >= 3:
            review.status = "reported"
            review.moderated_at = datetime.now(timezone.utc)
            await db.flush()

    return {"accepted": True}
