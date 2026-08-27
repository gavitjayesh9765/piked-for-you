"""
Analytics counters.

These mirror `supabase/migrations/20260827180440_analytics_daily.sql`, which is
the source of truth for the schema. Read the header comment there first — it
explains why these are pre-aggregated counters rather than an event log, and
what that trade costs.

Three things about these models are unusual enough to be worth stating, because
each of them looks like an omission:

  * **No `id`.** Every other table in this system uses `UUIDMixin`. These use
    composite natural keys instead — a surrogate id would add 16 bytes a row to
    the only tables here that grow with time, and it would let the same
    (day, product) pair exist twice, which is precisely what the upsert relies
    on being impossible.

  * **No `TimestampMixin`.** `created_at` and `updated_at` are required on
    every table by spec §41, and these are the exception. `day` already is the
    timestamp, at the only resolution this data has; an `updated_at` would
    record when the counter last moved, which is "the last time anyone viewed
    this product" — a fact worth having, but not worth 16 bytes a row on the
    tables specifically designed to stay small, and derivable from the maximum
    `day` anyway.

  * **No relationships.** `product_id` and `retailer_id` are foreign keys in
    the database and plain columns here. Nothing reads a counter and then walks
    to its product; the admin queries aggregate first and join once, at the
    end, to put names on the handful of rows that survived. A `relationship()`
    here would be an invitation to iterate rows and lazy-load, which on this
    table means one query per product per day.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProductDaily(Base):
    """Views and outbound clicks for one product on one day."""

    __tablename__ = "analytics_product_daily"

    day: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class RetailerDaily(Base):
    """Outbound clicks for one product at one retailer on one day.

    Sums to `ProductDaily.clicks` for the same product and day. The redundancy
    is deliberate — the product-level counter is what the dashboard reads on
    every load, and recomputing it from this table would mean a GROUP BY over
    every retailer row to answer the cheapest question on the page.
    """

    __tablename__ = "analytics_retailer_daily"

    day: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    retailer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retailers.id", ondelete="CASCADE"), primary_key=True
    )
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class DimensionDaily(Base):
    """A counter for one (dimension, key) pair on one day.

    `dimension` is one of `path`, `referrer`, `device`; the database enforces
    that set with a CHECK constraint rather than an enum, so adding a fourth is
    a one-line migration and not a type rewrite.

    ⚠ `key` must already be normalised by the writer — a route shape, not a
    URL; a host, not a referrer string. See `analytics/service.py`, which is
    the only thing that writes here, and the ⚠ note in the migration.
    """

    __tablename__ = "analytics_daily"

    day: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    dimension: Mapped[str] = mapped_column(String(16), primary_key=True)
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
