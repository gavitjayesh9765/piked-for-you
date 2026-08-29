"""
Search (spec §33).

Trigram similarity over title, tagline and brand, backed by the GIN indexes in
the init migration. Results are grouped by entity type because "sony" and
"headphones" express different intents, and flattening them into one ranked
list serves neither.

**Published products only** — enforced in the query here and again by Row Level
Security at the database.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import DbSession
from app.core.text import like_contains
from app.models import Brand, Category, Product, ProductBadge
from app.modules.products.service import sign_for, to_summary
from app.schemas.product import ProductSummaryOut
from app.schemas.taxonomy import BrandOut, CategoryOut

router = APIRouter()


class SearchResults(BaseModel):
    products: list[ProductSummaryOut]
    categories: list[CategoryOut]
    brands: list[BrandOut]
    total: int


# `_like_pattern` used to live here. It now lives in app/core/text.py, because
# the same pattern was being built four other places — two of which did not
# escape anything at all. See that module for what escaping buys and why the
# backslash goes first.


@router.get("", response_model=SearchResults)
async def search(
    db: DbSession,
    response: Response,
    q: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=50)] = 24,
) -> SearchResults:
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}"
    )

    needle = q.strip()
    if not needle:
        return SearchResults(products=[], categories=[], brands=[], total=0)

    pattern = like_contains(needle)

    product_stmt = (
        select(Product)
        .join(Brand, Product.brand_id == Brand.id)
        .where(
            Product.status == "published",
            or_(
                Product.title.ilike(pattern, escape="\\"),
                Product.tagline.ilike(pattern, escape="\\"),
                Brand.name.ilike(pattern, escape="\\"),
            ),
        )
        .options(
            selectinload(Product.brand),
            selectinload(Product.category),
            selectinload(Product.media),
            selectinload(Product.score),
            selectinload(Product.badge_links).selectinload(ProductBadge.badge),
        )
        .limit(limit)
    )

    total = (
        await db.execute(
            select(func.count())
            .select_from(Product)
            .join(Brand, Product.brand_id == Brand.id)
            .where(
                Product.status == "published",
                or_(
                    Product.title.ilike(pattern, escape="\\"),
                    Product.tagline.ilike(pattern, escape="\\"),
                    Brand.name.ilike(pattern, escape="\\"),
                ),
            )
        )
    ).scalar_one()

    products = list((await db.execute(product_stmt)).unique().scalars().all())
    # Our verdict leads the ordering, not lexical relevance.
    products.sort(key=lambda p: float(p.score.overall) if p.score else 0.0, reverse=True)

    categories = list(
        (
            await db.execute(
                select(Category)
                .where(Category.is_active.is_(True), Category.name.ilike(pattern, escape="\\"))
                .order_by(Category.display_order)
                .limit(8)
            )
        ).scalars().all()
    )

    brands = list(
        (
            await db.execute(
                select(Brand)
                .where(Brand.is_active.is_(True), Brand.name.ilike(pattern, escape="\\"))
                .order_by(Brand.display_order)
                .limit(8)
            )
        ).scalars().all()
    )

    urls = await sign_for(products)

    return SearchResults(
        products=[to_summary(p, urls) for p in products],
        categories=[
            CategoryOut(
                id=c.id,
                name=c.name,
                slug=c.slug,
                path=list(c.path or []),
                description=c.description,
                icon=c.icon,
                display_order=c.display_order,
                is_active=c.is_active,
                show_on_homepage=c.show_on_homepage,
            )
            for c in categories
        ],
        brands=[
            BrandOut(
                id=b.id,
                name=b.name,
                slug=b.slug,
                logo_url=b.logo_url,
                is_pinned=b.is_pinned,
                display_order=b.display_order,
            )
            for b in brands
        ],
        total=total,
    )


@router.get("/suggest", response_model=list[str])
async def suggest(
    db: DbSession, q: Annotated[str, Query(min_length=1, max_length=100)]
) -> list[str]:
    """Type-ahead over product titles and brand names."""
    pattern = like_contains(q)

    titles = (
        await db.execute(
            select(Product.title)
            .where(Product.status == "published", Product.title.ilike(pattern, escape="\\"))
            .limit(6)
        )
    ).scalars().all()

    brands = (
        await db.execute(
            select(Brand.name)
            .where(Brand.is_active.is_(True), Brand.name.ilike(pattern, escape="\\"))
            .limit(4)
        )
    ).scalars().all()

    seen: list[str] = []
    for value in [*titles, *brands]:
        if value not in seen:
            seen.append(value)
    return seen[:10]
