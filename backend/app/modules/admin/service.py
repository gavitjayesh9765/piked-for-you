"""
Admin product operations.

Two rules run through this whole module:

  * **Nothing about authority comes from the request.** The actor is the
    verified token; `status` is never read from a payload; publishing is its
    own audited action.
  * **Every mutation is logged** (spec §60), inside the same transaction, so a
    rolled-back change cannot leave a log entry claiming it happened.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit, storage
from app.models import (
    Badge,
    Brand,
    Category,
    Product,
    ProductBadge,
    ProductMedia,
    ProductScore,
)
from app.modules.admin import templates
from app.schemas.product import ProductCreate, ProductUpdate, ScoreUpsert

# Fields a publish check requires (spec §62). A product missing any of these is
# not finished, and publishing it would put a half-written page in front of a
# reader who came for a recommendation.
PUBLISH_REQUIREMENTS = (
    ("primary image", lambda p: any(m.kind == "image" for m in p.media)),
    ("current price", lambda p: p.price_current is not None),
    ("SortedChoice Score", lambda p: p.score is not None),
    # The buy recommendation and the line that argues it. These are the two
    # things a reader came for, and a page that leads with a verdict banner
    # cannot be published with the banner empty — it would render a hole where
    # the answer belongs.
    ("buy recommendation", lambda p: bool(p.verdict_stance)),
    ("recommendation summary", lambda p: bool(p.verdict_summary and p.verdict_summary.strip())),
    ("verdict", lambda p: bool(p.verdict and p.verdict.strip())),
    ("tagline", lambda p: bool(p.tagline and p.tagline.strip())),
    # Pros and cons are the scannable half of the argument. A verdict with no
    # cons is the shape a page takes when the affiliate link wrote it, so the
    # check asks for both sides rather than either.
    ("at least one pro", lambda p: bool(p.pros)),
    ("at least one con", lambda p: bool(p.cons)),
    ("at least one retailer link", lambda p: any(r.is_active for r in p.retailer_links)),
)


def slugify(value: str) -> str:
    """URL-safe slug (spec §47). ASCII-folded so a title with accents still
    produces a clean, stable path."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)[:280] or "untitled"


async def unique_slug(db: AsyncSession, base: str, exclude_id: uuid.UUID | None = None) -> str:
    """Append -2, -3 … until free. Loops rather than trusting a single check,
    because two admins saving at once would otherwise collide."""
    slug = base
    n = 1
    while True:
        stmt = select(Product.id).where(Product.slug == slug)
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        if (await db.execute(stmt)).scalar_one_or_none() is None:
            return slug
        n += 1
        slug = f"{base[: 280 - len(str(n)) - 1]}-{n}"


async def _assert_refs(db: AsyncSession, brand_id: uuid.UUID, category_id: uuid.UUID) -> None:
    if (await db.execute(select(Brand.id).where(Brand.id == brand_id))).scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown brand")
    if (
        await db.execute(select(Category.id).where(Category.id == category_id))
    ).scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category")


async def _validated_specs(
    db: AsyncSession, category_id: uuid.UUID, raw: list[dict] | None
) -> list[dict]:
    """Specifications, checked against the category's template (spec §41).

    Which fields a product may carry is a property of its category, resolved up
    the tree. Without this a mouse could be given a frequency response, and the
    first product filed under a category would silently define the shape every
    later one copied.
    """
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category")
    resolved = await templates.resolve_for_category(db, category)
    return templates.validate_specifications(raw, resolved.spec_template, category.name)


