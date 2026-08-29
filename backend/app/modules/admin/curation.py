"""
Curation and moderation queues (spec §15, §29, §30, §39).

Four surfaces the admin still needed:

  * **Top Picks** — the curated homepage list. Order matters and is explicit,
    never derived from score, because the whole point is editorial judgement.
  * **Homepage sections** — the homepage is data, not a template. Reordering,
    retitling, and switching a rail on or off happens here.
  * **Reports** — abuse reports filed against reviews.
  * **User media** — review photos and video awaiting moderation, reviewed
    separately from the review text because a good review can carry a bad photo.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import String, cast, delete, desc, func, select
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.storage import remove, sign_many
from app.core.text import like_contains
from app.models import (
    HomepageSection,
    Product,
    ProductMedia,
    ProductScore,
    Review,
    ReviewMedia,
    ReviewReport,
    TopPick,
)
from app.schemas.common import MAX_PAGE

router = APIRouter()

SECTION_KINDS = (
    "hero", "category_tiles", "top_picks", "featured_products",
    "category_rail", "featured_brands", "newsletter", "editorial",
)


class Strict(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"


# ====================================================================== #
# Top Picks (spec §15)                                                    #
# ====================================================================== #


class TopPickIn(Strict):
    product_id: uuid.UUID
    collection: str | None = Field(default=None, max_length=80)


class TopPickOrder(Strict):
    ids: list[uuid.UUID]


class TopPickPatch(Strict):
    is_active: bool


@router.get("/top-picks")
async def list_top_picks(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    _private(response)

    rows = list(
        (
            await db.execute(
                select(TopPick)
                .options(
                    selectinload(TopPick.product).selectinload(Product.brand),
                    selectinload(TopPick.product).selectinload(Product.media),
                    selectinload(TopPick.product).selectinload(Product.score),
                )
                .order_by(TopPick.display_order)
            )
        ).unique().scalars().all()
    )

    paths = [
        m.storage_path
        for r in rows
        for m in (r.product.media if r.product else [])
        if m.storage_path and m.kind == "image"
    ]
    urls = await sign_many("product-media", paths) if paths else {}

    def image_for(p: Product | None) -> str:
        if not p:
            return ""
        imgs = [m for m in p.media if m.kind == "image" and m.storage_path]
        if not imgs:
            return ""
        primary = min(imgs, key=lambda m: m.display_order)
        return urls.get(primary.storage_path or "", "")

    # How many of these the homepage will actually render.
    #
    # The public query takes `limit` from the top_picks section's config and
    # defaults to 8 (modules/homepage/router.py). Without this number the admin
    # screen shows twenty picks and gives no hint that the last twelve are
    # invisible — which is a curation tool lying about what it curates.
    section = (
        await db.execute(
            select(HomepageSection).where(
                HomepageSection.kind == "top_picks",
                HomepageSection.is_active.is_(True),
            )
        )
    ).scalars().first()
    visible_limit = int((section.config or {}).get("limit", 8)) if section else None

    return {
        "items": [
            {
                "id": str(r.id),
                "productId": str(r.product_id),
                "title": r.product.title if r.product else "—",
                "brand": r.product.brand.name if r.product and r.product.brand else "—",
                "status": r.product.status if r.product else "—",
                "score": float(r.product.score.overall) if r.product and r.product.score else None,
                "imageUrl": image_for(r.product),
                "collection": r.collection,
                "displayOrder": r.display_order,
                "isActive": r.is_active,
            }
            for r in rows
        ],
        # None when the section is switched off entirely — a different fact
        # from "the first eight", and the screen says so differently.
        "visibleLimit": visible_limit,
        "sectionActive": section is not None,
    }


@router.get("/top-picks/candidates")
async def pick_candidates(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    q: Annotated[str | None, Query(max_length=200)] = None,
) -> dict:
    """Published products not already picked — the shortlist to choose from."""
    _private(response)

    already = select(TopPick.product_id).where(TopPick.collection.is_(None))
    stmt = (
        select(Product)
        # LEFT JOIN, not the relationship: a product with no score yet is a
        # perfectly valid thing to feature and must not be dropped from the
        # shortlist for lacking one.
        .outerjoin(ProductScore, ProductScore.product_id == Product.id)
        .where(Product.status == "published", Product.id.not_in(already))
        .options(selectinload(Product.brand), selectinload(Product.score))
        # Ordered BEFORE the limit, which is the whole fix. This used to take
        # an arbitrary 50 rows — no ORDER BY at all — and then sort those 50 by
        # score in Python, so the list was never "the fifty best": it was fifty
        # rows in whatever order Postgres happened to return them. Combined
        # with a client that filtered its one fetch locally instead of
        # searching, a product outside that arbitrary window could not be found
        # at all, and the screen said "nothing left to feature" about a
        # catalogue that plainly had more.
        .order_by(ProductScore.overall.desc().nullslast(), Product.title)
        .limit(50)
    )
    if q and q.strip():
        stmt = stmt.where(Product.title.ilike(like_contains(q), escape="\\"))

    rows = list((await db.execute(stmt)).unique().scalars().all())

    return {
        "items": [
            {
                "id": str(p.id),
                "title": p.title,
                "brand": p.brand.name if p.brand else "—",
                "score": float(p.score.overall) if p.score else None,
            }
            for p in rows
        ]
    }


@router.post("/top-picks", status_code=status.HTTP_201_CREATED)
async def add_top_pick(
    payload: Annotated[TopPickIn, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    product = await db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    if product.status != "published":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Only published products can be featured — publish it first.",
        )

    existing = (
        await db.execute(
            select(TopPick).where(
                TopPick.product_id == payload.product_id,
                TopPick.collection.is_(payload.collection),
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already in Top Picks.")

    order = (
        await db.execute(select(func.coalesce(func.max(TopPick.display_order), -1) + 1))
    ).scalar_one()

    pick = TopPick(
        product_id=payload.product_id,
        collection=payload.collection,
        display_order=order,
        is_active=True,
    )
    db.add(pick)
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="toppick.add", entity_type="top_pick",
        entity_id=pick.id, summary=f"Featured “{product.title}”", ip_address=client_ip(request),
    )
    return {"id": str(pick.id), "displayOrder": pick.display_order}


@router.put("/top-picks/order", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def reorder_top_picks(
    payload: Annotated[TopPickOrder, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Explicit order — this is editorial judgement, not a score sort."""
    owned = {
        p.id: p for p in (await db.execute(select(TopPick))).scalars().all()
    }
    position = 0
    for pid in payload.ids:
        pick = owned.get(pid)
        if pick is None:
            continue  # unknown id: ignore rather than fail the whole reorder
        pick.display_order = position
        position += 1
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="toppick.reorder", entity_type="top_pick",
        summary="Reordered Top Picks", ip_address=client_ip(request),
    )


