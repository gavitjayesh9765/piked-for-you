"""Public product endpoints (spec §42). Published content only."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DbSession
from app.modules.products.repository import ProductRepository
from app.modules.products.service import sign_for, to_detail, to_summary
from app.schemas.common import MAX_PAGE, Facet, Page, PageParams, SortOption
from app.models import PriceHistory
from app.schemas.product import (
    AlternativeOut,
    PriceMark,
    PriceTrailOut,
    ProductOut,
    ProductSummaryOut,
)

router = APIRouter()


def _cache(response: Response) -> None:
    """Public content is cacheable at the CDN (spec §48)."""
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}, stale-while-revalidate=60"
    )


@router.get("", response_model=Page[ProductSummaryOut])
async def list_products(
    db: DbSession,
    response: Response,
    category: Annotated[str | None, Query()] = None,
    brand: Annotated[list[str] | None, Query()] = None,
    badge: Annotated[list[str] | None, Query()] = None,
    min_price: Annotated[Decimal | None, Query(ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0)] = None,
    min_score: Annotated[Decimal | None, Query(ge=0, le=10)] = None,
    sort: Annotated[SortOption, Query()] = "score_desc",
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 24,
) -> Page[ProductSummaryOut]:
    _cache(response)
    params = PageParams(page=page, page_size=page_size)
    repo = ProductRepository(db)

    items, total = await repo.list_published(
        page=params,
        category_slug=category,
        brand_slugs=brand,
        badge_slugs=badge,
        min_price=min_price,
        max_price=max_price,
        min_score=min_score,
        sort=sort,
    )
    # Sign every image across the whole page in ONE request — 48 products
    # signed individually would dominate the response time.
    urls = await sign_for(items)

    return Page(
        items=[to_summary(p, urls) for p in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
        has_more=params.offset + len(items) < total,
    )


@router.get("/facets", response_model=list[Facet])
async def product_facets(
    db: DbSession,
    response: Response,
    category: Annotated[str | None, Query()] = None,
) -> list[Facet]:
    """Filter options with counts (spec §17). Which facets exist is configured
    per category, so this returns whatever that category defines."""
    _cache(response)
    from app.modules.products.service import build_facets

    return await build_facets(db, category)


@router.get("/{product_id}/alternatives", response_model=list[AlternativeOut])
async def alternatives(
    product_id: uuid.UUID,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
) -> list[AlternativeOut]:
    """Curated picks first, then the price-band heuristic to fill the row.

    The two are returned in one list but stay distinguishable: `is_curated`
    separates "an editor chose this, for this reason" from "similar product,
    similar price". Presenting the second as the first would attach an
    editorial claim to a row nobody wrote, which is the exact failure the whole
    site is built to avoid.
    """
    _cache(response)
    repo = ProductRepository(db)
    product = await repo.get_any(product_id)
    if product is None or product.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    curated = await repo.curated_alternatives(product, limit)

    # Only top up if the editor left room. A page with six deliberate picks
    # does not want a seventh chosen by price arithmetic.
    remaining = limit - len(curated)
    filler = (
        await repo.alternatives(
            product, remaining, exclude=[p.id for p, _, _ in curated]
        )
        if remaining > 0
        else []
    )

    urls = await sign_for([p for p, _, _ in curated] + filler)

    return [
        AlternativeOut(
            **to_summary(p, urls).model_dump(by_alias=False),
            reason=reason,  # type: ignore[arg-type]
            note=note,
            is_curated=True,
        )
        for p, reason, note in curated
    ] + [
        AlternativeOut(
            **to_summary(p, urls).model_dump(by_alias=False),
            # The heuristic knows one thing about these: same category, same
            # money. "closest_rival" is the only honest label for that.
            reason="closest_rival",
            note=None,
            is_curated=False,
        )
        for p in filler
    ]


@router.get("/{product_id}/price-trail", response_model=PriceTrailOut)
async def price_trail(
    product_id: uuid.UUID,
    db: DbSession,
    response: Response,
    days: Annotated[int, Query(ge=7, le=365)] = 90,
) -> PriceTrailOut:
    """Where this product's price sits against what we have actually seen.

    ---------------------------------------------------------------------------
    WHY THIS IS NOT A CHART ENDPOINT

    The instinct is to return the series and draw a line. Two properties of this
    data make that dishonest.

    Prices here are never checked on a timer — a run exists because an admin
    pressed the button, which is a documented non-negotiable and not an
    oversight. And `apply_reading` writes a history row only when the number
    moved. So the observations are irregular in time AND sparse by construction,
    and a line drawn between them would interpolate a price we never saw, on
    days we never looked, in a shape that implies continuous monitoring we do
    not do.

    What we can state without inventing anything is the range we have observed,
    where the price sits inside it, and how many times it moved. That is also
    the part that changes a decision: "this is the lowest we have seen it" and
    "this is £2,000 off its floor" are different answers to "should I buy now",
    and neither needs a single interpolated point.

    ---------------------------------------------------------------------------
    WHY THE WINDOW IS BOUNDED, AND WHY THE LAST CHANGE IS NOT

    Extremes are computed inside `days` so that "lowest in 90 days" means what
    it says. `products.price_min`/`price_max` were not usable for this: they are
    all-time and only ever widen, so they drift further from anything a buyer
    can act on with every run.

    `last_changed_at` deliberately ignores the window. A price that has not
    moved in six months produces no rows inside 90 days, and "nothing to say"
    would be the wrong reading of that — the right one is that the price has
    been flat since February, which is worth knowing before waiting for a sale.
    """
    _cache(response)

    repo = ProductRepository(db)
    product = await repo.get_any(product_id)
    # Same shape as `alternatives` above: existence is not confirmed for a
    # product the public cannot see (spec §38, §61).
    if product is None or product.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # One trip for the window's shape. Aggregated in the database rather than by
    # pulling rows and reducing in Python — the point of not returning the
    # series is that the series never has to leave the database.
    windowed = (
        await db.execute(
            select(
                func.count(PriceHistory.id),
                func.min(PriceHistory.price),
                func.max(PriceHistory.price),
            ).where(
                PriceHistory.product_id == product_id,
                PriceHistory.captured_at >= since,
            )
        )
    ).one()
    changes, low_price, high_price = windowed

    last_changed_at = (
        await db.execute(
            select(func.max(PriceHistory.captured_at)).where(
                PriceHistory.product_id == product_id
            )
        )
    ).scalar_one_or_none()

    async def _when(price, newest: bool):
        """The moment an extreme was observed.

        Newest occurrence rather than oldest for the low, because "lowest, seen
        in March" should name the most recent time it was that cheap — an older
        date makes a current low look stale.
        """
        if price is None:
            return None
        order = PriceHistory.captured_at.desc() if newest else PriceHistory.captured_at.asc()
        return (
            await db.execute(
                select(PriceHistory.captured_at)
                .where(
                    PriceHistory.product_id == product_id,
                    PriceHistory.captured_at >= since,
                    PriceHistory.price == price,
                )
                .order_by(order)
                .limit(1)
            )
        ).scalar_one_or_none()

    low_at = await _when(low_price, newest=True)
    high_at = await _when(high_price, newest=True)

    return PriceTrailOut(
        currency=product.currency,
        window_days=days,
        changes=changes or 0,
        current=product.price_current,
        low=PriceMark(amount=low_price, at=low_at) if low_price is not None and low_at else None,
        high=PriceMark(amount=high_price, at=high_at) if high_price is not None and high_at else None,
        last_changed_at=last_changed_at,
    )


@router.get("/{category_slug}/{slug}", response_model=ProductOut)
async def get_product(
    category_slug: str,
    slug: str,
    db: DbSession,
    response: Response,
) -> ProductOut:
    _cache(response)
    product = await ProductRepository(db).get_published(category_slug, slug)
    if product is None:
        # 404 rather than 403 for a draft — the existence of an unpublished
        # product is not public information.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    urls = await sign_for([product])
    return to_detail(product, urls)
