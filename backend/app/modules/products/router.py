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
from app.schemas.common import MAX_PAGE, Facet, Page, PageParams, SortOption
from app.schemas.product import AlternativeOut, ProductOut, ProductSummaryOut

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