@router.patch("/top-picks/{pick_id}")
async def set_top_pick_active(
    pick_id: uuid.UUID,
    payload: Annotated[TopPickPatch, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    """Pause or resume a pick without losing its position.

    `is_active` has been honoured by the public homepage query since it was
    written and has never been settable from the admin, so the only way to take
    something off the homepage was to remove it — which threw away the
    editorial decision about where it sat. Pausing keeps the slot.
    """
    pick = await db.get(TopPick, pick_id)
    if pick is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    pick.is_active = payload.is_active
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="toppick.pause" if not payload.is_active else "toppick.resume",
        entity_type="top_pick", entity_id=pick_id,
        summary=("Paused a Top Pick" if not payload.is_active else "Resumed a Top Pick"),
        ip_address=client_ip(request),
    )
    return {"id": str(pick.id), "isActive": pick.is_active}


@router.delete("/top-picks/{pick_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def remove_top_pick(
    pick_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    pick = await db.get(TopPick, pick_id)
    if pick is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.execute(delete(TopPick).where(TopPick.id == pick_id))
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="toppick.remove", entity_type="top_pick",
        entity_id=pick_id, summary="Removed from Top Picks", ip_address=client_ip(request),
    )


# ====================================================================== #
# Homepage sections (spec §39)                                            #
# ====================================================================== #


class SectionPatch(Strict):
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    display_order: int | None = None
    is_active: bool | None = None
    config: dict | None = None


class SectionIn(Strict):
    kind: str
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    display_order: int = 0
    is_active: bool = True
    config: dict = Field(default_factory=dict)


def _section_row(s: HomepageSection) -> dict:
    return {
        "id": str(s.id), "kind": s.kind, "title": s.title, "subtitle": s.subtitle,
        "displayOrder": s.display_order, "isActive": s.is_active, "config": s.config or {},
    }


@router.get("/homepage")
async def list_sections(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    _private(response)
    rows = (
        await db.execute(select(HomepageSection).order_by(HomepageSection.display_order))
    ).scalars().all()
    return {"items": [_section_row(s) for s in rows], "kinds": list(SECTION_KINDS)}


@router.post("/homepage", status_code=status.HTTP_201_CREATED)
async def create_section(
    payload: Annotated[SectionIn, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    if payload.kind not in SECTION_KINDS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Kind must be one of: {', '.join(SECTION_KINDS)}"
        )
    section = HomepageSection(
        kind=payload.kind, title=payload.title, subtitle=payload.subtitle,
        display_order=payload.display_order, is_active=payload.is_active,
        config=payload.config,
    )
    db.add(section)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="homepage.create", entity_type="homepage_section",
        entity_id=section.id, summary=f"Added a {payload.kind} section",
        ip_address=client_ip(request),
    )
    return _section_row(section)


@router.patch("/homepage/{section_id}")
async def update_section(
    section_id: uuid.UUID,
    payload: Annotated[SectionPatch, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    section = await db.get(HomepageSection, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Section not found")

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    for field in ("title", "subtitle", "display_order", "is_active", "config"):
        if field in data:
            setattr(section, field, data[field])
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="homepage.update", entity_type="homepage_section",
        entity_id=section.id, summary=f"Updated the {section.kind} section",
        ip_address=client_ip(request),
    )
    return _section_row(section)


@router.delete("/homepage/{section_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_section(
    section_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    section = await db.get(HomepageSection, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Section not found")
    kind = section.kind
    await db.delete(section)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="homepage.delete", entity_type="homepage_section",
        entity_id=section_id, summary=f"Removed the {kind} section", ip_address=client_ip(request),
    )


# ====================================================================== #
# Reports (spec §30)                                                      #
# ====================================================================== #


@router.get("/reports")
async def list_reports(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    resolved: Annotated[bool, Query()] = False,
) -> dict:
    """Abuse reports, grouped by the review they target.

    Grouped rather than listed flat: three reports on one review is one
    decision, not three.
    """
    _private(response)

    rows = list(
        (
            await db.execute(
                select(ReviewReport)
                .where(ReviewReport.resolved.is_(resolved))
                .order_by(ReviewReport.created_at.asc())
                .limit(200)
            )
        ).scalars().all()
    )

    review_ids = list({r.review_id for r in rows})
    reviews = {
        rv.id: rv
        for rv in (
            await db.execute(
                select(Review)
                .where(Review.id.in_(review_ids or [uuid.uuid4()]))
                .options(selectinload(Review.user))
            )
        ).unique().scalars().all()
    }
    titles = {
        pid: t
        for pid, t in (
            await db.execute(
                select(Product.id, Product.title).where(
                    Product.id.in_([rv.product_id for rv in reviews.values()] or [uuid.uuid4()])
                )
            )
        ).all()
    }

    grouped: dict[str, dict] = {}
    for rep in rows:
        key = str(rep.review_id)
        review = reviews.get(rep.review_id)
        if key not in grouped:
            grouped[key] = {
                "reviewId": key,
                "reviewStatus": review.status if review else "—",
                "reviewBody": review.body if review else "",
                "author": review.user.display_name if review and review.user else "—",
                "productTitle": titles.get(review.product_id, "—") if review else "—",
                "reports": [],
            }
        grouped[key]["reports"].append(
            {
                "id": str(rep.id),
                "reason": rep.reason,
                "detail": rep.detail,
                "createdAt": rep.created_at.isoformat(),
            }
        )

    return {"items": list(grouped.values()), "total": len(grouped)}


@router.post("/reports/{review_id}/resolve", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def resolve_reports(
    review_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Mark every open report on a review as handled.

    Separate from moderating the review itself: deciding a report is unfounded
    is a real outcome, and shouldn't require changing the review.
    """
    now = datetime.now(timezone.utc)
    reports = (
        await db.execute(
            select(ReviewReport).where(
                ReviewReport.review_id == review_id, ReviewReport.resolved.is_(False)
            )
        )
    ).scalars().all()

    for rep in reports:
        rep.resolved = True
        rep.resolved_at = now
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="report.resolve", entity_type="review",
        entity_id=review_id, summary=f"Resolved {len(reports)} report(s)",
        ip_address=client_ip(request),
    )


# ====================================================================== #
# User media moderation (spec §29)                                        #
# ====================================================================== #


class MediaModerate(Strict):
    action: str  # approve | reject


@router.get("/user-media")
async def list_user_media(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    moderation: Annotated[str, Query()] = "pending",
) -> dict:
    """Review photos and video awaiting a decision.

    Moderated separately from the review text: a thoughtful review can carry a
    photo that should not be published, and rejecting the whole review for that
    would be the wrong call.
    """
    _private(response)

    stmt = select(ReviewMedia).order_by(ReviewMedia.created_at.asc()).limit(200)
    if moderation != "all":
        stmt = stmt.where(ReviewMedia.moderation_status == moderation)

    rows = list((await db.execute(stmt)).scalars().all())
    urls = await sign_many("review-media", [m.storage_path for m in rows]) if rows else {}

    reviews = {
        rv.id: rv
        for rv in (
            await db.execute(
                select(Review)
                .where(Review.id.in_([m.review_id for m in rows] or [uuid.uuid4()]))
                .options(selectinload(Review.user))
            )
        ).unique().scalars().all()
    }

    return {
        "items": [
            {
                "id": str(m.id),
                "kind": m.kind,
                "url": urls.get(m.storage_path, ""),
                "mimeType": m.mime_type,
                "sizeBytes": m.size_bytes,
                "durationSeconds": m.duration_seconds,
                "moderationStatus": m.moderation_status,
                "reviewId": str(m.review_id),
                "author": (
                    reviews[m.review_id].user.display_name
                    if m.review_id in reviews and reviews[m.review_id].user
                    else "—"
                ),
                "createdAt": m.created_at.isoformat(),
            }
            for m in rows
        ],
        "total": len(rows),
    }


@router.post("/user-media/{media_id}/moderate")
async def moderate_user_media(
    media_id: uuid.UUID,
    payload: Annotated[MediaModerate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    """Approve or reject one attachment.

    Rejecting deletes the object from storage as well as marking the row —
    leaving a rejected file reachable by signed URL would defeat the point.
    """
    media = await db.get(ReviewMedia, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    if payload.action == "approve":
        media.moderation_status = "approved"
    elif payload.action == "reject":
        media.moderation_status = "rejected"
        await remove("review-media", [media.storage_path])
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Action must be approve or reject")

    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action=f"usermedia.{payload.action}", entity_type="review_media",
        entity_id=media_id, summary=f"{payload.action.title()}d a review attachment",
        ip_address=client_ip(request),
    )
    return {"id": str(media.id), "moderationStatus": media.moderation_status}


# ====================================================================== #
# Media library                                                           #
# ====================================================================== #


def _asset_key(m: ProductMedia) -> str:
    """The identity of the *file*, not of the attachment.

    Must stay in step with `_asset_key_sql` below — one groups in Postgres,
    the other groups the rows that come back, and if the two disagree the page
    silently drops tiles.
    """
    if m.storage_path:
        return m.storage_path
    if m.provider and m.external_id:
        return f"{m.provider}:{m.external_id}"
    return str(m.id)


def _asset_key_sql():
    # `||` rather than concat(): concat() treats NULL as '' and would collapse
    # every row with no provider into one bogus group, where `||` yields NULL
    # and lets the coalesce fall through to the row's own id.
    return func.coalesce(
        ProductMedia.storage_path,
        ProductMedia.provider + ":" + ProductMedia.external_id,
        cast(ProductMedia.id, String),
    )


@router.get("/media")
async def media_library(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    kind: Annotated[str, Query()] = "all",
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
) -> dict:
    """The library, listed by FILE rather than by attachment.

    One object can be attached to several products — that is the point of
    de-duplication (see `admin/media.py`). Listing rows would therefore show
    the same photograph three times over and re-create, inside the library,
    exactly the duplicate wall the feature exists to remove. So rows are
    grouped by the object they point at, and each tile carries the products
    using it.

    `q` matches product titles, which is the only text a media row has to be
    searched on — nobody is going to type `a7f3…c2.jpg`.
    """
    _private(response)
    page_size = 60
    key = _asset_key_sql()

    # --- which files, and in what order ---
    keys_stmt = select(key.label("k"), func.max(ProductMedia.created_at).label("newest"))
    if kind != "all":
        keys_stmt = keys_stmt.where(ProductMedia.kind == kind)
    if q and q.strip():
        keys_stmt = keys_stmt.join(Product, Product.id == ProductMedia.product_id).where(
            Product.title.ilike(like_contains(q), escape="\\")
        )
    keys_stmt = keys_stmt.group_by(key)

    total = (
        await db.execute(select(func.count()).select_from(keys_stmt.subquery()))
    ).scalar_one()

    keys = [
        r.k
        for r in (
            await db.execute(
                keys_stmt.order_by(desc("newest"))
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    ]

    if not keys:
        return {
            "items": [],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "hasMore": False,
        }

    # --- every attachment of those files, however its product matched ---
    #
    # Deliberately NOT filtered by `q`: a file used by three products is used
    # by three products whether or not all three matched the search, and a
    # delete confirmation that under-reports its blast radius is dangerous.
    #
    # Outer join, because a media row whose product has gone should still be
    # visible here — that is precisely the orphan an admin wants to find.
    rows = list(
        (
            await db.execute(
                select(ProductMedia, Product.title)
                .outerjoin(Product, Product.id == ProductMedia.product_id)
                .where(_asset_key_sql().in_(keys))
                .order_by(ProductMedia.created_at, ProductMedia.display_order)
            )
        ).all()
    )

    paths = [m.storage_path for m, _ in rows if m.storage_path]
    urls = await sign_many("product-media", paths) if paths else {}

    from app.core.video_links import thumbnail_url

    grouped: dict[str, list[tuple[ProductMedia, str | None]]] = {k: [] for k in keys}
    for m, title in rows:
        grouped.setdefault(_asset_key(m), []).append((m, title))

    items = []
    for k in keys:
        group = grouped.get(k) or []
        if not group:
            continue
        # The representative is the oldest attachment: it is the row that first
        # introduced the file, and it is what DELETE is addressed to.
        head, head_title = group[0]
        signed = urls.get(head.storage_path or "", "")
        items.append(
            {
                "id": str(head.id),
                "kind": head.kind,
                "url": head.source_url if head.kind == "video_link" else signed,
                "thumbnailUrl": (
                    thumbnail_url(head.provider or "", head.external_id or "")
                    if head.kind == "video_link"
                    else signed
                ),
                "provider": head.provider,
                "alt": head.alt,
                "productId": str(head.product_id),
                "productTitle": head_title or "—",
                "usedBy": [
                    {"productId": str(m.product_id), "productTitle": t or "—"}
                    for m, t in group
                ],
                "usageCount": len(group),
                "sizeBytes": head.size_bytes,
                "width": head.width,
                "height": head.height,
                "createdAt": head.created_at.isoformat(),
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(keys) < total,
    }


@router.delete(
    "/media/library/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_library_asset(
    media_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Delete a FILE, everywhere it is used.

    This is the library's delete, and it is a different verb from the product
    page's. There, removing an image detaches it from one product and keeps the
    file if anything else still points at it. Here the subject is the file
    itself, so every attachment goes with it — which is why the UI has to name
    the affected products before it asks.

    Addressed by a media id rather than by a path, so nothing caller-supplied
    ever reaches storage: the path is read out of the row.
    """
    media = await db.get(ProductMedia, media_id)
    if media is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")

    key = _asset_key(media)
    if media.storage_path:
        victims = ProductMedia.storage_path == media.storage_path
    elif media.provider and media.external_id:
        victims = (ProductMedia.provider == media.provider) & (
            ProductMedia.external_id == media.external_id
        )
    else:
        victims = ProductMedia.id == media.id

    count = (
        await db.execute(select(func.count()).select_from(ProductMedia).where(victims))
    ).scalar_one()

    await db.execute(delete(ProductMedia).where(victims))
    await db.flush()

    # Nothing references it now, by construction. A linked video has no object.
    if media.storage_path:
        await remove("product-media", [media.storage_path])

    await audit.record(
        db,
        actor_id=admin.id,
        action="media.library.delete",
        entity_type="product_media",
        entity_id=media_id,
        summary=f"Deleted a library file used by {count} product(s)",
        meta={"asset": key, "attachments_removed": count},
        ip_address=client_ip(request),
    )