async def create_product(
    db: AsyncSession, payload: ProductCreate, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """Always creates a DRAFT.

    `ProductCreate.status` is `Literal["draft"]`, so this is enforced by the
    schema as well — "save" can never push a half-written product live (§38).
    """
    await _assert_refs(db, payload.brand_id, payload.category_id)

    specifications = await _validated_specs(db, payload.category_id, payload.specifications)

    # Slugified whether it was typed or derived. `update_product` already did
    # this; create did not, so a Slug field filled in by hand with "Sony
    # WH-1000XM5!" was stored verbatim. The public product URL is built from
    # this value and the frontend refuses anything that is not kebab-case, so
    # the product simply 404ed and the only fix was to guess the cause.
    slug = await unique_slug(db, slugify(payload.slug) if payload.slug else slugify(payload.title))

    product = Product(
        title=payload.title.strip(),
        slug=slug,
        brand_id=payload.brand_id,
        category_id=payload.category_id,
        tagline=payload.tagline.strip(),
        short_description=payload.short_description,
        description=payload.description,
        currency=payload.currency,
        price_current=payload.price_current,
        price_min=payload.price_min,
        price_max=payload.price_max,
        price_updated_at=datetime.now(timezone.utc) if payload.price_current else None,
        verdict_stance=payload.verdict_stance,
        verdict_summary=payload.verdict_summary,
        verdict=payload.verdict,
        hands_on_tested=payload.hands_on_tested,
        research_note=payload.research_note,
        researched_at=payload.researched_at,
        best_for=payload.best_for,
        not_ideal_for=payload.not_ideal_for,
        pros=payload.pros,
        cons=payload.cons,
        specifications=specifications,
        meta_title=payload.meta_title,
        meta_description=payload.meta_description,
        status="draft",
    )
    db.add(product)
    await db.flush()

    if payload.badge_ids:
        await _set_badges(db, product.id, payload.badge_ids)

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.create",
        entity_type="product",
        entity_id=product.id,
        summary=f"Created draft “{product.title}”",
        ip_address=ip,
    )
    return product


async def update_product(
    db: AsyncSession, product: Product, payload: ProductUpdate, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """PATCH semantics: only fields actually sent are touched.

    `exclude_unset` matters — without it, every omitted optional field would be
    written as None and silently wipe content.
    """
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if not data:
        return product

    if "brand_id" in data or "category_id" in data:
        await _assert_refs(
            db,
            data.get("brand_id", product.brand_id),
            data.get("category_id", product.category_id),
        )

    before = _snapshot(product)
    badge_ids = data.pop("badge_ids", None)

    # Validated against the *incoming* category, not the current one: moving a
    # mouse from Accessories to Mice changes which fields are legal, and the
    # check has to follow the move rather than the row it started on.
    if "specifications" in data:
        data["specifications"] = await _validated_specs(
            db, data.get("category_id", product.category_id), data["specifications"]
        )

    if "slug" in data and data["slug"]:
        data["slug"] = await unique_slug(db, slugify(data["slug"]), exclude_id=product.id)
    elif "title" in data and not product.slug:
        data["slug"] = await unique_slug(db, slugify(data["title"]), exclude_id=product.id)

    if "price_current" in data:
        data["price_updated_at"] = datetime.now(timezone.utc)

    for key, value in data.items():
        setattr(product, key, value)

    if badge_ids is not None:
        await _set_badges(db, product.id, badge_ids)

    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.update",
        entity_type="product",
        entity_id=product.id,
        summary=f"Updated “{product.title}”",
        meta={"changes": audit.diff(before, _snapshot(product))},
        ip_address=ip,
    )
    return product


def publish_blockers(product: Product) -> list[str]:
    """What is still missing before this may go live (spec §62)."""
    return [label for label, check in PUBLISH_REQUIREMENTS if not check(product)]


async def publish(
    db: AsyncSession, product: Product, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """Publish, or refuse with a specific reason.

    A generic "cannot publish" would send an editor hunting; naming the missing
    fields is the difference between a usable CMS and an annoying one.
    """
    blockers = publish_blockers(product)
    if blockers:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "incomplete",
                "message": "This product is missing required content.",
                "missing": blockers,
            },
        )

    product.status = "published"
    product.published_at = product.published_at or datetime.now(timezone.utc)
    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.publish",
        entity_type="product",
        entity_id=product.id,
        summary=f"Published “{product.title}”",
        ip_address=ip,
    )
    return product


async def unpublish(
    db: AsyncSession, product: Product, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """Back to draft — immediately unreachable publicly, by both the repository
    filter and RLS."""
    product.status = "draft"
    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.unpublish",
        entity_type="product",
        entity_id=product.id,
        summary=f"Unpublished “{product.title}”",
        ip_address=ip,
    )
    return product


async def archive(
    db: AsyncSession, product: Product, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """Archive rather than delete. Editorial history is worth keeping, and a
    hard delete would orphan reviews people wrote in good faith."""
    product.status = "archived"
    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.archive",
        entity_type="product",
        entity_id=product.id,
        summary=f"Archived “{product.title}”",
        ip_address=ip,
    )
    return product


