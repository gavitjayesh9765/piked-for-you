"""Public product endpoints (spec §42). Published content only."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.config import settings
from app.core.deps import DbSession
from app.modules.products.repository import ProductRepository
from app.modules.products.service import sign_for, to_detail, to_summary
from app.schemas.common import Facet, Page, PageParams, SortOption
from app.schemas.product import ProductOut, ProductSummaryOut

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
    page: Annotated[int, Query(ge=1)] = 1,
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


@router.get("/{product_id}/alternatives", response_model=list[ProductSummaryOut])
async def alternatives(
    product_id: uuid.UUID,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=12)] = 4,
) -> list[ProductSummaryOut]:
    _cache(response)
    repo = ProductRepository(db)
    product = await repo.get_any(product_id)
    if product is None or product.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    alts = await repo.alternatives(product, limit)
    urls = await sign_for(alts)
    return [to_summary(p, urls) for p in alts]


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
