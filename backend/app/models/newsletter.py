"""Newsletter subscriptions.

Double opt-in by design: a row is created on request but stays unconfirmed
until the emailed token is used. Nothing is ever sent to an address that has
not proven it wants mail — which is both the legal posture and the only way a
research publication keeps its sender reputation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, String
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class NewsletterSubscriber(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "newsletter_subscribers"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)

    # Cadence is a first-class column, not a JSON preference blob: it is the
    # field the send job filters on, so it has to be queryable and indexed.
    frequency: Mapped[str] = mapped_column(String(20), default="deals_only", nullable=False)

    # --- Double opt-in ---
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    confirmation_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    confirmation_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # --- Unsubscribe ---
    # Persistent token so every email can carry a genuine one-click unsubscribe
    # link that works without the recipient logging in.
    unsubscribe_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Consent provenance — what was agreed to, and from where.
    source: Mapped[Optional[str]] = mapped_column(String(60))
    signup_ip: Mapped[Optional[str]] = mapped_column(INET)

    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "frequency IN ('daily', 'weekly', 'deals_only')", name="newsletter_frequency_valid"
        ),
        # The send job's hot path: active, confirmed subscribers on one cadence.
        Index("ix_newsletter_send", "frequency", "is_active", "confirmed_at"),
    )