async def delete_product(
    db: AsyncSession, product: Product, actor_id: uuid.UUID, ip: str | None
) -> None:
    """Permanently remove a product, its media objects and everything filed
    under it.

    `archive()` above remains the right answer for a product that HAS a history
    worth keeping — it is reversible and it does not take anyone's review down
    with it. This exists for the other case, which archiving never addressed: a
    row created by mistake, a duplicate, a test product. Those accumulate in the
    catalogue, cannot be got rid of, and make the archived tab useless as a
    record of anything.

    So the two are offered side by side rather than one replacing the other, and
    the admin UI states the difference at the point of clicking.

    Two things make this safe to do at all:

      * Every table that references `products` declares `on delete cascade`
        (media, specs, badges, retailer links, reviews, saved items, top picks,
        price history, alternatives). The database removes them in one
        statement; nothing is left pointing at a row that is gone.

      * The audit entry is written FIRST, in the same transaction, and
        `activity_logs` has no foreign key to `products` — so the record of the
        deletion outlives the thing deleted, which is the only reason a hard
        delete belongs in an audited system at all.

    Storage objects are removed before the row, because the row is the only
    record of where they are. If the removal fails we still delete: an orphaned
    object in a private bucket is a bill, while a product an editor cannot
    delete is the bug being fixed here.
    """
    paths = [m.storage_path for m in product.media if m.storage_path]
    paths += [m.thumbnail_path for m in product.media if m.thumbnail_path]

    title = product.title
    product_id = product.id

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.delete",
        entity_type="product",
        entity_id=product_id,
        summary=f"Deleted “{title}”",
        # The snapshot is the point: this is the last place the product's own
        # data exists, so the log keeps enough of it to reconstruct what was
        # removed and to answer "was that the right row?" months later.
        meta={"snapshot": _snapshot(product), "media_objects": len(paths)},
        ip_address=ip,
    )

    if paths:
        await storage.remove("product-media", paths)

    await db.delete(product)
    await db.flush()


async def set_score(
    db: AsyncSession, product: Product, payload: ScoreUpsert, actor_id: uuid.UUID, ip: str | None
) -> Product:
    """Set the SortedChoice Score, validated against the category's configured criteria.

    A headphone cannot be scored on refresh rate: the criteria come from the
    category (spec §24), so an unknown key is rejected rather than stored.
    """
    category = await db.get(Category, product.category_id)
    # Resolved up the tree: a product filed under Mice is scored on the Mice
    # criteria, and one filed under a category nobody has configured falls back
    # to its parent's rather than to nothing (spec §24).
    resolved = (
        await templates.resolve_for_category(db, category)
        if category
        else templates.ResolvedTemplate()
    )
    allowed = {c.get("key") for c in resolved.score_criteria}

    if allowed:
        unknown = [c.key for c in payload.criteria if c.key not in allowed]
        if unknown:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "unknown_criteria",
                    "message": f"Not scoring criteria for {category.name}.",
                    "unknown": unknown,
                    "allowed": sorted(allowed),
                },
            )

    existing = (
        await db.execute(select(ProductScore).where(ProductScore.product_id == product.id))
    ).scalar_one_or_none()

    criteria = [c.model_dump(by_alias=False) for c in payload.criteria]

    if existing:
        existing.overall = payload.overall
        existing.criteria = criteria
    else:
        db.add(ProductScore(product_id=product.id, overall=payload.overall, criteria=criteria))

    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.score",
        entity_type="product",
        entity_id=product.id,
        summary=f"Scored “{product.title}” {payload.overall}/10",
        ip_address=ip,
    )
    return product


async def reorder_media(
    db: AsyncSession, product: Product, media_ids: list[uuid.UUID], actor_id: uuid.UUID, ip: str | None
) -> None:
    """Drag-and-drop ordering (spec §19). Position 0 becomes the primary image.

    Ids not belonging to this product are ignored rather than applied — passing
    another product's media id must not reorder it.
    """
    owned = {
        m.id: m
        for m in (
            await db.execute(select(ProductMedia).where(ProductMedia.product_id == product.id))
        ).scalars().all()
    }

    position = 0
    for media_id in media_ids:
        media = owned.get(media_id)
        if media is None:
            continue
        media.display_order = position
        position += 1

    await db.flush()

    await audit.record(
        db,
        actor_id=actor_id,
        action="product.media.reorder",
        entity_type="product",
        entity_id=product.id,
        summary=f"Reordered media on “{product.title}”",
        ip_address=ip,
    )


