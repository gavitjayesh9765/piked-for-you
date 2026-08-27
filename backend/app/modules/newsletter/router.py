"""
Newsletter subscription (double opt-in).

Two rules shape this module:

  * **The response never reveals whether an address is already subscribed.**
    A "you're already on the list" message turns this public, unauthenticated
    endpoint into an account-enumeration oracle. Every well-formed request gets
    the same answer.

  * **Nothing is sent until the confirmation link is clicked.** The row exists
    from the moment of request, but `confirmed_at` gates every send.

The confirmation mail goes out through `app/core/mail.py`. Two details there
that this module depends on:

  * **`confirmation_sent_at` is set only after the provider accepts the
    message.** It means "a confirmation is in flight", not "we tried". Leaving
    it NULL on failure is what makes re-submitting the address a working retry
    rather than a no-op.

  * **A delivery failure does not change the response.** It is logged and the
    endpoint still returns 202. Surfacing it would hand back a signal that
    varies with the recipient — the enumeration oracle this module exists to
    close, rebuilt out of error codes.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Body, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import DbSession, client_ip
from app.core.limiter import WRITE, limiter
from app.core.mail import MailDeliveryError, MailMessage, get_transport
from app.emails import NEWSLETTER_CONFIRMATION_SUBJECT, render
from app.models import NewsletterSubscriber

logger = logging.getLogger(__name__)

router = APIRouter()

NewsletterFrequency = Literal["daily", "weekly", "deals_only"]

# 32 bytes from `secrets` — unguessable, and the only authorization the
# confirm/unsubscribe links carry.
TOKEN_BYTES = 32


def _token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# What the cadence is called in a sentence. The stored values are the send
# job's filter keys, not English — "deals_only" in a subscriber's inbox reads
# like a leaked column name.
_CADENCE_WORDS: dict[str, str] = {
    "daily": "daily",
    "weekly": "weekly",
    "deals_only": "deals only",
}


def _confirm_url(token: str) -> str:
    """Point at the FRONTEND, not this API.

    The API's own /confirm returns JSON. A subscriber who clicks a link to it
    gets `{"accepted":true}` on a white page, which is indistinguishable from
    a broken site. The page at SITE_URL calls this endpoint and says something.

    `urlencode` rather than an f-string: the token is `secrets.token_urlsafe`,
    so today it needs no escaping, and relying on that is how a change to
    TOKEN_BYTES or the alphabet later produces links that silently truncate.
    """
    return f"{settings.SITE_URL}/newsletter/confirm?{urlencode({'token': token})}"


async def _send_confirmation(email: str, token: str, frequency: str) -> bool:
    """Send the double opt-in mail. True if the provider accepted it.

    Never raises. The caller is a public endpoint whose entire contract is
    that its response does not vary with the recipient, so there is nothing
    useful it could do with an exception except leak that it happened.
    """
    transport = get_transport()

    # `MAIL_PROVIDER=disabled` while the list is being built. Returning False
    # here rather than letting NullTransport's silent success fall through is
    # what keeps `confirmation_sent_at` NULL for everyone collected during that
    # period — so when mail is switched on, "who has never been asked to
    # confirm?" is still a question the column can answer. Nothing is rendered
    # either, because rendering a confirmation URL nobody will receive only
    # burns a token.
    if not transport.delivers:
        return False

    url = _confirm_url(token)
    cadence = _CADENCE_WORDS.get(frequency, frequency)

    try:
        html = render(
            "newsletter_confirmation",
            ConfirmURL=url,
            Frequency=cadence,
        )
    except Exception:
        # A template fault is our bug, not this subscriber's. Log it loudly —
        # it breaks every signup, not one.
        logger.exception("newsletter confirmation template failed to render")
        return False

    text = (
        "Confirm your SortedChoice newsletter subscription\n\n"
        f"Someone asked for the SortedChoice newsletter at this address, on the {cadence} "
        "cadence. Confirm it here:\n\n"
        f"{url}\n\n"
        "This link works once and expires in 24 hours. If you did not ask for this, "
        "ignore this email - nothing further is sent to an address that never confirms.\n"
    )

    try:
        await transport.send(
            MailMessage(
                to=email,
                subject=NEWSLETTER_CONFIRMATION_SUBJECT,
                html=html,
                text=text,
            )
        )
    except MailDeliveryError:
        # Address deliberately absent from the log line. This is the one place
        # that knows an address was submitted, and an unconfirmed address is
        # not something a subscriber consented to have recorded in plain text
        # in an aggregator.
        logger.warning("newsletter confirmation not delivered", exc_info=True)
        return False
    except Exception:
        logger.exception("unexpected failure sending newsletter confirmation")
        return False

    return True


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

    #: Is a confirmation mail actually being sent right now?
    #:
    #: A GLOBAL fact about the deployment, read from `MAIL_PROVIDER` — never a
    #: per-recipient one. That distinction is the whole reason this field is
    #: safe to expose. "Did we mail YOU?" varies with whether the address was
    #: already confirmed, so answering it would rebuild the enumeration oracle
    #: this module is built to close. "Is mail switched on at all?" is the same
    #: answer for every caller and reveals nothing about anybody.
    #:
    #: It exists because the signup form said "We've sent a confirmation to
    #: <address>" unconditionally, and with `MAIL_PROVIDER=disabled` — the
    #: current state while the list is being collected — that is simply untrue.
    #: A reader who then waits for an email that will never arrive concludes the
    #: site is broken and does not come back.
    mail_enabled: bool = True


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

    # Both branches below set these; the already-confirmed branch does not,
    # and that is what decides whether a mail goes out.
    row: NewsletterSubscriber | None = None
    token: str | None = None

    if existing is None:
        token = _token()
        row = NewsletterSubscriber(
            email=email,
            frequency=payload.frequency,
            confirmation_token=token,
            unsubscribe_token=_token(),
            source="site",
            # Consent provenance. Never used for authorization — see
            # `client_ip`, which is explicit that XFF is caller-controlled.
            signup_ip=client_ip(request),
        )
        db.add(row)
    elif existing.confirmed_at is None:
        # An unconfirmed row already exists: this is a re-request, not a new
        # subscription. Roll the token so an old link stops working.
        token = _token()
        existing.confirmation_token = token
        existing.frequency = payload.frequency
        row = existing
    else:
        # Already confirmed. Nothing to do, and *saying* nothing to do is the
        # point — fall through to the same response as a fresh signup. In
        # particular NO mail is sent: a confirmed subscriber who is re-added
        # by someone else's typo must not get a second confirmation, and an
        # attacker probing the list must not be able to make one arrive.
        pass

    # Set only on success. NULL here means "no confirmation is in flight",
    # which is exactly the state that makes re-submitting the address work
    # instead of appearing to succeed while nothing was ever sent.
    if row is not None and token is not None and await _send_confirmation(
        email, token, payload.frequency
    ):
        row.confirmation_sent_at = _now()

    return SubscribeResponse(mail_enabled=get_transport().delivers)


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
