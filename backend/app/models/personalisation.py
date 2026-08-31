"""Saved products, preferences, and helpful votes.

Mirrors supabase/migrations/20260820000004_user_features.sql.

Privacy note carried through from the RLS: a user's shortlist and interests are
private to them. There is no admin read policy on these tables — aggregate
reporting requires explicit service-role code, not ambient access.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SavedProduct(UUIDMixin, Base):
    """A product on someone's shortlist.

    Deliberately not a "cart": SortedChoice sells nothing (spec §56). This is a
    research shortlist — things you are still deciding between.
    """

    __tablename__ = "saved_products"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(Text)

    # --- Price-drop alerts. See migration 20260831000020 for the reasoning. ---
    #
    # `price_at_save` is the figure the reader was looking at when they pressed
    # Save, which is the only baseline "tell me if it drops" can honestly mean.
    # `alerted_price` moves the baseline down to whatever the last alert quoted,
    # so a second price run does not re-send the same news.
    price_at_save: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    alerted_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    alerted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product: Mapped["Product"] = relationship()  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="saved_products_once"),
        Index("saved_products_user_idx", "user_id", "created_at"),
        # The alert query filters by product across many users, which the
        # per-user index above does not serve.
        Index("saved_products_product_idx", "product_id"),
    )


class UserPreferences(TimestampMixin, Base):
    """What this person is actually shopping for.

    Feeds a personalised homepage rail today, and the "what should I buy?"
    engine later (spec §57–§58). Notification flags default to False —
    consent is given, never assumed.
    """

    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )

    # Read as a whole set, never queried individually, and bounded by CHECK
    # constraints — so an array beats a join table here.
    category_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    brand_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    budget_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    budget_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    use_case: Mapped[Optional[str]] = mapped_column(Text)

    notify_price_drops: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_new_picks: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max",
            name="user_preferences_budget_ordered",
        ),
    )


class ReviewHelpfulVote(Base):
    """One vote per person per review — enforced by the composite primary key
    rather than a check-then-insert race."""

    __tablename__ = "review_helpful_votes"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
