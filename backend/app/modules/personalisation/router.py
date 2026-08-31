"""
User personalisation: saved products, preferences, helpful votes.

Every route here is scoped to `user.id` taken from the **verified token**. No
endpoint accepts a user id in its path or body, so there is no parameter to
tamper with — the classic IDOR shape simply does not exist on this surface.
Row Level Security enforces the same rule at the database.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Body, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.models import (
    Product,
    ProductBadge,
    Review,
    ReviewHelpfulVote,
    SavedProduct,
    UserPreferences,
)
from app.modules.products.service import sign_for, to_summary
from app.schemas.common import MAX_PAGE, Page
from app.schemas.product import ProductSummaryOut

router = APIRouter()

MAX_CATEGORIES = 12
MAX_BRANDS = 20


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StrictWire(Wire):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


def _private(response: Response) -> None:
    """Personalisation is per-user and must never be cached by a shared proxy —
    a cached shortlist served to the next visitor would be a data leak."""
    response.headers["Cache-Control"] = "no-store, private"


# ====================================================================== #
# Saved products                                                          #
# ====================================================================== #


class SaveRequest(StrictWire):
    product_id: uuid.UUID
    note: Optional[str] = Field(default=None, max_length=280)


class SavedItemOut(Wire):
    id: uuid.UUID
    product: ProductSummaryOut
    note: Optional[str] = None
    created_at: str


@router.get("/saved", response_model=Page[SavedItemOut])
async def list_saved(
    user: CurrentUser,
    db: DbSession,
    response: Response,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 24,
) -> Page[SavedItemOut]:
    """The caller's shortlist. Scoped by token — there is no user id parameter."""
    _private(response)

    total = (
        await db.execute(
            select(func.count()).select_from(SavedProduct).where(SavedProduct.user_id == user.id)
        )
    ).scalar_one()

    rows = (
        (
            await db.execute(
                select(SavedProduct)
                .where(SavedProduct.user_id == user.id)
                .options(
                    selectinload(SavedProduct.product).selectinload(Product.brand),
                    selectinload(SavedProduct.product).selectinload(Product.category),
                    selectinload(SavedProduct.product).selectinload(Product.media),
                    selectinload(SavedProduct.product).selectinload(Product.score),
                    selectinload(SavedProduct.product)
                    .selectinload(Product.badge_links)
                    .selectinload(ProductBadge.badge),
                )
                .order_by(SavedProduct.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .unique()
        .scalars()
        .all()
    )

    # A saved product may since have been unpublished. Keep it in the list —
    # the user chose to save it — but the product page will 404, so the UI
    # marks it unavailable rather than pretending it vanished.
    products = [r.product for r in rows]
    urls = await sign_for(products)

    return Page(
        items=[
            SavedItemOut(
                id=r.id,
                product=to_summary(r.product, urls),
                note=r.note,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page - 1) * page_size + len(rows) < total,
    )


@router.post("/saved", status_code=status.HTTP_201_CREATED)
async def save_product(
    payload: Annotated[SaveRequest, Body()], user: CurrentUser, db: DbSession, response: Response
) -> dict:
    """Add to the shortlist. Idempotent — saving twice is not an error.

    ON CONFLICT DO NOTHING rather than a check-then-insert, so two rapid taps
    cannot race into a constraint violation.
    """
    _private(response)

    exists = (
        await db.execute(
            select(Product.id).where(Product.id == payload.product_id, Product.status == "published")
        )
    ).scalar_one_or_none()
    if exists is None:
        # 404 for an unpublished product too: its existence is not public.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    await db.execute(
        pg_insert(SavedProduct)
        .values(user_id=user.id, product_id=payload.product_id, note=payload.note)
        .on_conflict_do_nothing(index_elements=["user_id", "product_id"])
    )
    return {"saved": True}


@router.delete("/saved/{product_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def unsave_product(product_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    """Remove from the shortlist.

    The WHERE clause carries `user_id` from the token, so passing someone
    else's product id deletes nothing rather than deleting their row.
    """
    await db.execute(
        delete(SavedProduct).where(
            SavedProduct.user_id == user.id, SavedProduct.product_id == product_id
        )
    )


@router.get("/saved/ids", response_model=list[uuid.UUID])
async def saved_ids(user: CurrentUser, db: DbSession, response: Response) -> list[uuid.UUID]:
    """Just the ids, so a grid can render save-state without N queries."""
    _private(response)
    rows = (
        await db.execute(select(SavedProduct.product_id).where(SavedProduct.user_id == user.id))
    ).scalars().all()
    return list(rows)


# ====================================================================== #
# Preferences                                                             #
# ====================================================================== #


class PreferencesOut(Wire):
    category_ids: list[uuid.UUID] = Field(default_factory=list)
    brand_ids: list[uuid.UUID] = Field(default_factory=list)
    budget_min: Optional[Decimal] = None
    budget_max: Optional[Decimal] = None
    use_case: Optional[str] = None
    notify_price_drops: bool = False
    notify_new_picks: bool = False


class PreferencesUpdate(StrictWire):
    category_ids: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_CATEGORIES)
    brand_ids: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_BRANDS)
    budget_min: Optional[Decimal] = Field(default=None, ge=0)
    budget_max: Optional[Decimal] = Field(default=None, ge=0)
    use_case: Optional[str] = Field(default=None, max_length=1000)
    # Opt-in, never opt-out: both default False and must be set deliberately.
    notify_price_drops: bool = False
    notify_new_picks: bool = False


@router.get("/preferences", response_model=PreferencesOut)
async def get_preferences(user: CurrentUser, db: DbSession, response: Response) -> PreferencesOut:
    _private(response)
    prefs = (
        await db.execute(select(UserPreferences).where(UserPreferences.user_id == user.id))
    ).scalar_one_or_none()

    if prefs is None:
        return PreferencesOut()

    return PreferencesOut(
        category_ids=[uuid.UUID(c) for c in prefs.category_ids],
        brand_ids=[uuid.UUID(b) for b in prefs.brand_ids],
        budget_min=prefs.budget_min,
        budget_max=prefs.budget_max,
        use_case=prefs.use_case,
        notify_price_drops=prefs.notify_price_drops,
        notify_new_picks=prefs.notify_new_picks,
    )


@router.put("/preferences", response_model=PreferencesOut)
async def update_preferences(
    payload: Annotated[PreferencesUpdate, Body()],
    user: CurrentUser,
    db: DbSession,
    response: Response,
) -> PreferencesOut:
    """Replace the caller's preferences.

    Upsert keyed on the token's user id — there is no way to write another
    user's row, because the key never comes from the request.
    """
    _private(response)

    if payload.budget_min and payload.budget_max and payload.budget_min > payload.budget_max:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Budget range is inverted")

    values = {
        "user_id": user.id,
        "category_ids": [str(c) for c in payload.category_ids],
        "brand_ids": [str(b) for b in payload.brand_ids],
        "budget_min": payload.budget_min,
        "budget_max": payload.budget_max,
        "use_case": payload.use_case.strip() if payload.use_case else None,
        "notify_price_drops": payload.notify_price_drops,
        "notify_new_picks": payload.notify_new_picks,
    }

    await db.execute(
        pg_insert(UserPreferences)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["user_id"], set_={k: v for k, v in values.items() if k != "user_id"}
        )
    )

    return PreferencesOut(**{**values, "category_ids": payload.category_ids, "brand_ids": payload.brand_ids})  # type: ignore[arg-type]


@router.get("/for-you", response_model=list[ProductSummaryOut])
async def for_you(
    user: CurrentUser,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=24)] = 8,
) -> list[ProductSummaryOut]:
    """Products matching the caller's stated interests.

    An honest first pass: filter by chosen categories/brands and budget, order
    by our score. No behavioural tracking, no inferred profile — it recommends
    from what the person explicitly told us, which is the only input we have
    and the only one we have consent for.
    """
    _private(response)

    prefs = (
        await db.execute(select(UserPreferences).where(UserPreferences.user_id == user.id))
    ).scalar_one_or_none()

    from app.modules.products.repository import ProductRepository
    from app.schemas.common import PageParams

    repo = ProductRepository(db)

    if prefs is None or (not prefs.category_ids and not prefs.brand_ids):
        # No stated interests: fall back to the highest-scoring products
        # overall rather than showing an empty shelf.
        items, _ = await repo.list_published(page=PageParams(page=1, page_size=limit))
        urls = await sign_for(items)
        return [to_summary(p, urls) for p in items]

    stmt = select(Product).where(Product.status == "published")
    if prefs.category_ids:
        stmt = stmt.where(Product.category_id.in_([uuid.UUID(c) for c in prefs.category_ids]))
    if prefs.brand_ids:
        stmt = stmt.where(Product.brand_id.in_([uuid.UUID(b) for b in prefs.brand_ids]))
    if prefs.budget_min is not None:
        stmt = stmt.where(Product.price_current >= prefs.budget_min)
    if prefs.budget_max is not None:
        stmt = stmt.where(Product.price_current <= prefs.budget_max)

    stmt = stmt.options(
        selectinload(Product.brand),
        selectinload(Product.category),
        selectinload(Product.media),
        selectinload(Product.score),
        selectinload(Product.badge_links).selectinload(ProductBadge.badge),
    ).limit(limit)

    rows = list((await db.execute(stmt)).unique().scalars().all())
    rows.sort(key=lambda p: float(p.score.overall) if p.score else 0.0, reverse=True)

    urls = await sign_for(rows)
    return [to_summary(p, urls) for p in rows]


# ====================================================================== #
# Helpful votes                                                           #
# ====================================================================== #


@router.get("/reviews/helpful-ids", response_model=list[uuid.UUID])
async def helpful_ids(
    product_id: Annotated[uuid.UUID, Query(alias="productId")],
    user: CurrentUser,
    db: DbSession,
    response: Response,
) -> list[uuid.UUID]:
    """Which of this product's reviews the caller has already found helpful.

    The counterpart to `/saved/ids`, and it exists for the same reason: the
    control has two states and the page has to know which one to render before
    the reader touches it. Without this a returning reader sees every review
    offering an un-cast vote they already cast, and casting it again does
    nothing — the composite primary key is idempotent, so the button would
    simply not respond.

    Scoped to one product rather than returning every vote the caller has ever
    made. The product page is the only surface that asks, it only ever needs the
    reviews it is about to render, and an unbounded list would grow without
    limit for an active reader.

    The public review list is cached at the edge for everyone
    (`s-maxage=PUBLIC_CACHE_SECONDS`), which is exactly why this is a separate
    request: folding a per-caller field into that response would either poison
    the shared cache or force the whole list to go private.
    """
    _private(response)

    rows = (
        await db.execute(
            select(ReviewHelpfulVote.review_id)
            .join(Review, Review.id == ReviewHelpfulVote.review_id)
            .where(
                ReviewHelpfulVote.user_id == user.id,
                Review.product_id == product_id,
            )
        )
    ).scalars().all()
    return list(rows)


@router.post("/reviews/{review_id}/helpful", status_code=status.HTTP_201_CREATED)
async def mark_helpful(review_id: uuid.UUID, user: CurrentUser, db: DbSession) -> dict:
    """One vote per person, enforced by the composite primary key. The counter
    on `reviews` is kept in step by a database trigger, so it cannot drift."""
    await db.execute(
        pg_insert(ReviewHelpfulVote)
        .values(review_id=review_id, user_id=user.id)
        .on_conflict_do_nothing(index_elements=["review_id", "user_id"])
    )
    return {"voted": True}


@router.delete(
    "/reviews/{review_id}/helpful", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def unmark_helpful(review_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    await db.execute(
        delete(ReviewHelpfulVote).where(
            ReviewHelpfulVote.review_id == review_id, ReviewHelpfulVote.user_id == user.id
        )
    )
