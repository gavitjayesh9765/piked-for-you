"""Inbound contact and research requests (supports the /contact page).

Treated as a first-class content entity rather than a mail relay: a research
request is a signal about what the audience wants covered next, and that is
worth querying — "which categories are people asking about?" is a genuinely
useful editorial question.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ContactMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "contact_messages"

    # Short, human-quotable handle (e.g. "PDY-7K42") so a reply thread can
    # reference the original request without exposing the UUID.
    reference: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)

    topic: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # Category slugs rather than FKs: a request may name a category that is
    # later renamed or removed, and the request should survive that. This is
    # captured intent, not a live relationship.
    category_slugs: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    name: Mapped[Optional[str]] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # --- Topic-conditional fields ---
    budget_range: Mapped[Optional[str]] = mapped_column(String(60))
    product_url: Mapped[Optional[str]] = mapped_column(String(1500))
    organisation: Mapped[Optional[str]] = mapped_column(String(200))

    # --- Handling ---
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    # References auth.users — plain UUID, FK declared in SQL.
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    answered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    internal_note: Mapped[Optional[str]] = mapped_column(Text)

    # --- Abuse controls (public unauthenticated endpoint) ---
    source_ip: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(String(400))
    spam_score: Mapped[Optional[int]] = mapped_column()

    __table_args__ = (
        CheckConstraint(
            "topic IN ('research_request', 'correction', 'press', 'general')",
            name="contact_topic_valid",
        ),
        CheckConstraint(
            "status IN ('new', 'in_progress', 'answered', 'closed')", name="contact_status_valid"
        ),
        # The queue view: oldest unhandled first, per topic.
        Index("ix_contact_queue", "status", "topic", "created_at"),
    )
