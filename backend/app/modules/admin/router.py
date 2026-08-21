"""
Admin API (spec §34–§37, §60).

Mounted behind `get_current_admin` in the v1 router — which requires a valid
signed JWT, `app_metadata.role == "admin"`, AND completed MFA (aal2). Single
admin role, so there are no per-route tiers.

Every mutation writes an ActivityLog row inside the same transaction (§60).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.models import ActivityLog, ContactMessage, Product, Profile, Review
from app.modules.admin import service
from app.modules.products.repository import ProductRepository
from app.modules.products.service import sign_for, to_admin_detail, to_summary
from app.schemas.common import MAX_PAGE, AdminSortOption, Page, PageParams
from app.schemas.product import (
    MediaReorder,
    ProductCreate,
    ProductOut,
    ProductSummaryOut,
    ProductUpdate,
    ScoreUpsert,
)

router = APIRouter()


def _private(response: Response) -> None:
    """Admin responses carry unpublished content and must never be cached by a
    shared proxy."""
    response.headers["Cache-Control"] = "no-store, private"


async def _load(db: DbSession, product_id: uuid.UUID) -> Product:
    product = await ProductRepository(db).get_any(product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


# ------------------------------------------------------------------ #
# Dashboard (spec §35)                                                #
# ------------------------------------------------------------------ #


@router.get("/metrics")
async def metrics(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    _private(response)
    return await service.dashboard_metrics(db)


# ------------------------------------------------------------------ #
# Products (spec §36, §37)                                            #
# ------------------------------------------------------------------ #


@router.get("/products", response_model=Page[ProductSummaryOut])
async def list_products(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[AdminSortOption, Query()] = "newest",
    category_id: Annotated[uuid.UUID | None, Query(alias="categoryId")] = None,
    brand_id: Annotated[uuid.UUID | None, Query(alias="brandId")] = None,
    retailer: Annotated[str | None, Query(max_length=100)] = None,
    price_state: Annotated[
        Literal["missing", "present", "failing"] | None, Query(alias="priceState")
    ] = None,
    stale_hours: Annotated[int | None, Query(alias="staleHours", ge=0, le=8760)] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Page[ProductSummaryOut]:
    """Unlike the public list, this returns drafts and archived products.

    Sorting and filtering are wider here than on the public list for the same
    reason: this screen is a worklist. "Newest first" is the default because
    that is what an editor is usually coming back to, and `price_checked_asc`
    plus `priceState=failing` is how they find what the last price run could
    not read.
    """
    _private(response)

    params = PageParams(page=page, page_size=page_size)
    items, total = await ProductRepository(db).list_all(
        page=params,
        status=status_filter,
        query=q,
        sort=sort,
        category_id=category_id,
        brand_id=brand_id,
        retailer_slug=retailer,
        price_state=price_state,
        stale_hours=stale_hours,
    )
    urls = await sign_for(items)

    return Page(
        items=[to_summary(p, urls) for p in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
        has_more=params.offset + len(items) < total,
    )


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, response: Response
) -> ProductOut:
    _private(response)
    product = await _load(db, product_id)
    return to_admin_detail(product, await sign_for([product]))


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: Annotated[ProductCreate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    """Always created as a draft — publishing is a separate, audited action, so
    "save" can never push a half-written product live (spec §38)."""
    _private(response)
    product = await service.create_product(db, payload, admin.id, client_ip(request))
    full = await _load(db, product.id)
    return to_admin_detail(full, await sign_for([full]))


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    payload: Annotated[ProductUpdate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    _private(response)
    product = await _load(db, product_id)
    await service.update_product(db, product, payload, admin.id, client_ip(request))
    full = await _load(db, product_id)
    return to_admin_detail(full, await sign_for([full]))


class PublishCheck(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    can_publish: bool
    missing: list[str]


@router.get("/products/{product_id}/publish-check", response_model=PublishCheck)
async def publish_check(
    product_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, response: Response
) -> PublishCheck:
    """What is still missing (spec §62) — shown *before* the editor presses
    publish, rather than as a rejection afterwards."""
    _private(response)
    product = await _load(db, product_id)
    blockers = service.publish_blockers(product)
    return PublishCheck(can_publish=not blockers, missing=blockers)


@router.post("/products/{product_id}/publish", response_model=ProductOut)
async def publish_product(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    _private(response)
    product = await _load(db, product_id)
    await service.publish(db, product, admin.id, client_ip(request))
    full = await _load(db, product_id)
    return to_admin_detail(full, await sign_for([full]))


@router.post("/products/{product_id}/unpublish", response_model=ProductOut)
async def unpublish_product(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    _private(response)
    product = await _load(db, product_id)
    await service.unpublish(db, product, admin.id, client_ip(request))
    full = await _load(db, product_id)
    return to_admin_detail(full, await sign_for([full]))


@router.post("/products/{product_id}/archive", response_model=ProductOut)
async def archive_product(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    """Archive rather than delete — a hard delete would orphan reviews people
    wrote in good faith."""
    _private(response)
    product = await _load(db, product_id)
    await service.archive(db, product, admin.id, client_ip(request))
    full = await _load(db, product_id)
    return to_admin_detail(full, await sign_for([full]))


@router.put("/products/{product_id}/score", response_model=ProductOut)
async def set_score(
    product_id: uuid.UUID,
    payload: Annotated[ScoreUpsert, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> ProductOut:
    """Criteria are validated against the category's configured `score_criteria`
    (spec §24) — a headphone cannot be scored on refresh rate."""
    _private(response)
    product = await _load(db, product_id)
    await service.set_score(db, product, payload, admin.id, client_ip(request))
    full = await _load(db, product_id)
    return to_admin_detail(full, await sign_for([full]))


@router.put(
    "/products/{product_id}/media/order",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def reorder_media(
    product_id: uuid.UUID,
    payload: Annotated[MediaReorder, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> None:
    """Drag-and-drop ordering (spec §19). Position 0 becomes the primary image."""
    product = await _load(db, product_id)
    await service.reorder_media(db, product, payload.media_ids, admin.id, client_ip(request))


# ------------------------------------------------------------------ #
# Review moderation (spec §30)                                        #
# ------------------------------------------------------------------ #


class ModerateRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    action: str
    note: str | None = None


@router.get("/reviews")
async def list_reviews(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[str, Query(alias="status")] = "pending",
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> dict:
    """The moderation queue — oldest first, so nothing waits indefinitely."""
    _private(response)

    base = select(Review)
    if status_filter != "all":
        base = base.where(Review.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows = (
        (
            await db.execute(
                base.options(selectinload(Review.user), selectinload(Review.media))
                .order_by(Review.created_at.asc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .unique()
        .scalars()
        .all()
    )

    titles = {
        pid: title
        for pid, title in (
            await db.execute(
                select(Product.id, Product.title).where(
                    Product.id.in_([r.product_id for r in rows] or [uuid.uuid4()])
                )
            )
        ).all()
    }

    return {
        "items": [
            {
                "id": str(r.id),
                "productId": str(r.product_id),
                "productTitle": titles.get(r.product_id, "—"),
                "author": r.user.display_name if r.user else "—",
                "rating": r.rating,
                "title": r.title,
                "body": r.body,
                "status": r.status,
                "isFeatured": r.is_featured,
                "mediaCount": len(r.media),
                "createdAt": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


@router.post("/reviews/{review_id}/moderate")
async def moderate_review(
    review_id: uuid.UUID,
    payload: Annotated[ModerateRequest, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> dict:
    """Approve, reject, hide, feature or unfeature.

    Approving or rejecting recomputes the product's denormalised community
    rating, so the card never needs an aggregate query.
    """
    _private(response)

    review = await db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    actions: dict[str, tuple[str | None, bool | None]] = {
        "approve": ("approved", None),
        "reject": ("rejected", None),
        "hide": ("hidden", None),
        "feature": (None, True),
        "unfeature": (None, False),
    }
    if payload.action not in actions:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown moderation action")

    new_status, featured = actions[payload.action]
    if new_status:
        review.status = new_status
    if featured is not None:
        review.is_featured = featured

    review.moderated_by = admin.id
    review.moderated_at = datetime.now(timezone.utc)
    if payload.note:
        review.moderation_note = payload.note[:2000]

    await db.flush()

    if new_status in ("approved", "rejected", "hidden"):
        await ProductRepository(db).recompute_rating(review.product_id)

    await audit.record(
        db,
        actor_id=admin.id,
        action=f"review.{payload.action}",
        entity_type="review",
        entity_id=review.id,
        summary=f"Review {payload.action}",
        ip_address=client_ip(request),
    )

    return {"id": str(review.id), "status": review.status, "isFeatured": review.is_featured}


# ------------------------------------------------------------------ #
# Contact queue                                                       #
# ------------------------------------------------------------------ #


@router.get("/messages")
async def list_messages(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[str, Query(alias="status")] = "new",
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
) -> dict:
    _private(response)
    page_size = 25

    base = select(ContactMessage)
    if status_filter != "all":
        base = base.where(ContactMessage.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(ContactMessage.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return {
        "items": [
            {
                "id": str(m.id),
                "reference": m.reference,
                "topic": m.topic,
                "categorySlugs": m.category_slugs,
                "name": m.name,
                "email": m.email,
                "message": m.message,
                "budgetRange": m.budget_range,
                "productUrl": m.product_url,
                "organisation": m.organisation,
                "status": m.status,
                "createdAt": m.created_at.isoformat(),
            }
            for m in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


# ------------------------------------------------------------------ #
# Users (read-only)                                                   #
# ------------------------------------------------------------------ #


@router.get("/users")
async def list_users(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
) -> dict:
    """Registered shoppers.

    Read-only, and deliberately minimal. An admin has no business browsing an
    individual's saved products or stated interests — RLS grants admins no
    policy on those tables at all.
    """
    _private(response)
    page_size = 25

    base = select(Profile)
    if q:
        pattern = f"%{q.strip()}%"
        base = base.where(
            or_(Profile.display_name.ilike(pattern), Profile.email.ilike(pattern))
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(Profile.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    counts = {
        uid: count
        for uid, count in (
            await db.execute(
                select(Review.user_id, func.count(Review.id))
                .where(Review.user_id.in_([p.id for p in rows] or [uuid.uuid4()]))
                .group_by(Review.user_id)
            )
        ).all()
    }

    return {
        "items": [
            {
                "id": str(p.id),
                "displayName": p.display_name,
                "email": p.email,
                "isActive": p.is_active,
                "reviewCount": counts.get(p.id, 0),
                "createdAt": p.created_at.isoformat(),
            }
            for p in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


# ------------------------------------------------------------------ #
# Audit trail (spec §60)                                              #
# ------------------------------------------------------------------ #


@router.get("/logs")
async def activity_logs(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    entity_type: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    """Read-only. There is deliberately no endpoint to edit or delete a log
    entry, and no RLS policy grants update or delete on this table either."""
    _private(response)

    base = select(ActivityLog)
    if entity_type:
        base = base.where(ActivityLog.entity_type == entity_type)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(ActivityLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "actorId": str(r.actor_id) if r.actor_id else None,
                "action": r.action,
                "entityType": r.entity_type,
                "entityId": str(r.entity_id) if r.entity_id else None,
                "summary": r.summary,
                "meta": r.meta,
                "createdAt": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }
