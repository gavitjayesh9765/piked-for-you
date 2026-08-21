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

from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Body, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

from app.core.deps import DbSession

router = APIRouter()

NEXT_PASS = HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Next pass")

ContactTopic = Literal["research_request", "correction", "press", "general"]

MAX_CATEGORIES = 4


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


@router.post("", response_model=ContactAccepted, status_code=status.HTTP_202_ACCEPTED)
async def create_contact_message(
    payload: Annotated[ContactCreate, Body()], request: Request, db: DbSession
) -> ContactAccepted:
    """Accept a contact or research request.

    Must: generate a short unique `reference`, drop unknown category slugs
    rather than rejecting the whole request, record IP and user-agent for abuse
    handling, and send an acknowledgement to the submitted address.
    """
    raise NEXT_PASS
