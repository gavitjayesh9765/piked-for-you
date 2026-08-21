"""
Homepage composition (spec §39).

Returns fully-resolved sections — products, categories and brands already
embedded — so the homepage renders from **one** request instead of one per
rail (spec §48). Every image across every section is signed in a single batch.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import DbSession
from app.models import Brand, Category, HomepageSection, Product, ProductBadge, TopPick
from app.modules.products.service import sign_for, to_summary
from app.schemas.homepage import HomepageSectionOut
from app.schemas.taxonomy import BrandOut, CategoryOut

router = APIRouter()

_PRODUCT_LOADS = (
    selectinload(Product.brand),
    selectinload(Product.category),
    selectinload(Product.media),
    selectinload(Product.score),
    selectinload(Product.badge_links).selectinload(ProductBadge.badge),
)


def _cache(response: Response) -> None:
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}, stale-while-revalidate=60"
    )


@router.get("", response_model=list[HomepageSectionOut])
async def get_homepage(db: DbSession, response: Response) -> list[HomepageSectionOut]:
    """Active sections in display order, respecting any scheduling window."""
    _cache(response)
    now = datetime.now(timezone.utc)

    sections = list(
        (
            await db.execute(
                select(HomepageSection)
                .where(
                    HomepageSection.is_active.is_(True),
                    or_(HomepageSection.starts_at.is_(None), HomepageSection.starts_at <= now),
                    or_(HomepageSection.ends_at.is_(None), HomepageSection.ends_at >= now),
                )
                .order_by(HomepageSection.display_order)
            )
        ).scalars().all()
    )

    # Resolve every section's contents first, then sign all imagery at once.
    resolved: list[tuple[HomepageSection, list[Product]]] = []
    for section in sections:
        resolved.append((section, await _products_for(db, section, now)))

    all_products = [p for _, products in resolved for p in products]
    urls = await sign_for(all_products)

    categories = brands = None
    out: list[HomepageSectionOut] = []

    for section, products in resolved:
        payload = HomepageSectionOut(
            id=section.id,
            kind=section.kind,  # type: ignore[arg-type]
            title=section.title,
            subtitle=section.subtitle,
            display_order=section.display_order,
            is_active=section.is_active,
            data=section.config or {},
        )

        if products:
            payload.products = [to_summary(p, urls) for p in products]

        if section.kind == "category_tiles":
            if categories is None:
                categories = await _homepage_categories(db)
            payload.categories = categories

        if section.kind == "featured_brands":
            if brands is None:
                brands = await _pinned_brands(db)
            payload.brands = brands

        out.append(payload)

    return out


async def _products_for(db: DbSession, section: HomepageSection, now: datetime) -> list[Product]:
    """Resolve one section's products from its `config`.

    The section says *what* it wants (a category slug, a limit); this decides
    how to fetch it. Adding a rail is an admin action, not a deploy (spec §39).
    """
    config = section.config or {}
    limit = int(config.get("limit", 8))

    if section.kind == "top_picks":
        rows = (
            await db.execute(
                select(Product)
                .join(TopPick, TopPick.product_id == Product.id)
                .where(
                    Product.status == "published",
                    TopPick.is_active.is_(True),
                    or_(TopPick.starts_at.is_(None), TopPick.starts_at <= now),
                    or_(TopPick.ends_at.is_(None), TopPick.ends_at >= now),
                    TopPick.collection.is_(None),
                )
                .options(*_PRODUCT_LOADS)
                .order_by(TopPick.display_order)
                .limit(limit)
            )
        ).unique().scalars().all()
        return list(rows)

    if section.kind == "category_rail":
        slug = config.get("categorySlug")
        if not slug:
            return []
        rows = (
            await db.execute(
                select(Product)
                .join(Category, Product.category_id == Category.id)
                .where(Product.status == "published", Category.path.contains([slug]))
                .options(*_PRODUCT_LOADS)
                .limit(limit)
            )
        ).unique().scalars().all()
        items = list(rows)
        items.sort(key=lambda p: float(p.score.overall) if p.score else 0.0, reverse=True)
        return items

    if section.kind == "featured_products":
        rows = (
            await db.execute(
                select(Product)
                .where(Product.status == "published")
                .options(*_PRODUCT_LOADS)
                .order_by(Product.published_at.desc().nulls_last())
                .limit(limit)
            )
        ).unique().scalars().all()
        return list(rows)

    return []


async def _homepage_categories(db: DbSession) -> list[CategoryOut]:
    rows = (
        await db.execute(
            select(Category)
            .where(Category.is_active.is_(True), Category.show_on_homepage.is_(True))
            .order_by(Category.display_order)
        )
    ).scalars().all()
    return [
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
        for c in rows
    ]


async def _pinned_brands(db: DbSession) -> list[BrandOut]:
    rows = (
        await db.execute(
            select(Brand)
            .where(Brand.is_active.is_(True), Brand.is_pinned.is_(True))
            .order_by(Brand.display_order)
        )
    ).scalars().all()
    return [
        BrandOut(
            id=b.id,
            name=b.name,
            slug=b.slug,
            logo_url=b.logo_url,
            is_pinned=b.is_pinned,
            display_order=b.display_order,
        )
        for b in rows
    ]


@router.get("/top-picks", response_model=list[HomepageSectionOut])
async def top_picks(db: DbSession, response: Response) -> list[HomepageSectionOut]:
    """Admin-curated Top Picks (spec §15), as a standalone list."""
    _cache(response)
    now = datetime.now(timezone.utc)

    rows = list(
        (
            await db.execute(
                select(Product)
                .join(TopPick, TopPick.product_id == Product.id)
                .where(
                    Product.status == "published",
                    TopPick.is_active.is_(True),
                    or_(TopPick.starts_at.is_(None), TopPick.starts_at <= now),
                    or_(TopPick.ends_at.is_(None), TopPick.ends_at >= now),
                )
                .options(*_PRODUCT_LOADS)
                .order_by(TopPick.display_order)
            )
        ).unique().scalars().all()
    )

    urls = await sign_for(rows)
    import uuid as _uuid

    return [
        HomepageSectionOut(
            id=_uuid.uuid4(),
            kind="top_picks",
            title="Top Picks",
            subtitle="The highest-scoring products across every category we cover.",
            display_order=1,
            is_active=True,
            products=[to_summary(p, urls) for p in rows],
        )
    ]
