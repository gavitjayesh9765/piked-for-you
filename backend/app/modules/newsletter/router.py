"""
Newsletter subscription (double opt-in).

Two rules shape this module:

  * **The response never reveals whether an address is already subscribed.**
    A "you're already on the list" message turns this public, unauthenticated
    endpoint into an account-enumeration oracle. Every well-formed request gets
    the same answer.

  * **Nothing is sent until the confirmation link is clicked.** The row exists
    from the moment of request, but `confirmed_at` gates every send.

⚠ NOT IMPLEMENTED HERE: actually sending the confirmation email. There is no
mail transport in this project yet, so `confirmation_sent_at` records that a
send was *due*, and no message goes out. The consequence is that a subscriber
cannot self-confirm — rows accumulate unconfirmed, and the send job (which
filters on `confirmed_at`) will correctly find nobody. That is the safe failure
direction, and it is deliberate: this module was rewritten to close a database
hole (see migration 20260821000011), not to ship email. Wire a transport into
`subscribe()` and `confirm()` starts working with no other change.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core.deps import DbSession, client_ip
from app.core.limiter import WRITE, limiter
from app.models import NewsletterSubscriber

router = APIRouter()

NewsletterFrequency = Literal["daily", "weekly", "deals_only"]

# 32 bytes from `secrets` — unguessable, and the only authorization the
# confirm/unsubscribe links carry.
TOKEN_BYTES = 32


def _token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SubscribeRequest(Wire):
    # Reject unknown fields: nothing may set `confirmed_at`, `is_active`, or
    # either token from outside.
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    email: EmailStr
    # Defaults to the least intrusive cadence — a reader who does not choose
    # should not end up on a daily list.
    frequency: NewsletterFrequency = "deals_only"


class SubscribeResponse(Wire):
    accepted: bool = True
    confirmation_required: bool = True


@router.post("/subscribe", response_model=SubscribeResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(WRITE)
async def subscribe(
    request: Request, payload: Annotated[SubscribeRequest, Body()], db: DbSession
) -> SubscribeResponse:
    """Create or update a subscription.

    This endpoint exists because the alternative was worse. The table used to
    carry `with check (true)` for RLS insert, which meant a browser holding the
    public anon key could write any column — both tokens, `confirmed_at`,
    `signup_ip` — straight into it. And because `email` is UNIQUE with no
    select policy, the 409 on a duplicate insert answered "is this address
    subscribed?" to anyone who asked. Migration 20260821000011 revokes that
    grant; this is where the write goes instead.

    **The response is identical for a new and an existing address.** Not
    similar — identical, including the status code, including for an address
    that is already confirmed. Anything else rebuilds the same oracle in a
    politer form.
    """
    email = payload.email.strip().lower()

    existing = (
        await db.execute(
            select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
        )
    ).scalar_one_or_none()

    if existing is None:
        db.add(
            NewsletterSubscriber(
                email=email,
                frequency=payload.frequency,
                confirmation_token=_token(),
                confirmation_sent_at=_now(),
                unsubscribe_token=_token(),
                source="site",
                # Consent provenance. Never used for authorization — see
                # `client_ip`, which is explicit that XFF is caller-controlled.
                signup_ip=client_ip(request),
            )
        )
    elif existing.confirmed_at is None:
        # An unconfirmed row already exists: this is a re-request, not a new
        # subscription. Roll the token so an old link stops working, and note
        # that it was sent again.
        existing.confirmation_token = _token()
        existing.confirmation_sent_at = _now()
        existing.frequency = payload.frequency
    else:
        # Already confirmed. Nothing to do, and *saying* nothing to do is the
        # point — fall through to the same response as a fresh signup.
        pass

    return SubscribeResponse()


@router.get("/confirm", response_model=SubscribeResponse)
@limiter.limit(WRITE)
async def confirm(
    request: Request,
    db: DbSession,
    token: Annotated[str, Query(min_length=16, max_length=64)],
) -> SubscribeResponse:
    """Complete double opt-in.

    Clears the token on success, so the link is single-use: an email that sits
    in an inbox — or in a mail gateway's link-scanner log — cannot be replayed
    to re-confirm an address someone later unsubscribed.
    """
    row = (
        await db.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.confirmation_token == token
            )
        )
    ).scalar_one_or_none()

    if row is None:
        # Uniform 404 for an unknown, already-used, or malformed token. The
        # three are indistinguishable on purpose.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That link is no longer valid.")

    row.confirmed_at = _now()
    row.confirmation_token = None
    row.is_active = True
    row.unsubscribed_at = None

    return SubscribeResponse(confirmation_required=False)


@router.get("/unsubscribe", response_model=SubscribeResponse)
@limiter.limit(WRITE)
async def unsubscribe(
    request: Request,
    db: DbSession,
    token: Annotated[str, Query(min_length=16, max_length=64)],
) -> SubscribeResponse:
    """One-click unsubscribe, no login required — the token is the authorization.

    Kept as a GET so it works directly from an email client and satisfies
    `List-Unsubscribe`. The token is NOT cleared: it has to keep working, or a
    mail client that pre-fetches the link would consume the recipient's only
    way of getting off the list.

    Returns 202 whether or not the token matched. A 404 here would confirm
    which tokens are live.
    """
    row = (
        await db.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.unsubscribe_token == token
            )
        )
    ).scalar_one_or_none()

    if row is not None:
        row.is_active = False
        row.unsubscribed_at = _now()

    return SubscribeResponse(confirmation_required=False)


@router.patch("/preferences", response_model=SubscribeResponse)
@limiter.limit(WRITE)
async def update_frequency(
    request: Request,
    db: DbSession,
    token: Annotated[str, Query(min_length=16, max_length=64)],
    frequency: Annotated[NewsletterFrequency, Body(embed=True)],
) -> SubscribeResponse:
    """Change cadence without unsubscribing — the escape valve that stops
    "too many emails" from becoming a permanent opt-out.

    Authorised by the persistent unsubscribe token, which the recipient already
    holds. `frequency` is a Literal, so the only writable values are the three
    the CHECK constraint allows.
    """
    row = (
        await db.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.unsubscribe_token == token
            )
        )
    ).scalar_one_or_none()

    if row is not None:
        row.frequency = frequency

    return SubscribeResponse(confirmation_required=False)
