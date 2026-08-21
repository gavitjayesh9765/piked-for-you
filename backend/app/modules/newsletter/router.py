"""
Newsletter subscription (double opt-in).

Two rules shape this module:

  * **The response never reveals whether an address is already subscribed.**
    A "you're already on the list" message turns this public, unauthenticated
    endpoint into an account-enumeration oracle. Every well-formed request gets
    the same answer.

  * **Nothing is sent until the confirmation link is clicked.** The row exists
    from the moment of request, but `confirmed_at` gates every send.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel

from app.core.deps import DbSession

router = APIRouter()

NEXT_PASS = HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Next pass")

NewsletterFrequency = Literal["daily", "weekly", "deals_only"]


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
async def subscribe(
    payload: Annotated[SubscribeRequest, Body()], request: Request, db: DbSession
) -> SubscribeResponse:
    """Create or update a subscription and send a confirmation email.

    Must: rate-limit by IP, generate `confirmation_token` and
    `unsubscribe_token` with `secrets.token_urlsafe`, record consent
    provenance, and return the same response for new and existing addresses.
    """
    raise NEXT_PASS


@router.get("/confirm", response_model=SubscribeResponse)
async def confirm(
    db: DbSession, token: Annotated[str, Query(min_length=16, max_length=64)]
) -> SubscribeResponse:
    """Complete double opt-in. Sets `confirmed_at` and clears the token so the
    link cannot be replayed."""
    raise NEXT_PASS


@router.get("/unsubscribe", response_model=SubscribeResponse)
async def unsubscribe(
    db: DbSession, token: Annotated[str, Query(min_length=16, max_length=64)]
) -> SubscribeResponse:
    """One-click unsubscribe, no login required — the token is the authorization.

    Kept as a GET so it works directly from an email client and satisfies
    `List-Unsubscribe`.
    """
    raise NEXT_PASS


@router.patch("/preferences", response_model=SubscribeResponse)
async def update_frequency(
    db: DbSession,
    token: Annotated[str, Query(min_length=16, max_length=64)],
    frequency: Annotated[NewsletterFrequency, Body(embed=True)],
) -> SubscribeResponse:
    """Change cadence without unsubscribing — the escape valve that stops
    "too many emails" from becoming a permanent opt-out."""
    raise NEXT_PASS
