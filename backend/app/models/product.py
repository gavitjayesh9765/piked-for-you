"""Product and its satellites (spec §18–§26)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Product(UUIDMixin, TimestampMixin, Base):
    """The core content entity.

    Pricing lives in relational columns rather than JSON because it is queried,
    filtered and sorted on constantly (spec §41). Specifications are JSONB
    because their shape is genuinely category-dependent.
    """

    __tablename__ = "products"

    title: Mapped[str] = mapped_column(String(250), nullable=False)
    slug: Mapped[str] = mapped_column(String(280), nullable=False, unique=True, index=True)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # The one-line reason this product is worth considering. Rendered on every
    # card — a card without it is a listing, not a recommendation (spec §51).
    tagline: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    short_description: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)

    # --- Pricing (spec §20). Numeric, not float — money is never a float. ---
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    price_current: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), index=True)
    price_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    price_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    price_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # --- PickD Verdict (spec §25). Arrays of short strings, hence JSONB. ---
    verdict: Mapped[Optional[str]] = mapped_column(Text)
    best_for: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    not_ideal_for: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    pros: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    cons: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    # Category-specific structured specs (spec §41)
    specifications: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)

    # --- Publication (spec §38, §61). Only 'published' is publicly visible. ---
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # --- SEO (spec §47) ---
    meta_title: Mapped[Optional[str]] = mapped_column(String(200))
    meta_description: Mapped[Optional[str]] = mapped_column(String(400))
    og_image_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Denormalised community aggregates. Recomputed on review approval so the
    # card and grid never need a per-product aggregate query (spec §48).
    rating_average: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    brand: Mapped["Brand"] = relationship(back_populates="products")  # noqa: F821
    category: Mapped["Category"] = relationship(back_populates="products")  # noqa: F821
    media: Mapped[list["ProductMedia"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductMedia.display_order"
    )
    score: Mapped[Optional["ProductScore"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", uselist=False
    )
    badge_links: Mapped[list["ProductBadge"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    retailer_links: Mapped[list["ProductRetailer"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(back_populates="product")  # noqa: F821

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')", name="products_status_valid"
        ),
        CheckConstraint(
            "price_min IS NULL OR price_max IS NULL OR price_min <= price_max",
            name="products_price_range_ordered",
        ),
        # The hot path for every category page: published products in a
        # category, ordered by our score.
        Index("ix_products_category_status", "category_id", "status"),
        Index("ix_products_status_published", "status", "published_at"),
    )


class ProductMedia(UUIDMixin, TimestampMixin, Base):
    """Images and videos (spec §19, §45).

    The file itself lives in object storage; this row holds metadata and a URL.
    `display_order` drives the admin's drag-and-drop ordering, and order 0 is
    the primary image.
    """

    __tablename__ = "product_media"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    # Object key in the private `product-media` bucket. Never a public URL —
    # access is minted as a signed URL at read time, so draft-product imagery
    # is not reachable before publication (spec §38).
    # Null for a linked video — an embed has no object in our bucket.
    storage_path: Mapped[Optional[str]] = mapped_column(String(1000))
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1000))
    alt: Mapped[Optional[str]] = mapped_column(String(300))

    # --- Linked video (kind = "video_link") ---
    # We store the provider and id, never just the URL: the embed address is
    # rebuilt by us, so nothing user-supplied is reflected into an iframe src.
    source_url: Mapped[Optional[str]] = mapped_column(String(1000))
    provider: Mapped[Optional[str]] = mapped_column(String(20))
    external_id: Mapped[Optional[str]] = mapped_column(String(64))
    title: Mapped[Optional[str]] = mapped_column(String(200))

    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="media")

    __table_args__ = (
        CheckConstraint(
            "kind IN ('image', 'video', 'video_link')", name="product_media_kind_valid"
        ),
    )


class ProductScore(UUIDMixin, TimestampMixin, Base):
    """PickD Score (spec §24).

    `overall` is a queryable column because it is sorted and filtered on;
    `criteria` is JSONB because the criteria themselves are category-specific
    and configurable.
    """

    __tablename__ = "product_scores"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    overall: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False, index=True)
    criteria: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="score")

    __table_args__ = (
        CheckConstraint("overall >= 0 AND overall <= 10", name="product_scores_range"),
    )


class ProductBadge(Base):
    """Product ↔ Badge join (spec §21). A product may carry several badges."""

    __tablename__ = "product_badges"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("badges.id", ondelete="CASCADE"), primary_key=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="badge_links")
    badge: Mapped["Badge"] = relationship()  # noqa: F821


class Retailer(UUIDMixin, TimestampMixin, Base):
    """Amazon, Flipkart, Official, and whatever comes later. Never hard-coded in
    the frontend (spec §26)."""

    __tablename__ = "retailers"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Affiliate tag template, e.g. "?tag=pickdforyou-21". Kept server-side so
    # the tracking parameters are never assembled in the browser.
    affiliate_template: Mapped[Optional[str]] = mapped_column(String(300))

    # --- Price scraping (spec addendum: price tracking) ---
    # Selectors live in the database, not in Python: a retailer changing its
    # markup is routine, and a redeploy is not an acceptable fix for it.
    scrape_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    scrape_engine: Mapped[str] = mapped_column(String(20), default="http", nullable=False)
    scrape_config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class ProductRetailer(UUIDMixin, TimestampMixin, Base):
    """A product's link to one retailer (spec §26)."""

    __tablename__ = "product_retailers"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    retailer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retailers.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(1500), nullable=False)
    display_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    price_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # --- Scrape state ---
    # Denormalised onto the link rather than derived from the newest history
    # row: "is this price stale?" is asked on every product render, and that
    # must not cost a correlated subquery over an ever-growing table.
    scrape_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(3))
    in_stock: Mapped[Optional[bool]] = mapped_column(Boolean)
    last_scrape_status: Mapped[Optional[str]] = mapped_column(String(20))
    last_scrape_error: Mapped[Optional[str]] = mapped_column(Text)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    product: Mapped["Product"] = relationship(back_populates="retailer_links")
    retailer: Mapped["Retailer"] = relationship()

    __table_args__ = (
        UniqueConstraint("product_id", "retailer_id", name="product_retailers_one_per_retailer"),
    )
