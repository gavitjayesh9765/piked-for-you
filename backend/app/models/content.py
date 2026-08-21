"""Curated content surfaces and the audit trail (spec §15, §39, §60)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TopPick(UUIDMixin, TimestampMixin, Base):
    """Admin-curated Top Picks (spec §15).

    Optional start/end dates support scheduling a seasonal set without anyone
    having to remember to switch it off.
    """

    __tablename__ = "top_picks"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    # Null collection = the global homepage Top Picks list. A named collection
    # lets a category or campaign have its own curated set.
    collection: Mapped[Optional[str]] = mapped_column(String(80), index=True)

    title: Mapped[Optional[str]] = mapped_column(String(200))
    subtitle: Mapped[Optional[str]] = mapped_column(String(400))
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    product: Mapped["Product"] = relationship()  # noqa: F821

    __table_args__ = (
        UniqueConstraint("product_id", "collection", name="top_picks_one_per_collection"),
        Index("ix_top_picks_active_order", "is_active", "display_order"),
    )


class HomepageSection(UUIDMixin, TimestampMixin, Base):
    """Admin-composed homepage (spec §39).

    The homepage is data, not a template. `kind` selects which renderer the
    frontend uses; `config` holds the parameters that renderer needs (which
    category to pull, how many products, and so on).
    """

    __tablename__ = "homepage_sections"

    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    subtitle: Mapped[Optional[str]] = mapped_column(String(400))

    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (Index("ix_homepage_active_order", "is_active", "display_order"),)


class ActivityLog(UUIDMixin, Base):
    """Admin audit trail (spec §60).

    Append-only: no updated_at, and nothing in the API layer offers a way to
    edit a row. An audit log you can rewrite is not an audit log.
    """

    __tablename__ = "activity_logs"

    # References auth.users, outside our metadata — plain UUID, FK declared in SQL.
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    # Only recorded where it is justified by a security requirement (spec §60)
    ip_address: Mapped[Optional[str]] = mapped_column(INET)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (Index("ix_activity_entity", "entity_type", "entity_id"),)