async def _set_badges(db: AsyncSession, product_id: uuid.UUID, badge_ids: list[uuid.UUID]) -> None:
    """Replace the badge set. Unknown ids are dropped silently — a stale badge
    id from an open tab should not fail the whole save."""
    await db.execute(delete(ProductBadge).where(ProductBadge.product_id == product_id))
    if not badge_ids:
        return

    valid = set(
        (await db.execute(select(Badge.id).where(Badge.id.in_(badge_ids)))).scalars().all()
    )
    for order, badge_id in enumerate(badge_ids):
        if badge_id in valid:
            db.add(ProductBadge(product_id=product_id, badge_id=badge_id, display_order=order))


def _snapshot(product: Product) -> dict:
    """Auditable fields only — enough to answer "what changed" later."""
    return {
        "title": product.title,
        "slug": product.slug,
        "tagline": product.tagline,
        "status": product.status,
        "price_current": str(product.price_current) if product.price_current else None,
        "price_min": str(product.price_min) if product.price_min else None,
        "price_max": str(product.price_max) if product.price_max else None,
        "verdict": product.verdict,
        # The recommendation itself is the most consequential thing an editor
        # can change, and the one a reader would most want a paper trail on.
        "verdict_stance": product.verdict_stance,
        "verdict_summary": product.verdict_summary,
        "hands_on_tested": product.hands_on_tested,
        "brand_id": str(product.brand_id),
        "category_id": str(product.category_id),
    }


async def dashboard_metrics(db: AsyncSession) -> dict:
    """Counts for the admin dashboard (spec §35).

    This was eight `SELECT count(*)` statements awaited one after another. The
    session runs on a single connection, so they could not overlap — the
    dashboard paid eight sequential round trips to render eight numbers. The
    three that vary by status collapse into one grouped scan each, and the
    three standalone counts ride along as scalar subqueries on one statement.
    Same numbers, three round trips.
    """
    from app.models import Brand as _Brand
    from app.models import Category as _Category
    from app.models import ContactMessage, NewsletterSubscriber, Review

    product_counts = dict(
        (
            await db.execute(select(Product.status, func.count()).group_by(Product.status))
        ).all()
    )
    review_counts = dict(
        (await db.execute(select(Review.status, func.count()).group_by(Review.status))).all()
    )

    def scalar_count(model, *where):
        stmt = select(func.count()).select_from(model)
        for clause in where:
            stmt = stmt.where(clause)
        return stmt.scalar_subquery()

    # Subscribers ride along on the same statement rather than adding a fourth
    # round trip. Both numbers are shown because, while MAIL_PROVIDER is
    # `disabled`, the second is zero and the first is the whole list — and the
    # gap between them is the thing worth seeing on the dashboard.
    categories, brands, open_messages, subscribers, confirmed_subscribers = (
        await db.execute(
            select(
                scalar_count(_Category, _Category.is_active.is_(True)),
                scalar_count(_Brand, _Brand.is_active.is_(True)),
                scalar_count(ContactMessage, ContactMessage.status == "new"),
                scalar_count(
                    NewsletterSubscriber,
                    NewsletterSubscriber.is_active.is_(True),
                    NewsletterSubscriber.unsubscribed_at.is_(None),
                ),
                scalar_count(
                    NewsletterSubscriber,
                    NewsletterSubscriber.is_active.is_(True),
                    NewsletterSubscriber.unsubscribed_at.is_(None),
                    NewsletterSubscriber.confirmed_at.isnot(None),
                ),
            )
        )
    ).one()

    return {
        "published_products": product_counts.get("published", 0),
        "draft_products": product_counts.get("draft", 0),
        "archived_products": product_counts.get("archived", 0),
        "categories": categories,
        "brands": brands,
        "pending_reviews": review_counts.get("pending", 0),
        "reported_reviews": review_counts.get("reported", 0),
        "open_messages": open_messages,
        "newsletter_subscribers": subscribers,
        "newsletter_confirmed": confirmed_subscribers,
    }
