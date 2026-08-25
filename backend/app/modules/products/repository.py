"""
Product data access.

The single most important rule in this file: `_published_only()` is applied to
every query reachable from a public route. Draft and archived products must be
unreachable publicly (spec §38, §61), and enforcing that here — rather than in
each route — means a new public endpoint gets the guarantee for free.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Sequence

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Badge,
    Brand,
    Category,
    Product,
    ProductBadge,
    ProductScore,
    Retailer,
)
from app.models.product import ProductAlternative, ProductRetailer
from app.schemas.common import AdminSortOption, PageParams, SortOption


def _with_relations(stmt: Select) -> Select:
    """Eager-load everything a card or detail view needs, in one round trip.
    Without this a 48-product grid issues ~200 queries."""
    return stmt.options(
        selectinload(Product.brand),
        selectinload(Product.category),
        selectinload(Product.media),
        selectinload(Product.score),
        selectinload(Product.badge_links).selectinload(ProductBadge.badge),
    )


def _published_only(stmt: Select) -> Select:
    return stmt.where(Product.status == "published")


def _apply_sort(stmt: Select, sort: SortOption) -> Select:
    if sort == "price_asc":
        return stmt.order_by(Product.price_current.asc().nulls_last())
    if sort == "price_desc":
        return stmt.order_by(Product.price_current.desc().nulls_last())
    if sort == "rating_desc":
        return stmt.order_by(Product.rating_average.desc().nulls_last())
    if sort == "newest":
        return stmt.order_by(Product.published_at.desc().nulls_last())
    # Default: our verdict leads, not price.
    #
    # Ordered by a correlated subquery rather than a join: it keeps the
    # statement free of extra FROM entries, so it composes safely with the
    # filters above and with alternatives() below.
    overall = (
        select(ProductScore.overall)
        .where(ProductScore.product_id == Product.id)
        .scalar_subquery()
    )
    return stmt.order_by(overall.desc().nulls_last())


def _apply_admin_sort(stmt: Select, sort: AdminSortOption) -> Select:
    """Ordering for the admin catalogue.

    Every branch adds a `Product.id` tiebreak. Without one, two products
    created in the same transaction share a `created_at`, Postgres is free to
    return them in either order, and a row can appear on both page 1 and page 2
    of the same listing — or on neither.
    """
    tiebreak = Product.id.desc()

    if sort == "oldest":
        return stmt.order_by(Product.created_at.asc(), tiebreak)
    if sort == "updated_desc":
        return stmt.order_by(Product.updated_at.desc(), tiebreak)
    if sort == "updated_asc":
        return stmt.order_by(Product.updated_at.asc(), tiebreak)
    if sort == "published_desc":
        return stmt.order_by(Product.published_at.desc().nulls_last(), tiebreak)
    if sort == "title_asc":
        return stmt.order_by(Product.title.asc(), tiebreak)
    if sort == "title_desc":
        return stmt.order_by(Product.title.desc(), tiebreak)
    if sort == "price_desc":
        return stmt.order_by(Product.price_current.desc().nulls_last(), tiebreak)
    if sort == "price_asc":
        return stmt.order_by(Product.price_current.asc().nulls_last(), tiebreak)
    if sort == "score_desc":
        overall = (
            select(ProductScore.overall)
            .where(ProductScore.product_id == Product.id)
            .scalar_subquery()
        )
        return stmt.order_by(overall.desc().nulls_last(), tiebreak)
    if sort == "price_checked_asc":
        # Never-checked first: those are the ones the scraper most needs to see.
        return stmt.order_by(Product.price_updated_at.asc().nulls_first(), tiebreak)
    if sort == "price_checked_desc":
        return stmt.order_by(Product.price_updated_at.desc().nulls_last(), tiebreak)

    # "newest" — latest products first, which is what an editor expects to
    # land on when they open the catalogue.
    return stmt.order_by(Product.created_at.desc(), tiebreak)


class ProductRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---------------------------------------------------------------- #
    # Public reads                                                      #
    # ---------------------------------------------------------------- #

    async def get_published(self, category_slug: str, slug: str) -> Product | None:
        stmt = _with_relations(
            _published_only(
                select(Product)
                .join(Category, Product.category_id == Category.id)
                .where(Product.slug == slug, Category.slug == category_slug)
            )
        ).options(
            # Nested: to_detail() reads link.retailer.name, and a lazy load
            # there raises MissingGreenlet under asyncio.
            selectinload(Product.retailer_links).selectinload(ProductRetailer.retailer),
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_published(
        self,
        *,
        page: PageParams,
        category_slug: str | None = None,
        brand_slugs: Sequence[str] | None = None,
        badge_slugs: Sequence[str] | None = None,
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
        min_score: Decimal | None = None,
        sort: SortOption = "score_desc",
    ) -> tuple[list[Product], int]:
        stmt = _published_only(select(Product))

        # Filters use IN / EXISTS subqueries rather than joins.
        #
        # A join against the many-to-many product_badges multiplies rows, which
        # forces SELECT DISTINCT — and Postgres then rejects ORDER BY on a
        # joined column that is not in the select list. Subqueries keep the
        # result one-row-per-product, so no DISTINCT is needed and sorting by
        # score stays legal.
        if category_slug:
            # Matches the category and everything beneath it, so /c/audio also
            # surfaces products filed under /c/audio/headphones.
            stmt = stmt.where(
                Product.category_id.in_(
                    select(Category.id).where(Category.path.contains([category_slug]))
                )
            )
        if brand_slugs:
            stmt = stmt.where(
                Product.brand_id.in_(select(Brand.id).where(Brand.slug.in_(brand_slugs)))
            )
        if badge_slugs:
            stmt = stmt.where(
                select(1)
                .select_from(ProductBadge)
                .join(Badge, Badge.id == ProductBadge.badge_id)
                .where(ProductBadge.product_id == Product.id, Badge.slug.in_(badge_slugs))
                .exists()
            )
        if min_price is not None:
            stmt = stmt.where(Product.price_current >= min_price)
        if max_price is not None:
            stmt = stmt.where(Product.price_current <= max_price)
        if min_score is not None:
            stmt = stmt.where(
                Product.id.in_(
                    select(ProductScore.product_id).where(ProductScore.overall >= min_score)
                )
            )

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = _apply_sort(_with_relations(stmt), sort)
        stmt = stmt.offset(page.offset).limit(page.page_size)

        rows = (await self.db.execute(stmt)).unique().scalars().all()
        return list(rows), total

    async def curated_alternatives(
        self, product: Product, limit: int = 6
    ) -> list[tuple[Product, str, str | None]]:
        """The alternatives an editor actually chose, in the order they chose.

        Returned as `(product, reason, note)` triples rather than as link rows,
        because every caller wants the product and would otherwise walk the
        relationship itself — and would have to remember the published filter
        while doing it.

        Unpublished targets are dropped here as well as in RLS. A row pointing
        at a draft would otherwise render a card linking to a 404, and leak the
        draft's title on the way.
        """
        stmt = (
            select(ProductAlternative)
            .join(Product, ProductAlternative.alternative_id == Product.id)
            .where(
                ProductAlternative.product_id == product.id,
                Product.status == "published",
            )
            .options(
                selectinload(ProductAlternative.alternative).selectinload(Product.brand),
                selectinload(ProductAlternative.alternative).selectinload(Product.category),
                selectinload(ProductAlternative.alternative).selectinload(Product.media),
                selectinload(ProductAlternative.alternative).selectinload(Product.score),
                selectinload(ProductAlternative.alternative)
                .selectinload(Product.badge_links)
                .selectinload(ProductBadge.badge),
            )
            .order_by(ProductAlternative.display_order, ProductAlternative.created_at)
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).unique().scalars().all()
        return [(row.alternative, row.reason, row.note) for row in rows]

    async def alternatives(
        self, product: Product, limit: int = 4, exclude: Sequence[uuid.UUID] = ()
    ) -> list[Product]:
        """Same category, similar price band, highest scoring first (spec §52).

        A deliberately simple heuristic for the MVP — the structured-attribute
        matching described in spec §58 replaces this later.

        `exclude` keeps the curated picks from being repeated underneath
        themselves: the same product appearing twice in one block, once with an
        editorial label and once without, reads as a bug in the page.
        """
        stmt = _with_relations(
            _published_only(
                select(Product).where(
                    Product.id != product.id,
                    Product.category_id == product.category_id,
                )
            )
        )
        if exclude:
            stmt = stmt.where(Product.id.not_in(list(exclude)))
        if product.price_current is not None:
            low = product.price_current * Decimal("0.6")
            high = product.price_current * Decimal("1.6")
            stmt = stmt.where(Product.price_current.between(low, high))

        stmt = _apply_sort(stmt, "score_desc").limit(limit)
        return list((await self.db.execute(stmt)).unique().scalars().all())

    # ---------------------------------------------------------------- #
    # Admin reads — no published filter, role-gated at the route         #
    # ---------------------------------------------------------------- #

    async def get_any(self, product_id: uuid.UUID) -> Product | None:
        stmt = _with_relations(select(Product).where(Product.id == product_id)).options(
            selectinload(Product.retailer_links).selectinload(ProductRetailer.retailer)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_all(
        self,
        *,
        page: PageParams,
        status: str | None = None,
        query: str | None = None,
        sort: AdminSortOption = "newest",
        category_id: uuid.UUID | None = None,
        brand_id: uuid.UUID | None = None,
        retailer_slug: str | None = None,
        price_state: str | None = None,
        stale_hours: int | None = None,
    ) -> tuple[list[Product], int]:
        """The admin catalogue, with the filters an editor actually reaches for.

        `price_state` and `stale_hours` exist because the question that starts
        most editing sessions is not "show me everything" but "what is wrong":
        which products have no price, and which prices nobody has verified this
        week. Both are EXISTS subqueries against product_retailers rather than
        joins — a product with three links must not appear three times.
        """
        stmt = select(Product)
        if status:
            stmt = stmt.where(Product.status == status)
        if query:
            stmt = stmt.where(Product.title.ilike(f"%{query}%"))
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if brand_id:
            stmt = stmt.where(Product.brand_id == brand_id)

        if retailer_slug:
            stmt = stmt.where(
                select(1)
                .select_from(ProductRetailer)
                .join(Retailer, Retailer.id == ProductRetailer.retailer_id)
                .where(
                    ProductRetailer.product_id == Product.id,
                    ProductRetailer.is_active.is_(True),
                    Retailer.slug == retailer_slug,
                )
                .exists()
            )

        if price_state == "missing":
            stmt = stmt.where(Product.price_current.is_(None))
        elif price_state == "present":
            stmt = stmt.where(Product.price_current.is_not(None))
        elif price_state == "failing":
            stmt = stmt.where(
                select(1)
                .select_from(ProductRetailer)
                .where(
                    ProductRetailer.product_id == Product.id,
                    ProductRetailer.last_scrape_status.in_(
                        ("error", "blocked", "not_found", "rejected")
                    ),
                )
                .exists()
            )

        if stale_hours is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=stale_hours)
            stmt = stmt.where(
                or_(Product.price_updated_at.is_(None), Product.price_updated_at < cutoff)
            )

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = _apply_admin_sort(_with_relations(stmt), sort)
        stmt = stmt.offset(page.offset).limit(page.page_size)

        rows = (await self.db.execute(stmt)).unique().scalars().all()
        return list(rows), total

    async def recompute_rating(self, product_id: uuid.UUID) -> None:
        """Refresh the denormalised community aggregates after a review is
        approved, rejected or removed. Only approved reviews count."""
        from app.models import Review

        stmt = select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.product_id == product_id, Review.status == "approved"
        )
        average, count = (await self.db.execute(stmt)).one()

        product = await self.db.get(Product, product_id)
        if product is not None:
            product.rating_average = Decimal(str(round(average, 2))) if average else None
            product.rating_count = count or 0
