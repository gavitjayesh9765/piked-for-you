"""Model → wire mapping and product-domain logic."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import sign_many
from app.core.video_links import embed_url, thumbnail_url
from app.models import Badge, Brand, Category, Product, ProductBadge, ProductScore
from app.models.product import ProductMedia
from app.schemas.common import Facet, FacetOption
from app.schemas.product import (
    BadgeOut,
    BrandRef,
    CategoryRef,
    CommunityRatingOut,
    MediaOut,
    PricingOut,
    ProductOut,
    ProductSummaryOut,
    ScoreOut,
    ScoreSummaryOut,
    SeoOut,
)


def _badges(product: Product) -> list[BadgeOut]:
    links = sorted(product.badge_links, key=lambda l: l.display_order)
    return [BadgeOut.model_validate(link.badge) for link in links if link.badge.is_active]


def _pricing(product: Product) -> PricingOut:
    return PricingOut(
        currency=product.currency,
        current=product.price_current,
        min=product.price_min,
        max=product.price_max,
        updated_at=product.price_updated_at,
    )


def _community(product: Product) -> CommunityRatingOut | None:
    """Never merged with the SortedChoice Score — separate field, separate type (spec §32)."""
    if not product.rating_count or product.rating_average is None:
        return None
    return CommunityRatingOut(average=product.rating_average, count=product.rating_count)


def _media_out(m: ProductMedia, urls: dict[str, str]) -> MediaOut:
    """Map a media row to the wire type.

    The database stores an object key, never a URL. `urls` carries pre-signed
    URLs keyed by that path — signed in one batch by the caller, because a grid
    of 48 products would otherwise issue 48 signing requests.

    A missing signature yields an empty url rather than an exception: a broken
    image should degrade to a placeholder, not take down the page.
    """
    if m.kind == "video_link":
        # Nothing to sign — the provider hosts it. The embed address is rebuilt
        # from the validated provider + id, never reflected from stored input.
        return MediaOut(
            id=m.id,
            kind="video_link",
            url=m.source_url or "",
            embed_url=embed_url(m.provider or "", m.external_id or ""),
            thumbnail_url=thumbnail_url(m.provider or "", m.external_id or "") or None,
            provider=m.provider,
            title=m.title,
            display_order=m.display_order,
        )

    return MediaOut(
        id=m.id,
        kind=m.kind,  # type: ignore[arg-type]
        url=urls.get(m.storage_path or "", ""),
        thumbnail_url=urls.get(m.thumbnail_path or "", None) if m.thumbnail_path else None,
        alt=m.alt,
        width=m.width,
        height=m.height,
        duration_seconds=m.duration_seconds,
        display_order=m.display_order,
    )


def media_paths(products: list[Product]) -> list[str]:
    """Every object key across a set of products, for one batch signing call."""
    paths: list[str] = []
    for p in products:
        for m in p.media:
            # Linked videos have no object to sign.
            if m.storage_path:
                paths.append(m.storage_path)
            if m.thumbnail_path:
                paths.append(m.thumbnail_path)
    return paths


async def sign_for(products: list[Product]) -> dict[str, str]:
    """Sign every image across these products in a single round trip."""
    return await sign_many("product-media", media_paths(products))


def _primary_image(product: Product, urls: dict[str, str]) -> MediaOut | None:
    images = [m for m in product.media if m.kind == "image"]
    if not images:
        return None
    return _media_out(min(images, key=lambda m: m.display_order), urls)


def to_summary(product: Product, urls: dict[str, str] | None = None) -> ProductSummaryOut:
    urls = urls or {}
    return ProductSummaryOut(
        id=product.id,
        title=product.title,
        slug=product.slug,
        brand=BrandRef.model_validate(product.brand),
        category=CategoryRef.model_validate(product.category),
        tagline=product.tagline,
        primary_image=_primary_image(product, urls),
        score=ScoreSummaryOut(overall=product.score.overall) if product.score else None,
        badges=_badges(product),
        pricing=_pricing(product),
        community_rating=_community(product),
        status=product.status,  # type: ignore[arg-type]
    )


def _retailer_links(product: Product, *, for_admin: bool) -> list[dict[str, Any]]:
    """The product's retailer links, shaped for the audience.

    Two differences, both deliberate.

    **Which links.** The public page shows only active ones. The admin form
    needs the inactive ones too: it submits the complete set on save, so a link
    that disappeared from the form because someone unticked "active" would be
    deleted by the next save — taking its price history with it.

    **Scrape state.** `last_scrape_error` says things like "the retailer
    refused the request (429)". That is operational detail about our own
    infrastructure, and the public product response is cached by a CDN for five
    minutes, so anything included here is effectively published. Admins only.

    Ordering follows the retailer's own `display_order` in both cases, so
    "Official" lands where it was configured to rather than wherever the join
    happened to return it.
    """
    links = sorted(product.retailer_links, key=lambda link: link.retailer.display_order)
    if not for_admin:
        links = [link for link in links if link.is_active]

    rows: list[dict[str, Any]] = []
    for link in links:
        row: dict[str, Any] = {
            "id": link.id,
            "retailer": link.retailer.name,
            "retailer_slug": link.retailer.slug,
            "url": link.url,
            "display_price": link.display_price,
            "is_active": link.is_active,
            "last_updated_at": link.price_checked_at,
            # Availability is public: a reader deciding whether to click a link
            # is exactly who needs to know the listing is dead.
            "in_stock": link.in_stock,
            # Derived, never stored: a link is an affiliate link exactly when
            # the retailer has a tag template to append. Storing it separately
            # would let the badge and the actual tag drift apart, and a wrong
            # disclosure is worse than none (spec §59).
            "is_affiliate": bool(link.retailer.affiliate_template),
        }
        if for_admin:
            row |= {
                "scrape_enabled": link.scrape_enabled,
                "last_scrape_status": link.last_scrape_status,
                "last_scrape_error": link.last_scrape_error,
                "last_scraped_at": link.last_scraped_at,
            }
        rows.append(row)
    return rows


def to_admin_detail(product: Product, urls: dict[str, str] | None = None) -> ProductOut:
    """The admin edit screen's payload: every link, and how each one is faring.

    A separate function rather than a flag on `to_detail`, so a public route
    cannot reach this shape by passing the wrong argument.
    """
    return to_detail(product, urls, _for_admin=True)


def to_detail(
    product: Product, urls: dict[str, str] | None = None, *, _for_admin: bool = False
) -> ProductOut:
    """The public product payload. Use `to_admin_detail` for admin routes."""
    urls = urls or {}
    images = sorted((m for m in product.media if m.kind == "image"), key=lambda m: m.display_order)
    videos = sorted(
        (m for m in product.media if m.kind in ("video", "video_link")),
        key=lambda m: m.display_order,
    )

    return ProductOut(
        **to_summary(product, urls).model_dump(by_alias=False, exclude={"score"}),
        description=product.description,
        short_description=product.short_description,
        images=[_media_out(m, urls) for m in images],
        videos=[_media_out(m, urls) for m in videos],
        score=(
            ScoreOut(
                overall=product.score.overall,
                criteria=product.score.criteria,  # type: ignore[arg-type]
                updated_at=product.score.updated_at,
            )
            if product.score
            else None
        ),
        verdict_stance=product.verdict_stance,  # type: ignore[arg-type]
        verdict_summary=product.verdict_summary,
        verdict=product.verdict,
        hands_on_tested=product.hands_on_tested,
        research_note=product.research_note,
        researched_at=product.researched_at,
        best_for=product.best_for,
        not_ideal_for=product.not_ideal_for,
        pros=product.pros,
        cons=product.cons,
        specifications=product.specifications,  # type: ignore[arg-type]
        retailers=_retailer_links(product, for_admin=_for_admin),  # type: ignore[arg-type]
        seo=SeoOut(
            meta_title=product.meta_title,
            meta_description=product.meta_description,
            og_image_url=product.og_image_url,
        ),
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


async def build_facets(db: AsyncSession, category_slug: str | None) -> list[Facet]:
    """Facet counts over the *published* set only, so a filter never promises
    results the user cannot reach."""
    base = select(Product).where(Product.status == "published")
    if category_slug:
        base = base.join(Category, Product.category_id == Category.id).where(
            Category.path.contains([category_slug])
        )
    scope = base.subquery()

    brand_rows = (
        await db.execute(
            select(Brand.slug, Brand.name, func.count(scope.c.id))
            .join(scope, scope.c.brand_id == Brand.id)
            .group_by(Brand.slug, Brand.name)
            .order_by(func.count(scope.c.id).desc())
        )
    ).all()

    badge_rows = (
        await db.execute(
            select(Badge.slug, Badge.name, func.count(ProductBadge.product_id))
            .join(ProductBadge, ProductBadge.badge_id == Badge.id)
            .join(scope, scope.c.id == ProductBadge.product_id)
            .where(Badge.is_active.is_(True))
            .group_by(Badge.slug, Badge.name)
            .order_by(func.count(ProductBadge.product_id).desc())
        )
    ).all()

    score_rows = []
    for threshold, label in ((9, "9.0 and above"), (8, "8.0 and above"), (7, "7.0 and above")):
        count = (
            await db.execute(
                select(func.count())
                .select_from(scope)
                .join(ProductScore, ProductScore.product_id == scope.c.id)
                .where(ProductScore.overall >= threshold)
            )
        ).scalar_one()
        if count:
            score_rows.append(FacetOption(value=str(threshold), label=label, count=count))

    facets = [
        Facet(
            key="brand",
            label="Brand",
            options=[FacetOption(value=s, label=n, count=c) for s, n, c in brand_rows],
        ),
        Facet(key="score", label="SortedChoice Score", options=score_rows),
    ]
    if badge_rows:
        facets.append(
            Facet(
                key="badge",
                label="Recognition",
                options=[FacetOption(value=s, label=n, count=c) for s, n, c in badge_rows],
            )
        )
    return facets
