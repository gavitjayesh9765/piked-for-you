"""
Price tracking — runs, per-link outcomes, history, and the knobs that govern
all three.

The split between the three tables is the whole design, so it is worth stating
plainly:

  PriceScrapeJob     one press of the button. Progress counters live here so
                     the admin panel can poll a single row.
  PriceScrapeResult  what happened to one link during one run — *including*
                     the failures. Most outcomes are not a price.
  PriceHistory       observed prices only, append-only. A chart reads this and
                     nothing else, so a blocked request can never dent a line.

Nothing in this module schedules anything. A run exists because a person
created one.
"""

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
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin

# The vocabulary shared by product_retailers.last_scrape_status and
# price_scrape_results.status. Both check constraints are written from this
# list, so adding an outcome is one edit here plus one migration.
SCRAPE_STATUSES = (
    "updated",    # a new price, applied
    "unchanged",  # read fine, same number
    "not_found",  # page loaded, no price in it
    "blocked",    # 403/429/captcha — the retailer refused us
    "rejected",   # a price we do not believe (see max_change_percent)
    "error",      # transport, timeout, parse failure
    "skipped",    # disabled, or excluded by the run's scope
)

JOB_STATUSES = ("queued", "running", "succeeded", "partial", "failed", "cancelled")


class PriceScrapeJob(UUIDMixin, TimestampMixin, Base):
    """One run.

    `cancel_requested` is a flag the worker reads between items rather than a
    signal it receives: the worker may be in a different process, and an
    in-memory event would not reach it.
    """

    __tablename__ = "price_scrape_jobs"

    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False)
    trigger: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)

    # What was asked for — product ids, category, retailer, staleness cutoff.
    # Kept so a run can be explained after the fact, and repeated.
    scope: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unchanged_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')",
            name="price_scrape_jobs_status_valid",
        ),
        CheckConstraint(
            "trigger IN ('manual', 'single_product', 'api')",
            name="price_scrape_jobs_trigger_valid",
        ),
        Index("price_scrape_jobs_created_idx", "created_at"),
    )

    @property
    def is_terminal(self) -> bool:
        return self.status in ("succeeded", "partial", "failed", "cancelled")


class PriceScrapeResult(UUIDMixin, Base):
    """What one run made of one link.

    No updated_at and no TimestampMixin: a result is written once, when the
    attempt finishes, and never revised.
    """

    __tablename__ = "price_scrape_results"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("price_scrape_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retailers.id", ondelete="SET NULL")
    )
    product_retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_retailers.id", ondelete="SET NULL")
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    old_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    new_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    currency: Mapped[Optional[str]] = mapped_column(String(3))
    in_stock: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Written for a human to read in the results table, so it says what to do
    # about it, not just what went wrong.
    message: Mapped[Optional[str]] = mapped_column(Text)
    http_status: Mapped[Optional[int]] = mapped_column(Integer)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('updated', 'unchanged', 'not_found', 'blocked', "
            "'rejected', 'error', 'skipped')",
            name="price_scrape_results_status_valid",
        ),
    )


class PriceHistory(UUIDMixin, Base):
    """One observed price at one moment.

    Append-only, and the database agrees: the RLS policies grant INSERT and
    SELECT to admins and nothing else — there is no UPDATE and no DELETE policy
    for anyone. A past observation is a fact about a moment, and editing it
    would make every chart drawn from this table a lie. Corrections are new
    rows with `source = 'manual'`.

    Admin-only on read, too. No public endpoint exposes this and no RLS policy
    grants anon or authenticated a path to it, so the series is not reachable
    through PostgREST either. A public price chart would be a deliberate change
    to both, not something that happens to already work.

    A row is written when the price *changed* (or on the first ever read), not
    on every scrape. Storing an identical number every few hours would turn a
    readable chart into a dense band and grow the table for nothing — that a
    scrape ran and found no change is recorded on PriceScrapeResult instead.
    """

    __tablename__ = "price_history"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retailers.id", ondelete="SET NULL")
    )
    product_retailer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_retailers.id", ondelete="SET NULL")
    )
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("price_scrape_jobs.id", ondelete="SET NULL")
    )

    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    in_stock: Mapped[Optional[bool]] = mapped_column(Boolean)
    source: Mapped[str] = mapped_column(String(10), default="scrape", nullable=False)

    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("price >= 0", name="price_history_price_positive"),
        CheckConstraint(
            "source IN ('scrape', 'manual', 'import')", name="price_history_source_valid"
        ),
        Index("price_history_product_captured_idx", "product_id", "captured_at"),
        Index("price_history_link_captured_idx", "product_retailer_id", "captured_at"),
    )


class PricingSettings(TimestampMixin, Base):
    """The run's knobs — one row, edited in the admin panel.

    A table rather than environment variables because these are turned by an
    editor while watching a run misbehave, and an editor cannot deploy. The
    primary key is a boolean fixed to true, so there is exactly one row and no
    code has to wonder which one is current.
    """

    __tablename__ = "pricing_settings"

    id: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True)

    # --- Politeness. Defaults are gentle on purpose; the sites are not ours. --
    concurrency: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    delay_ms: Mapped[int] = mapped_column(Integer, default=1500, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    respect_robots: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, nullable=False)

    # --- Scope defaults for the button ---
    stale_after_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    default_engine: Mapped[str] = mapped_column(String(20), default="http", nullable=False)

    # A "price" 90% below the last one is almost always a selector that matched
    # an unrelated number — an EMI instalment, a delivery fee, a crossed-out
    # figure from a different variant. Beyond this threshold the reading is
    # recorded as 'rejected' and left for a human rather than published.
    max_change_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("60.00"), nullable=False
    )

    # Whether a good reading writes through to the live link, and whether it
    # rolls up to products.price_current. Turning both off makes a run a
    # read-only audit — which is exactly what you want the first time.
    auto_apply: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    update_product_price: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    history_retention_days: Mapped[int] = mapped_column(Integer, default=730, nullable=False)
