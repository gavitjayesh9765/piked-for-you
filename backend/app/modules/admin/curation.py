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
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.storage import remove, sign_many
from app.models import (
    HomepageSection,
    Product,
    ProductMedia,
    Review,
    ReviewMedia,
    ReviewReport,
    TopPick,
)

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
        ]
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
        .where(Product.status == "published", Product.id.not_in(already))
        .options(selectinload(Product.brand), selectinload(Product.score))
        .limit(50)
    )
    if q:
        stmt = stmt.where(Product.title.ilike(f"%{q.strip()}%"))

    rows = list((await db.execute(stmt)).unique().scalars().all())
    rows.sort(key=lambda p: float(p.score.overall) if p.score else 0.0, reverse=True)

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


@router.get("/media")
async def media_library(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    kind: Annotated[str, Query()] = "all",
    page: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    """Everything attached to a product, newest first."""
    _private(response)
    page_size = 60

    stmt = select(ProductMedia)
    if kind != "all":
        stmt = stmt.where(ProductMedia.kind == kind)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                stmt.order_by(ProductMedia.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars().all()
    )

    paths = [m.storage_path for m in rows if m.storage_path]
    urls = await sign_many("product-media", paths) if paths else {}

    titles = {
        pid: t
        for pid, t in (
            await db.execute(
                select(Product.id, Product.title).where(
                    Product.id.in_([m.product_id for m in rows] or [uuid.uuid4()])
                )
            )
        ).all()
    }

    from app.core.video_links import thumbnail_url

    return {
        "items": [
            {
                "id": str(m.id),
                "kind": m.kind,
                "url": (
                    m.source_url
                    if m.kind == "video_link"
                    else urls.get(m.storage_path or "", "")
                ),
                "thumbnailUrl": (
                    thumbnail_url(m.provider or "", m.external_id or "")
                    if m.kind == "video_link"
                    else urls.get(m.storage_path or "", "")
                ),
                "provider": m.provider,
                "productId": str(m.product_id),
                "productTitle": titles.get(m.product_id, "—"),
                "sizeBytes": m.size_bytes,
                "width": m.width,
                "height": m.height,
                "createdAt": m.created_at.isoformat(),
            }
            for m in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }
