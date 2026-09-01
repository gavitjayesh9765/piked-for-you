"""Newsletter subscriptions.

Double opt-in by design: a row is created on request but stays unconfirmed
until the emailed token is used. Nothing is ever sent to an address that has
not proven it wants mail — which is both the legal posture and the only way a
research publication keeps its sender reputation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET, UUID
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


class NewsletterCampaign(UUIDMixin, Base):
    """One editor-composed digest.

    Mirrors supabase/migrations/20260831000021_newsletter_campaigns.sql, where
    the reasoning lives. The short version: a campaign is written and sent by a
    person, never generated on a schedule, for the same reason a price run is —
    an unattended process that speaks in our name can be wrong in our name.
    """

    __tablename__ = "newsletter_campaigns"

    subject: Mapped[str] = mapped_column(Text, nullable=False)
    intro: Mapped[Optional[str]] = mapped_column(Text)

    #: 'all' | 'daily' | 'weekly' | 'deals_only' — the last three match
    #: `NewsletterSubscriber.frequency` exactly. A segment that does not
    #: correspond to something a subscriber chose is one we have no consent for.
    audience: Mapped[str] = mapped_column(String(20), default="weekly", nullable=False)

    #: Ordered and hand-picked. The order is the editor's argument.
    product_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), default=list, nullable=False
    )

    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    #: Fixed when sending starts, so a subscriber who joins mid-send is not
    #: silently folded into a campaign they saw no beginning of.
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "audience IN ('all', 'daily', 'weekly', 'deals_only')",
            name="newsletter_campaigns_audience_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'sending', 'paused', 'sent', 'failed')",
            name="newsletter_campaigns_status_valid",
        ),
        Index("newsletter_campaigns_status_idx", "status", "created_at"),
    )


class NewsletterCampaignSend(Base):
    """Proof that one subscriber was mailed one campaign.

    The composite primary key is the whole point: sending is resumable because
    Brevo's daily ceiling is shared with every transactional mail, and resumable
    sending is only safe if a second attempt cannot mail anyone twice.
    """

    __tablename__ = "newsletter_campaign_sends"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("newsletter_campaigns.id", ondelete="CASCADE"),
        primary_key=True,
    )
    subscriber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("newsletter_subscribers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MailSettings(Base):
    """Operational mail switches, editable in the admin panel.

    A singleton, the same shape `pricing_settings` uses and for the same reason:
    these are knobs someone turns during an incident, and an editor cannot
    deploy. See app/core/mail_settings.py for why `provider` is nullable and why
    the key is stored encrypted and never returned.
    """

    __tablename__ = "mail_settings"

    id: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True)

    #: NULL means "follow MAIL_PROVIDER". Not the same state as 'disabled'.
    provider: Mapped[Optional[str]] = mapped_column(String(20))
    from_email: Mapped[Optional[str]] = mapped_column(String(320))
    from_name: Mapped[Optional[str]] = mapped_column(String(120))
    reply_to: Mapped[Optional[str]] = mapped_column(String(320))

    #: Fernet token. Never leaves the server; the admin API returns only
    #: `api_key_last4` and whether one is set.
    api_key_ciphertext: Mapped[Optional[str]] = mapped_column(Text)
    api_key_last4: Mapped[Optional[str]] = mapped_column(String(8))

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
