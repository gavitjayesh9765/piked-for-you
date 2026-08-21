"""Community reviews, their media, and moderation (spec §28–§31).

Mirrors supabase/migrations/20260820000001_init_schema.sql, which is the
source of truth for the schema. Row Level Security enforces ownership at the
database as well — see 20260820000002_rls_policies.sql.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Review(UUIDMixin, TimestampMixin, Base):
    """A user review (spec §28).

    Note the absence of an `is_verified_buyer` column: there is no purchase
    verification mechanism, so the schema offers no place to claim one (§31).
    """

    __tablename__ = "reviews"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # --- Moderation (spec §30) ---
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    # References auth.users, which lives outside our metadata — plain UUID, with
    # the FK declared in SQL rather than here.
    moderated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    moderated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    moderation_note: Mapped[Optional[str]] = mapped_column(Text)

    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="reviews")  # noqa: F821
    user: Mapped["Profile"] = relationship(back_populates="reviews")  # noqa: F821
    media: Mapped[list["ReviewMedia"]] = relationship(
        back_populates="review", cascade="all, delete-orphan"
    )
    reports: Mapped[list["ReviewReport"]] = relationship(
        back_populates="review", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="reviews_rating_range"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'hidden', 'reported')",
            name="reviews_status_valid",
        ),
        # One review per user per product — otherwise the community average is
        # trivially gameable.
        UniqueConstraint("product_id", "user_id", name="reviews_one_per_user"),
        Index("ix_reviews_product_status", "product_id", "status"),
    )


class ReviewMedia(UUIDMixin, TimestampMixin, Base):
    """User-uploaded review media (spec §29).

    All of this is untrusted input. The 30-second cap and every other limit are
    validated server-side against the actual decoded file, not the client's
    claim about it (spec §46) — and the cap is *also* a CHECK constraint.
    """

    __tablename__ = "review_media"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    # Object key in the private `review-media` bucket. Never a public URL —
    # access is minted as a short-lived signed URL at read time.
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1000))

    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    moderation_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    review: Mapped["Review"] = relationship(back_populates="media")

    __table_args__ = (
        CheckConstraint("kind IN ('image', 'video')", name="review_media_kind_valid"),
        CheckConstraint(
            "kind <> 'video' OR (duration_seconds IS NOT NULL AND duration_seconds <= 30)",
            name="review_media_video_max_30s",
        ),
    )


class ReviewReport(UUIDMixin, TimestampMixin, Base):
    """User reports on a review (spec §30).

    Write-only for users: RLS grants insert but no select, so a reporter cannot
    read other people's reports or see how theirs was resolved.
    """

    __tablename__ = "review_reports"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL")
    )
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    review: Mapped["Review"] = relationship(back_populates="reports")

    __table_args__ = (
        CheckConstraint(
            "reason IN ('spam', 'fake', 'offensive', 'irrelevant', 'promotional', 'inappropriate_media')",
            name="review_reports_reason_valid",
        ),
        UniqueConstraint("review_id", "reporter_id", name="review_reports_one_per_user"),
    )
