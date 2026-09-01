"""
Admin API (spec §34–§37, §60).

Mounted behind `get_current_admin` in the v1 router — which requires a valid
signed JWT, `app_metadata.role == "admin"`, AND completed MFA (aal2). Single
admin role, so there are no per-route tiers.

Every mutation writes an ActivityLog row inside the same transaction (§60).
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core import audit, mail_settings
from app.core.config import settings
from app.emails import render
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.text import like_contains
from app.models import (
    ActivityLog,
    ContactMessage,
    MailSettings,
    NewsletterCampaign,
    NewsletterSubscriber,
    Product,
    Profile,
    Review,
)
from app.modules.admin import newsletter_send, service
from app.modules.alerts.service import dispatch_new_pick
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

    # After the publish, never before it, and it cannot fail this request —
    # `dispatch_new_pick` swallows its own errors. Publishing succeeded; a mail
    # problem must not report it as failed, or an editor's correct response is
    # to press Publish again.
    await dispatch_new_pick(db, full)

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


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_product(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> None:
    """Permanently delete a product and everything filed under it.

    This sits NEXT TO archive, not instead of it. Archiving is right for a
    product with a history — it is reversible and it keeps the reviews people
    wrote. But there was no way at all to get rid of a row created by mistake, a
    duplicate, or a test product, so the catalogue could only ever grow and the
    archived tab stopped meaning anything.

    Everything referencing `products` cascades at the database level, and the
    audit entry is written before the row goes, so the deletion is recorded even
    though its subject is not. `service.delete_product` documents both.
    """
    _private(response)
    product = await _load(db, product_id)
    await service.delete_product(db, product, admin.id, client_ip(request))


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


CONTACT_STATUSES = ("new", "in_progress", "answered", "closed")
CONTACT_TOPICS = ("research_request", "correction", "press", "general")


def _message_out(m: ContactMessage) -> dict:
    return {
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
        "internalNote": m.internal_note,
        "answeredAt": m.answered_at.isoformat() if m.answered_at else None,
        "createdAt": m.created_at.isoformat(),
    }


@router.get("/messages")
async def list_messages(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[str, Query(alias="status")] = "new",
    topic: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
) -> dict:
    """The contact queue, with the filters the other admin lists already had.

    Three things this endpoint gained, all for the same reason — the inbox was
    the one admin screen with no way to find anything in it:

      * `q` — searches the reference, the sender and the message body. The
        reference is the half that matters operationally: it is what a reply
        thread quotes, so "PDY-7K42" has to be a thing you can paste in.
      * `topic` — research requests are the editorially valuable ones and were
        buried among corrections and press mail.
      * `counts` — the per-status totals, so the tabs can carry a number
        instead of making an admin click each one to find out if it is empty.

    `ilike` with the term escaped for LIKE metacharacters: an unescaped `%`
    typed into the search box would otherwise match everything, which reads as
    a broken filter rather than a wildcard nobody asked for.
    """
    _private(response)
    page_size = 25

    base = select(ContactMessage)
    if status_filter in CONTACT_STATUSES:
        base = base.where(ContactMessage.status == status_filter)
    if topic in CONTACT_TOPICS:
        base = base.where(ContactMessage.topic == topic)

    term = (q or "").strip()
    if term:
        like = like_contains(term)
        base = base.where(
            or_(
                ContactMessage.reference.ilike(like, escape="\\"),
                ContactMessage.email.ilike(like, escape="\\"),
                ContactMessage.name.ilike(like, escape="\\"),
                ContactMessage.message.ilike(like, escape="\\"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            # Newest first. The queue was oldest-first, which is right for
            # working through a backlog and wrong for the thing an admin
            # actually opens this screen to do — see what just came in.
            base.order_by(ContactMessage.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    # One grouped query rather than four counts: the tabs are chrome and must
    # not cost a round trip each.
    counts_rows = (
        await db.execute(
            select(ContactMessage.status, func.count()).group_by(ContactMessage.status)
        )
    ).all()
    counts = {status_name: 0 for status_name in CONTACT_STATUSES}
    counts["all"] = 0
    for name, count in counts_rows:
        counts["all"] += count
        if name in counts:
            counts[name] = count

    return {
        "items": [_message_out(m) for m in rows],
        "counts": counts,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


class MessageUpdate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    status: Literal["new", "in_progress", "answered", "closed"] | None = None
    internal_note: str | None = None


@router.patch("/messages/{message_id}")
async def update_message(
    message_id: uuid.UUID,
    payload: Annotated[MessageUpdate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> dict:
    """Move a message through the queue, and leave a note for whoever picks it
    up next.

    Without this the status tabs were decoration: every message was `new`
    forever, so "New" and "All" were the same list and the other two were
    permanently empty. `answered_at` is set by the server when the status
    reaches `answered` — not read from the payload — and cleared if the message
    is reopened, so the timestamp cannot disagree with the status.
    """
    _private(response)
    message = await db.get(ContactMessage, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")

    before = {"status": message.status, "internal_note": message.internal_note}

    if payload.status is not None:
        message.status = payload.status
        message.answered_at = (
            datetime.now(timezone.utc) if payload.status == "answered" else None
        )
    if payload.internal_note is not None:
        note = payload.internal_note.strip()
        message.internal_note = note or None

    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="contact.update",
        entity_type="contact_message",
        entity_id=message.id,
        summary=f"Message {message.reference} → {message.status}",
        meta=audit.diff(before, {"status": message.status, "internal_note": message.internal_note}),
        ip_address=client_ip(request),
    )

    return _message_out(message)


# ------------------------------------------------------------------ #
# Newsletter list                                                     #
# ------------------------------------------------------------------ #

NEWSLETTER_FREQUENCIES = ("daily", "weekly", "deals_only")

#: The four states a subscriber can be in, derived rather than stored.
#:
#: There is no `status` column on `newsletter_subscribers` and there should not
#: be — the state is a function of three timestamps and a boolean, and a fifth
#: column duplicating them is a column that can disagree with them. The order
#: they are tested in below matters: an unsubscribed row is unsubscribed
#: whether or not it was ever confirmed.
NEWSLETTER_STATES = ("all", "pending", "confirmed", "unsubscribed")


def _newsletter_state(row: NewsletterSubscriber) -> str:
    if row.unsubscribed_at is not None or not row.is_active:
        return "unsubscribed"
    if row.confirmed_at is not None:
        return "confirmed"
    return "pending"


def _newsletter_filter(stmt, state: str):
    """Translate a state name into the columns it is derived from."""
    active = NewsletterSubscriber.is_active.is_(True)
    not_unsubscribed = NewsletterSubscriber.unsubscribed_at.is_(None)

    if state == "unsubscribed":
        return stmt.where(
            or_(
                NewsletterSubscriber.unsubscribed_at.isnot(None),
                NewsletterSubscriber.is_active.is_(False),
            )
        )
    if state == "confirmed":
        return stmt.where(
            NewsletterSubscriber.confirmed_at.isnot(None), active, not_unsubscribed
        )
    if state == "pending":
        return stmt.where(
            NewsletterSubscriber.confirmed_at.is_(None), active, not_unsubscribed
        )
    return stmt


def _newsletter_out(row: NewsletterSubscriber) -> dict:
    """What the admin screen is allowed to see.

    Neither token is included, and that is a decision rather than an oversight
    about what to serialise. `unsubscribe_token` is the sole authorization on
    the one-click unsubscribe link and `confirmation_token` is the sole
    authorization on double opt-in, so a screen that rendered them would put
    two live credentials per subscriber into a browser, a proxy log and any
    screen share — in exchange for nothing anyone reading this list needs.
    """
    return {
        "id": str(row.id),
        "email": row.email,
        "frequency": row.frequency,
        "state": _newsletter_state(row),
        "confirmedAt": row.confirmed_at.isoformat() if row.confirmed_at else None,
        # NULL means no confirmation has ever gone out — which, while
        # MAIL_PROVIDER is `disabled`, is every row. That is the honest record
        # of a list collected before there was anywhere to send from, and it is
        # what makes "who still needs asking?" answerable once mail is on.
        "confirmationSentAt": (
            row.confirmation_sent_at.isoformat() if row.confirmation_sent_at else None
        ),
        "unsubscribedAt": row.unsubscribed_at.isoformat() if row.unsubscribed_at else None,
        "source": row.source,
        "createdAt": row.created_at.isoformat(),
    }


@router.get("/newsletter")
async def list_subscribers(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    state: Annotated[str, Query()] = "all",
    frequency: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
) -> dict:
    """The subscriber list.

    Read-only, on purpose. Every state transition a subscriber can undergo is
    theirs to make — confirm, unsubscribe, change cadence — and each is already
    authorised by a token they hold. An admin endpoint that could set
    `confirmed_at` would be a way to add consent on someone else's behalf,
    which is the single thing double opt-in exists to prevent.

    `counts` covers the whole table rather than the current filter, so the tabs
    carry real totals without four extra round trips.
    """
    _private(response)
    page_size = 50

    if state not in NEWSLETTER_STATES:
        state = "all"

    base = _newsletter_filter(select(NewsletterSubscriber), state)
    if frequency in NEWSLETTER_FREQUENCIES:
        base = base.where(NewsletterSubscriber.frequency == frequency)

    term = (q or "").strip()
    if term:
        base = base.where(
            NewsletterSubscriber.email.ilike(like_contains(term), escape="\\")
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(NewsletterSubscriber.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    # Four counts over the same table with different predicates. Ridden as
    # scalar subqueries on one statement rather than awaited in sequence: the
    # session holds a single connection, so four awaits are four round trips.
    def count_of(name: str):
        return _newsletter_filter(
            select(func.count()).select_from(NewsletterSubscriber), name
        ).scalar_subquery()

    all_c, pending_c, confirmed_c, unsub_c = (
        await db.execute(
            select(
                count_of("all"),
                count_of("pending"),
                count_of("confirmed"),
                count_of("unsubscribed"),
            )
        )
    ).one()

    return {
        "items": [_newsletter_out(r) for r in rows],
        "counts": {
            "all": all_c,
            "pending": pending_c,
            "confirmed": confirmed_c,
            "unsubscribed": unsub_c,
        },
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


@router.get("/newsletter/export")
async def export_subscribers(
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    state: Annotated[str, Query()] = "confirmed",
) -> Response:
    """The list as CSV, for handing to a provider.

    This is the escape hatch that keeps the reasoning in
    docs/10-newsletter-email.md honest: the list lives in our database rather
    than a platform's, so moving it — into Brevo's contacts, into a different
    provider, into a spreadsheet — has to be one click and not a database
    session.

    Defaults to `confirmed`. Exporting the pending rows and uploading them
    somewhere that mails them is precisely how a double opt-in list quietly
    becomes a single opt-in one, so the safe set is the default and anything
    wider is a deliberate query parameter.

    Audited, because it is a bulk read of every address the site holds — the
    kind of action worth being able to point at afterwards.
    """
    if state not in NEWSLETTER_STATES:
        state = "confirmed"

    rows = (
        await db.execute(
            _newsletter_filter(select(NewsletterSubscriber), state).order_by(
                NewsletterSubscriber.created_at.asc()
            )
        )
    ).scalars().all()

    await audit.record(
        db,
        actor_id=admin.id,
        action="newsletter.export",
        entity_type="newsletter",
        summary=f"Exported {len(rows)} {state} subscriber(s)",
        ip_address=client_ip(request),
    )

    buffer = io.StringIO()
    # QUOTE_ALL and CRLF: this file is machine input for whatever imports it
    # next, and one comma inside a `source` value is enough to shift every
    # column of an unquoted row.
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(["email", "frequency", "state", "confirmed_at", "source", "created_at"])
    for row in rows:
        writer.writerow(
            [
                row.email,
                row.frequency,
                _newsletter_state(row),
                row.confirmed_at.isoformat() if row.confirmed_at else "",
                row.source or "",
                row.created_at.isoformat(),
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="sortedchoice-newsletter-{state}.csv"',
            "Cache-Control": "no-store, private",
        },
    )


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
    if q and q.strip():
        # Escaped like every other search in this file. Unescaped, a `%` typed
        # into the box matched every profile — and a term made of nothing but
        # wildcards is a table scan an admin can trigger by accident.
        pattern = like_contains(q)
        base = base.where(
            or_(
                Profile.display_name.ilike(pattern, escape="\\"),
                Profile.email.ilike(pattern, escape="\\"),
            )
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


# --------------------------------------------------------------------------- #
# Newsletter campaigns                                                        #
#                                                                             #
# The list has been collecting confirmed addresses, with a cadence choice,     #
# since the signup form shipped, and nothing has ever been sent to it. These   #
# endpoints are the missing half.                                             #
#                                                                             #
# Note what is absent: any route that schedules a send. A campaign goes out    #
# because a person pressed Send, for the same reason a price run happens       #
# because a person pressed Check - an unattended process that speaks in our    #
# name can be wrong in our name, and a digest cannot be recalled.              #
# --------------------------------------------------------------------------- #


class CampaignWrite(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    subject: str
    intro: str | None = None
    audience: Literal["all", "daily", "weekly", "deals_only"] = "weekly"
    product_ids: list[uuid.UUID] = []


def _campaign_out(c: NewsletterCampaign, audience_size: int | None = None) -> dict:
    return {
        "id": str(c.id),
        "subject": c.subject,
        "intro": c.intro,
        "audience": c.audience,
        "productIds": [str(p) for p in c.product_ids],
        "status": c.status,
        "recipientCount": c.recipient_count,
        "sentCount": c.sent_count,
        "failedCount": c.failed_count,
        "createdAt": c.created_at.isoformat() if c.created_at else None,
        "startedAt": c.started_at.isoformat() if c.started_at else None,
        "finishedAt": c.finished_at.isoformat() if c.finished_at else None,
        "error": c.error,
        **({"audienceSize": audience_size} if audience_size is not None else {}),
    }


@router.get("/newsletter/campaigns")
async def list_campaigns(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    """Every campaign, newest first, plus today's remaining send budget.

    The headroom is returned with the list rather than only on the send screen,
    because "why did that stop at 180?" is a question the list is where someone
    asks it.
    """
    response.headers["Cache-Control"] = "no-store"
    rows = (
        (
            await db.execute(
                select(NewsletterCampaign)
                .order_by(NewsletterCampaign.created_at.desc())
                .limit(50)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [_campaign_out(c) for c in rows],
        "headroom": await newsletter_send.headroom(db),
        "dailyCeiling": newsletter_send.DAILY_CEILING,
    }


@router.post("/newsletter/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: Annotated[CampaignWrite, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    campaign = NewsletterCampaign(
        subject=payload.subject.strip(),
        intro=(payload.intro or "").strip() or None,
        audience=payload.audience,
        product_ids=payload.product_ids,
        created_by=admin.id,
    )
    db.add(campaign)
    await db.flush()
    await audit.record(
        db,
        actor_id=admin.id,
        action="newsletter.campaign.create",
        entity_type="newsletter_campaign",
        entity_id=campaign.id,
        summary=f"Drafted a campaign: {campaign.subject}",
        ip_address=client_ip(request),
    )
    return _campaign_out(campaign, await newsletter_send.count_audience(db, campaign))


@router.patch("/newsletter/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: Annotated[CampaignWrite, Body()],
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    """Edit a draft.

    Drafts only, and deliberately so: once a send has started, some subscribers
    already hold the old copy in their inbox and no edit here can reach them.
    Allowing it would produce one campaign that said two different things.
    """
    campaign = await db.get(NewsletterCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This campaign has already started sending, so its content is fixed.",
        )

    campaign.subject = payload.subject.strip()
    campaign.intro = (payload.intro or "").strip() or None
    campaign.audience = payload.audience
    campaign.product_ids = payload.product_ids
    await db.flush()
    return _campaign_out(campaign, await newsletter_send.count_audience(db, campaign))


@router.delete("/newsletter/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: uuid.UUID, admin: CurrentAdmin, db: DbSession) -> None:
    """Discard a draft. Anything that has sent is kept as a record."""
    campaign = await db.get(NewsletterCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A campaign that has been sent is a record of what people received.",
        )
    await db.delete(campaign)


@router.get("/newsletter/campaigns/{campaign_id}/preview")
async def preview_campaign(campaign_id: uuid.UUID, admin: CurrentAdmin, db: DbSession) -> dict:
    """The exact HTML a subscriber would receive.

    Rendered through the same function the send uses, with a placeholder
    unsubscribe link. A preview built by a second code path is a preview of
    something nobody gets.
    """
    campaign = await db.get(NewsletterCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")

    products = []
    if campaign.product_ids:
        found = (
            (
                await db.execute(
                    select(Product)
                    .options(selectinload(Product.category), selectinload(Product.brand))
                    .where(
                        Product.id.in_(campaign.product_ids),
                        Product.status == "published",
                    )
                )
            )
            .unique()
            .scalars()
            .all()
        )
        by_id = {p.id: p for p in found}
        products = [by_id[pid] for pid in campaign.product_ids if pid in by_id]

    picks_html, _ = newsletter_send.build_picks(products)
    html = render(
        "newsletter_digest",
        raw={"Picks": picks_html},
        Subject=campaign.subject,
        Intro=campaign.intro or "",
        UnsubscribeURL="#preview",
    )
    return {
        "html": html,
        "audienceSize": await newsletter_send.count_audience(db, campaign),
        # Named so the editor can see which picks were dropped for being
        # unpublished, rather than wondering why the email is shorter.
        "included": len(products),
        "picked": len(campaign.product_ids),
    }


@router.post("/newsletter/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    """Send one batch. Press again to continue.

    Batched rather than fire-and-forget because the daily ceiling is shared with
    transactional mail and a list can exceed it - so a send is a sequence of
    deliberate steps with a visible count, not a button that means "and now
    hope". See newsletter_send for the ceiling arithmetic.
    """
    campaign = await db.get(NewsletterCampaign, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if campaign.status in ("sent", "failed"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This campaign is finished.")

    first = campaign.status == "draft"
    result = await newsletter_send.send_batch(db, campaign)
    await db.flush()

    if first:
        await audit.record(
            db,
            actor_id=admin.id,
            action="newsletter.campaign.send",
            entity_type="newsletter_campaign",
            entity_id=campaign.id,
            summary=f"Started sending to {campaign.audience}: {campaign.subject}",
            ip_address=client_ip(request),
        )

    return {**_campaign_out(campaign), **result, "headroom": await newsletter_send.headroom(db)}


# --------------------------------------------------------------------------- #
# Mail settings                                                               #
#                                                                             #
# Turning sending off used to need a deploy, which is the worst possible       #
# requirement at the moment you actually want it: a bad campaign going out, a  #
# provider incident, a domain that has just been flagged. Same argument        #
# `pricing_settings` makes for the scraper.                                   #
#                                                                             #
# The API key can be set here and is NEVER returned. See                       #
# app/core/mail_settings.py for how it is stored and why.                      #
# --------------------------------------------------------------------------- #


class MailSettingsWrite(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    #: None means "follow the environment" — a real third state, not "off".
    provider: Literal["brevo", "console", "disabled"] | None = None
    from_email: str | None = None
    from_name: str | None = None
    reply_to: str | None = None
    #: Omit or send empty to leave the stored key untouched. Saving the form
    #: must not be able to wipe a working key by accident.
    api_key: str | None = None


async def _mail_row(db: DbSession) -> MailSettings:
    row = (await db.execute(select(MailSettings).limit(1))).scalar_one_or_none()
    if row is None:
        row = MailSettings(id=True)
        db.add(row)
        await db.flush()
    return row


@router.get("/mail-settings")
async def get_mail_settings(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    """What is configured, and what is actually in force.

    Returns both, because they can differ: a null `provider` here means the
    environment is deciding, and an editor needs to see WHICH value is live
    before changing a field that is not the one taking effect.

    The key is never returned in any form beyond its last four characters —
    enough to tell two keys apart, not enough to use one.
    """
    response.headers["Cache-Control"] = "no-store"
    row = await _mail_row(db)
    effective = await mail_settings.resolve(db)

    return {
        "provider": row.provider,
        "fromEmail": row.from_email,
        "fromName": row.from_name,
        "replyTo": row.reply_to,
        "apiKeySet": bool(row.api_key_ciphertext),
        "apiKeyLast4": row.api_key_last4,
        "effective": {
            "provider": effective.provider,
            "fromEmail": effective.from_email,
            "fromName": effective.from_name,
            "delivers": effective.provider in ("brevo", "console"),
            "source": "database" if effective.from_database else "environment",
            # The one combination that boots fine and fails on every send.
            "keyMissing": effective.provider == "brevo" and not effective.api_key,
        },
        "envProvider": settings.MAIL_PROVIDER,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.put("/mail-settings")
async def update_mail_settings(
    payload: Annotated[MailSettingsWrite, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    """Change what is in force, without a deploy."""
    row = await _mail_row(db)

    row.provider = payload.provider
    row.from_email = (payload.from_email or "").strip() or None
    row.from_name = (payload.from_name or "").strip() or None
    row.reply_to = (payload.reply_to or "").strip() or None

    key = (payload.api_key or "").strip()
    if key:
        encrypted = mail_settings.encrypt_key(key)
        if encrypted is None:
            # Refuse rather than store a secret in the clear. Without
            # SUPABASE_JWT_SECRET there is nothing to encrypt with, and a
            # plaintext fallback is exactly the shortcut this must not take.
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Cannot store a key: SUPABASE_JWT_SECRET is not set on the API.",
            )
        row.api_key_ciphertext, row.api_key_last4 = encrypted

    row.updated_by = admin.id
    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="mail.settings.update",
        entity_type="mail_settings",
        entity_id=None,
        # Deliberately records the switch and not the secret. An audit log that
        # quotes an API key is a second place the key lives.
        summary=(
            f"Mail provider set to {row.provider or 'follow environment'}"
            + (", key replaced" if key else "")
        ),
        ip_address=client_ip(request),
    )

    return await get_mail_settings(admin, db, Response())
