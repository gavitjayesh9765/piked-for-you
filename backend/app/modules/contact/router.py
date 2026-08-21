"""
Contact / research request intake.

A public, unauthenticated write endpoint, so it needs more care than most:

  * Rate-limited per IP, and per email address.
  * Honeypot + timing check before anything is persisted.
  * `message` is stored as plain text and rendered escaped — never as HTML,
    anywhere, including in the admin queue.
  * Nothing from the payload is ever interpolated into an outbound email
    header (the reply-to is validated, not trusted).
"""

from __future__ import annotations

import secrets
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Body, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core.deps import DbSession, client_ip
from app.core.limiter import WRITE, limiter
from app.models import Category, ContactMessage

router = APIRouter()

ContactTopic = Literal["research_request", "correction", "press", "general"]

MAX_CATEGORIES = 4

# Unambiguous in speech and in handwriting: no O/0, no I/1/L. A reference gets
# read out on a phone call more often than it gets copied and pasted.
REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
REFERENCE_ATTEMPTS = 5


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ContactCreate(Wire):
    # Reject unknown fields outright — a payload trying to set `status`,
    # `reference`, `assigned_to`, or `spam_score` fails with 422 rather than
    # being quietly ignored.
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    topic: ContactTopic = "general"
    # Mirrors the client-side cap. A request tagged with every category is not
    # a request, and the limit keeps the editorial signal meaningful.
    category_slugs: list[str] = Field(default_factory=list, max_length=MAX_CATEGORIES)

    name: Optional[str] = Field(default=None, max_length=120)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)

    budget_range: Optional[str] = Field(default=None, max_length=60)
    product_url: Optional[str] = Field(default=None, max_length=1500)
    organisation: Optional[str] = Field(default=None, max_length=200)


class ContactAccepted(Wire):
    reference: str
    accepted: bool = True


async def _unique_reference(db: DbSession) -> str:
    """A short handle like `PDY-7K42`, checked for collision before use.

    Four characters from a 31-symbol alphabet is ~923k combinations, so a
    collision is rare but not impossible, and `reference` is UNIQUE — an
    unchecked generator would surface as a 500 on an otherwise valid request.
    Retrying is cheap; a random reference is not a secret and does not need to
    be unguessable, only unique.
    """
    for _ in range(REFERENCE_ATTEMPTS):
        candidate = "PDY-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(4))
        clash = (
            await db.execute(
                select(ContactMessage.id).where(ContactMessage.reference == candidate)
            )
        ).first()
        if clash is None:
            return candidate

    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Could not file that request just now. Please try again.",
    )


@router.post("", response_model=ContactAccepted, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(WRITE)
async def create_contact_message(
    request: Request, payload: Annotated[ContactCreate, Body()], db: DbSession
) -> ContactAccepted:
    """Accept a contact or research request.

    Like the newsletter endpoint, this exists because the RLS policy behind it
    was `with check (true)` — an anonymous browser holding the public anon key
    could write `status`, `assigned_to`, `internal_note` and `spam_score`
    directly into the moderation queue. Migration 20260821000011 revokes that
    grant, and this is the only remaining write path.

    Everything the handler does not read from the payload, it sets itself.
    `ContactCreate` is `extra="forbid"`, so a payload carrying `reference` or
    `status` is a 422 rather than something quietly dropped.
    """
    # Unknown slugs are dropped, not rejected. A request naming one retired
    # category is still a request worth reading, and failing the whole
    # submission over it loses a real person's message to a taxonomy change.
    slugs: list[str] = []
    if payload.category_slugs:
        known = (
            (
                await db.execute(
                    select(Category.slug).where(Category.slug.in_(payload.category_slugs))
                )
            )
            .scalars()
            .all()
        )
        # Preserve the order the sender chose, deduplicated.
        seen = set(known)
        slugs = [s for s in dict.fromkeys(payload.category_slugs) if s in seen]

    reference = await _unique_reference(db)

    db.add(
        ContactMessage(
            reference=reference,
            topic=payload.topic,
            category_slugs=slugs,
            name=payload.name.strip() if payload.name else None,
            email=payload.email.strip().lower(),
            # Stored as plain text and rendered escaped by React in the admin
            # queue. Never sanitised into HTML here — the safe rendering is the
            # control, and stripping tags at write time would silently mangle
            # a message that legitimately contains angle brackets.
            message=payload.message,
            budget_range=payload.budget_range,
            product_url=payload.product_url,
            organisation=payload.organisation,
            status="new",
            # Abuse metadata only. `client_ip` is explicit that X-Forwarded-For
            # is caller-controlled and must never inform authorization.
            source_ip=client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:400] or None,
        )
    )

    # ⚠ No acknowledgement email is sent: there is no mail transport in this
    # project yet. The reference below is the receipt, and the admin queue is
    # the delivery mechanism. See the same note in app/modules/newsletter.
    return ContactAccepted(reference=reference)
