"""Brand endpoints (spec §22)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DbSession
from app.models import Brand, Product
from app.schemas.taxonomy import BrandOut

router = APIRouter()


def _cache(response: Response) -> None:
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}, stale-while-revalidate=60"
    )


@router.get("", response_model=list[BrandOut])
async def list_brands(
    db: DbSession,
    response: Response,
    pinned: Annotated[bool | None, Query()] = None,
) -> list[BrandOut]:
    """`pinned=true` returns the homepage featured strip (spec §22)."""
    _cache(response)

    stmt = select(Brand).where(Brand.is_active.is_(True))
    if pinned:
        stmt = stmt.where(Brand.is_pinned.is_(True))
    stmt = stmt.order_by(Brand.display_order, Brand.name)

    brands = list((await db.execute(stmt)).scalars().all())

    counts = {
        bid: count
        for bid, count in (
            await db.execute(
                select(Product.brand_id, func.count(Product.id))
                .where(Product.status == "published")
                .group_by(Product.brand_id)
            )
        ).all()
    }

    return [BrandOut(**{**_row(b), "product_count": counts.get(b.id, 0)}) for b in brands]


@router.get("/{slug}", response_model=BrandOut)
async def get_brand(slug: str, db: DbSession, response: Response) -> BrandOut:
    _cache(response)

    brand = (
        await db.execute(select(Brand).where(Brand.slug == slug, Brand.is_active.is_(True)))
    ).scalar_one_or_none()
    if brand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand not found")

    count = (
        await db.execute(
            select(func.count())
            .select_from(Product)
            .where(Product.brand_id == brand.id, Product.status == "published")
        )
    ).scalar_one()

    return BrandOut(**{**_row(brand), "product_count": count})


def _row(b: Brand) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "slug": b.slug,
        "logo_url": b.logo_url,
        "description": b.description,
        "website": b.website,
        "is_pinned": b.is_pinned,
        "display_order": b.display_order,
    }
