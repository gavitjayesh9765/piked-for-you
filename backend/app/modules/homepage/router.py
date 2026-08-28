"""
Homepage composition (spec §39).

Returns fully-resolved sections — products, categories and brands already
embedded — so the homepage renders from **one** request instead of one per
rail (spec §48). Every image across every section is signed in a single batch.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import DbSession
from app.models import (
    Brand,
    Category,
    HomepageSection,
    Product,
    ProductBadge,
    ProductScore,
    TopPick,
)
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
        # ⚠ THE ORDER BY IS NOT DECORATION — IT DECIDES *WHICH* PRODUCTS THESE ARE.
        #
        # This used to be `.limit(limit)` with no ORDER BY, followed by a
        # `items.sort(key=score)` in Python. Those two lines look like they say
        # "the top `limit` products by score" and they say something else
        # entirely: LIMIT with no ORDER BY lets Postgres return ANY `limit`
        # rows it likes — whatever the scan reaches first, which in practice is
        # physical table order and changes under you after a VACUUM. Only then
        # were those arbitrary rows sorted.
        #
        # The bug was invisible while no category held more than `limit`
        # products: sorting all of them is the same as sorting the best of
        # them. The moment Audio has forty, the rail shows eight arbitrary
        # products in immaculate descending order — it LOOKS ranked, which is
        # worse than looking broken, on a site whose entire proposition is that
        # the ranking means something.
        #
        # Sorted in SQL, before the limit, it is the top `limit` by score.
        # Unscored products sort last rather than vanishing: an outer join and
        # NULLS LAST, so a rail whose category has nothing scored yet still
        # shows its products instead of going empty.
        rows = (
            await db.execute(
                select(Product)
                .join(Category, Product.category_id == Category.id)
                .outerjoin(ProductScore, ProductScore.product_id == Product.id)
                .where(Product.status == "published", Category.path.contains([slug]))
                .options(*_PRODUCT_LOADS)
                .order_by(ProductScore.overall.desc().nulls_last(), Product.published_at.desc().nulls_last())
                .limit(limit)
            )
        ).unique().scalars().all()
        return list(rows)

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
    """The homepage tiles, each carrying its BRANCH count.

    ⚠ THE ROLL-UP IS THE WHOLE POINT, and a direct count would be a lie here.

    Products are filed against whichever node an editor chose, and for the tile
    categories that is almost never the tile itself: "Mobiles" holds nothing
    directly, "Smartphones" underneath it holds two. A per-`category_id` count
    — which is what every other counter in this codebase does, correctly, for
    its own purpose — would put "0 researched" on a tile leading to two
    published reviews. The tile is an entrance to a branch, so it counts the
    branch.

    This is the same rollup /c does over the flat list in the browser, done
    here instead because the homepage already gets one resolved payload and
    should not ship the whole taxonomy to work out three numbers.
    """
    tiles = list(
        (
            await db.execute(
                select(Category)
                .where(Category.is_active.is_(True), Category.show_on_homepage.is_(True))
                .order_by(Category.display_order)
            )
        ).scalars().all()
    )
    if not tiles:
        return []

    # Every active category with its own published count, in one query. The
    # subtree sum is then a prefix match over the denormalised `path` arrays,
    # which is cheap at this size and needs no recursive CTE.
    counts = {
        cid: count
        for cid, count in (
            await db.execute(
                select(Product.category_id, func.count(Product.id))
                .where(Product.status == "published")
                .group_by(Product.category_id)
            )
        ).all()
    }
    everything = list(
        (
            await db.execute(select(Category).where(Category.is_active.is_(True)))
        ).scalars().all()
    )

    def subtree_count(tile: Category) -> int:
        prefix = list(tile.path or [tile.slug])
        return sum(
            counts.get(c.id, 0)
            for c in everything
            if (list(c.path or [c.slug]))[: len(prefix)] == prefix
        )

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
            product_count=subtree_count(c),
        )
        for c in tiles
    ]


async def _pinned_brands(db: DbSession) -> list[BrandOut]:
    """The featured strip, each brand carrying its published count.

    `/brands` has counted since it was written; this did not, so the homepage
    tile rendered a count line that was never reachable. A brand's count is a
    plain per-`brand_id` count — brands have no hierarchy to roll up, which is
    why this is four lines and the category version above is thirty.
    """
    rows = (
        await db.execute(
            select(Brand)
            .where(Brand.is_active.is_(True), Brand.is_pinned.is_(True))
            .order_by(Brand.display_order)
        )
    ).scalars().all()

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

    return [
        BrandOut(
            id=b.id,
            name=b.name,
            slug=b.slug,
            logo_url=b.logo_url,
            is_pinned=b.is_pinned,
            display_order=b.display_order,
            product_count=counts.get(b.id, 0),
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
