"""Categories, brands and badges — all admin-managed, none hard-coded (spec §6, §21–§23)."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Category(UUIDMixin, TimestampMixin, Base):
    """Hierarchical category tree (spec §23).

    Self-referential parent_id supports arbitrary depth. `path` denormalises the
    ancestor slug chain so /c/electronics/audio/headphones resolves in one query
    instead of walking the tree on every request — it is rewritten whenever a
    category is moved.
    """

    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    icon: Mapped[Optional[str]] = mapped_column(String(60))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    path: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    depth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    show_on_homepage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Which filters this category exposes, and which criteria its PickD Score
    # uses (spec §17, §24). Genuinely variable per category, so JSONB is right.
    filter_config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    score_criteria: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)

    parent: Mapped[Optional["Category"]] = relationship(remote_side="Category.id", back_populates="children")
    children: Mapped[list["Category"]] = relationship(back_populates="parent", cascade="all")
    products: Mapped[list["Product"]] = relationship(back_populates="category")  # noqa: F821

    __table_args__ = (Index("categories_active_order_idx", "is_active", "display_order"),)


class Brand(UUIDMixin, TimestampMixin, Base):
    """Spec §22. `is_pinned` drives the homepage featured-brands strip."""

    __tablename__ = "brands"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, unique=True, index=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)
    website: Mapped[Optional[str]] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")  # noqa: F821


class Badge(UUIDMixin, TimestampMixin, Base):
    """Reusable badge entity (spec §21).

    `style` is a constrained token name, not a colour. The admin picks from the
    design system's vocabulary, so a new badge cannot introduce an off-palette
    hue and the frontend needs no deploy to render it.
    """

    __tablename__ = "badges"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    icon: Mapped[Optional[str]] = mapped_column(String(60))
    style: Mapped[str] = mapped_column(String(20), default="neutral", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
