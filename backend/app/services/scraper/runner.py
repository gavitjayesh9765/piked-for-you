"""
The run itself.

`execute_job` takes a queued `price_scrape_jobs` row and works through it. It
owns its own database session because it outlives the request that started it —
the HTTP call that presses the button returns as soon as the job row exists,
and everything after that happens here.

Two properties this module exists to guarantee:

  Nothing starts a run but a person. There is no scheduler, no timer, no
  trigger. `execute_job` is called with a job id that an admin endpoint
  created, and there is no other caller.

  A bad reading never quietly becomes the site's price. Every observation is
  recorded, but a reading that disagrees with the current price by more than
  the configured tolerance is stored as `rejected` and left for a human. That
  is what stops a drifted selector — which reads an EMI instalment as the price
  — from rewriting a catalogue overnight.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.session import async_session_factory
from app.models import (
    PriceHistory,
    PriceScrapeJob,
    PriceScrapeResult,
    PricingSettings,
    Product,
    ProductRetailer,
    Retailer,
)
from app.services.scraper.extract import NoPriceFound, Reading, extract_price
from app.services.scraper.fetch import Engine, Fetcher, FetchError

log = logging.getLogger("sortedchoice.scraper")

# How often the worker re-reads its own job row to notice a cancel request.
# Every item would be a query per link; never would make the button a lie.
CANCEL_POLL_EVERY = 5

# Tolerance is scaled by how much the reading is trusted. A JSON-LD price that
# halved is plausibly a sale; the same drop from a regex over page text is
# almost always a selector that has wandered onto a different number.
CONFIDENCE_TOLERANCE = {"high": Decimal(1), "medium": Decimal("0.5"), "low": Decimal("0.34")}


@dataclass(slots=True)
class Target:
    """One link to check, flattened so the worker holds no ORM state."""

    link_id: uuid.UUID
    product_id: uuid.UUID
    retailer_id: uuid.UUID
    product_title: str
    retailer_name: str
    url: str
    engine: Engine
    config: dict[str, Any]
    current_price: Decimal | None
    currency: str


@dataclass(slots=True)
class Outcome:
    status: str
    message: str | None = None
    new_price: Decimal | None = None
    currency: str | None = None
    in_stock: bool | None = None
    http_status: int | None = None


class HostThrottle:
    """A minimum gap between request *starts* per host.

    Concurrency alone is not politeness: four workers that all happen to be on
    Amazon are four simultaneous requests to Amazon. This spaces them out per
    host while letting different hosts proceed in parallel, which is the
    behaviour the delay setting is meant to describe.
    """

    def __init__(self, delay_seconds: float) -> None:
        self._delay = delay_seconds
        self._next_free: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def wait(self, url: str) -> None:
        if self._delay <= 0:
            return
        host = urlparse(url).netloc

        async with self._lock:
            now = time.monotonic()
            start_at = max(now, self._next_free.get(host, now))
            self._next_free[host] = start_at + self._delay
            sleep_for = start_at - now

        if sleep_for > 0:
            await asyncio.sleep(sleep_for)


# --------------------------------------------------------------------------- #
# Target resolution                                                           #
# --------------------------------------------------------------------------- #


async def resolve_targets(
    db: AsyncSession, scope: dict[str, Any], settings_row: PricingSettings
) -> list[Target]:
    """Turn a scope into the concrete list of links this run will check.

    Every filter is optional and they compose, so "all published Sony
    headphones on Flipkart whose price has not been checked in three days" is
    one call. An empty scope means every scrapable link on every published
    product — the plain "refresh everything" the button offers by default.
    """
    stmt = (
        select(ProductRetailer)
        .options(joinedload(ProductRetailer.retailer), joinedload(ProductRetailer.product))
        .join(Product, Product.id == ProductRetailer.product_id)
        .join(Retailer, Retailer.id == ProductRetailer.retailer_id)
        .where(
            ProductRetailer.is_active.is_(True),
            ProductRetailer.scrape_enabled.is_(True),
            Retailer.is_active.is_(True),
            Retailer.scrape_enabled.is_(True),
        )
    )

    product_ids = [uuid.UUID(str(p)) for p in scope.get("productIds", []) if p]
    if product_ids:
        stmt = stmt.where(ProductRetailer.product_id.in_(product_ids))
    else:
        # A named product is checked whatever its status — that is the point of
        # the per-product button, and drafts are exactly when a price matters.
        # A bulk run defaults to published only.
        product_status = scope.get("status", "published")
        if product_status and product_status != "all":
            stmt = stmt.where(Product.status == product_status)

    if scope.get("categoryId"):
        stmt = stmt.where(Product.category_id == uuid.UUID(str(scope["categoryId"])))
    if scope.get("brandId"):
        stmt = stmt.where(Product.brand_id == uuid.UUID(str(scope["brandId"])))

    slugs = [s for s in scope.get("retailerSlugs", []) if isinstance(s, str)]
    if slugs:
        stmt = stmt.where(Retailer.slug.in_(slugs))

    if scope.get("onlyStale"):
        hours = int(scope.get("staleHours") or settings_row.stale_after_hours)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        stmt = stmt.where(
            or_(
                ProductRetailer.last_scraped_at.is_(None),
                ProductRetailer.last_scraped_at < cutoff,
            )
        )

    if scope.get("onlyFailing"):
        stmt = stmt.where(
            and_(
                ProductRetailer.last_scrape_status.is_not(None),
                ProductRetailer.last_scrape_status.in_(
                    ("error", "blocked", "not_found", "rejected")
                ),
            )
        )

    # Oldest check first, so a run that is cut short has still done the most
    # stale links rather than an arbitrary slice.
    stmt = stmt.order_by(ProductRetailer.last_scraped_at.asc().nullsfirst())

    limit = scope.get("limit")
    if limit:
        stmt = stmt.limit(max(1, min(int(limit), 5000)))

    rows: Sequence[ProductRetailer] = (await db.execute(stmt)).unique().scalars().all()

    return [
        Target(
            link_id=link.id,
            product_id=link.product_id,
            retailer_id=link.retailer_id,
            product_title=link.product.title,
            retailer_name=link.retailer.name,
            url=link.url,
            engine=_engine_for(link.retailer, settings_row),
            config=dict(link.retailer.scrape_config or {}),
            current_price=link.display_price,
            currency=link.currency or link.product.currency or "INR",
        )
        for link in rows
    ]


def _engine_for(retailer: Retailer, settings_row: PricingSettings) -> Engine:
    engine = retailer.scrape_engine or settings_row.default_engine
    return "browser" if engine == "browser" else "http"


# --------------------------------------------------------------------------- #
# One link                                                                    #
# --------------------------------------------------------------------------- #


def judge(
    reading: Reading, current: Decimal | None, max_change_percent: Decimal
) -> tuple[bool, str | None]:
    """Should this reading be applied? Returns (accept, reason-if-not).

    With no current price there is nothing to disagree with, so the first
    reading is always accepted — it is the baseline everything after it is
    measured against.
    """
    if current is None or current <= 0:
        return True, None

    tolerance = max_change_percent * CONFIDENCE_TOLERANCE[reading.confidence]
    change = abs(reading.price - current) / current * Decimal(100)

    if change > tolerance:
        direction = "below" if reading.price < current else "above"
        return False, (
            f"Read {reading.price} — {change:.0f}% {direction} the stored {current}, "
            f"past the {tolerance:.0f}% tolerance for a {reading.confidence}-confidence "
            f'match (from “{reading.raw}”). Not applied; review and apply it by hand '
            "if it is real."
        )
    return True, None


# --------------------------------------------------------------------------- #
# Writes                                                                      #
# --------------------------------------------------------------------------- #


async def apply_reading(
    db: AsyncSession,
    *,
    link: ProductRetailer,
    price: Decimal,
    currency: str,
    in_stock: bool | None,
    job_id: uuid.UUID | None,
    source: str = "scrape",
    update_product_price: bool = True,
) -> bool:
    """Write a price through to the link, the history and the product.

    Returns whether the number actually moved. History is written only when it
    did (or on the very first observation): recording an identical figure every
    few hours turns a readable chart into a solid band and grows the table for
    nothing. That a check ran and found no change is recorded on the result row.
    """
    now = datetime.now(timezone.utc)
    previous = link.display_price
    changed = previous is None or Decimal(previous) != price

    link.display_price = price
    link.currency = currency
    link.in_stock = in_stock
    link.price_checked_at = now

    if changed:
        db.add(
            PriceHistory(
                product_id=link.product_id,
                retailer_id=link.retailer_id,
                product_retailer_id=link.id,
                job_id=job_id,
                price=price,
                currency=currency,
                in_stock=in_stock,
                source=source,
            )
        )

    if update_product_price:
        # The roll-up SELECTs every link's price, and the one just assigned
        # above is still only on the instance. This session is created with
        # `autoflush=False`, so nothing pushes it out on our behalf — without
        # this flush the query reads the *previous* price and the product's
        # headline figure lags a full run behind its own links.
        await db.flush()
        await _roll_up_product_price(db, link.product_id, now)

    return changed


async def _roll_up_product_price(
    db: AsyncSession, product_id: uuid.UUID, now: datetime
) -> None:
    """The product's headline price is the cheapest active link.

    Recomputed from the links rather than assigned from whichever one was just
    scraped — otherwise a run that happens to finish on the expensive retailer
    leaves the product claiming that price. `price_min`/`price_max` are the
    all-time extremes the product page's "% below peak" is measured against, so
    they only ever widen.
    """
    product = await db.get(Product, product_id)
    if product is None:
        return

    prices = (
        (
            await db.execute(
                select(ProductRetailer.display_price).where(
                    ProductRetailer.product_id == product_id,
                    ProductRetailer.is_active.is_(True),
                    ProductRetailer.display_price.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    live = [Decimal(p) for p in prices if p is not None]
    if not live:
        return

    cheapest = min(live)
    product.price_current = cheapest
    product.price_updated_at = now
    product.price_min = min(live + ([Decimal(product.price_min)] if product.price_min else []))
    product.price_max = max(live + ([Decimal(product.price_max)] if product.price_max else []))


# --------------------------------------------------------------------------- #
# The run                                                                     #
# --------------------------------------------------------------------------- #


async def execute_job(job_id: uuid.UUID) -> None:
    """Work through one job row, start to finish.

    Opens its own session: the request that created the job has already
    returned, and borrowing its session would be a use-after-close.
    """
    async with async_session_factory() as db:
        try:
            await _run(db, job_id)
        except Exception as err:  # noqa: BLE001
            log.exception("Price run %s failed", job_id)
            await db.rollback()
            # A crashed run must not stay 'running' forever — that would block
            # every future run on the one-active-job index.
            job = await db.get(PriceScrapeJob, job_id)
            if job is not None and not job.is_terminal:
                job.status = "failed"
                job.error = str(err)[:2000]
                job.finished_at = datetime.now(timezone.utc)
                await db.commit()


async def _run(db: AsyncSession, job_id: uuid.UUID) -> None:
    job = await db.get(PriceScrapeJob, job_id)
    if job is None:
        # The endpoint commits the row before queueing this task, so a missing
        # job means it was deleted — or that the commit was lost. Either way it
        # is worth a line: the alternative is a button that silently does
        # nothing and gives no one a thread to pull.
        log.warning("Price run %s does not exist; nothing to do", job_id)
        return
    if job.status != "queued":
        log.warning("Price run %s is already %s; not starting it again", job_id, job.status)
        return

    settings_row = await db.get(PricingSettings, True)
    if settings_row is None:
        raise RuntimeError("pricing_settings row is missing; run the pricing migration")

    scope = dict(job.scope or {})
    dry_run = bool(scope.get("dryRun"))

    targets = await resolve_targets(db, scope, settings_row)

    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    job.total = len(targets)
    await db.commit()

    if not targets:
        await _finish(db, job, cancelled=False)
        return

    throttle = HostThrottle(settings_row.delay_ms / 1000)
    semaphore = asyncio.Semaphore(settings_row.concurrency)
    write_lock = asyncio.Lock()  # one session, so writes are serialised
    cancelled = False

    async with Fetcher(
        user_agent=settings_row.user_agent,
        timeout_seconds=settings_row.timeout_seconds,
        max_retries=settings_row.max_retries,
        respect_robots=settings_row.respect_robots,
    ) as fetcher:

        async def worker(index: int, target: Target) -> None:
            nonlocal cancelled
            if cancelled:
                return

            async with semaphore:
                if cancelled:
                    return
                outcome, duration_ms, reading = await _check(fetcher, throttle, target)

            async with write_lock:
                if cancelled:
                    return
                await _record(
                    db,
                    job=job,
                    target=target,
                    outcome=outcome,
                    reading=reading,
                    duration_ms=duration_ms,
                    settings_row=settings_row,
                    dry_run=dry_run,
                )
                job.processed += 1

                if index % CANCEL_POLL_EVERY == 0 or index == len(targets) - 1:
                    await db.commit()
                    await db.refresh(job, ["cancel_requested"])
                    if job.cancel_requested:
                        cancelled = True

        await asyncio.gather(
            *(worker(i, t) for i, t in enumerate(targets)), return_exceptions=False
        )

    await _finish(db, job, cancelled=cancelled)


async def _check(
    fetcher: Fetcher, throttle: HostThrottle, target: Target
) -> tuple[Outcome, int, Reading | None]:
    """Fetch and read one link. Never raises — every failure is an outcome.

    That is deliberate: a run over four hundred links must not end because one
    of them timed out, and an editor needs the failure recorded against the
    link rather than lost in a traceback. The `Reading` comes back alongside
    the outcome because the tolerance rule belongs to the caller, which is the
    only place that knows the settings.
    """
    started = time.monotonic()

    try:
        await throttle.wait(target.url)
        fetched = await fetcher.fetch(target.url, engine=target.engine)
    except FetchError as err:
        status = "blocked" if err.blocked else ("not_found" if err.status == 404 else "error")
        return (
            Outcome(status=status, message=str(err), http_status=err.status),
            _ms(started),
            None,
        )
    except Exception as err:  # noqa: BLE001 — this is the failure boundary
        log.exception("Unexpected fetch failure for %s", target.url)
        return Outcome(status="error", message=f"Unexpected error: {err}"), _ms(started), None

    try:
        reading = extract_price(fetched.html, target.config)
    except NoPriceFound as err:
        return (
            Outcome(status="not_found", message=str(err), http_status=fetched.status),
            _ms(started),
            None,
        )
    except Exception as err:  # noqa: BLE001
        log.exception("Unexpected parse failure for %s", target.url)
        return (
            Outcome(
                status="error",
                message=f"Could not parse the page: {err}",
                http_status=fetched.status,
            ),
            _ms(started),
            None,
        )

    return (
        Outcome(
            status="read",
            new_price=reading.price,
            currency=reading.currency or target.currency,
            in_stock=reading.in_stock,
            http_status=fetched.status,
            message=f"{reading.strategy} · {reading.raw}",
        ),
        _ms(started),
        reading,
    )


def _ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


async def _record(
    db: AsyncSession,
    *,
    job: PriceScrapeJob,
    target: Target,
    outcome: Outcome,
    reading: Reading | None,
    duration_ms: int,
    settings_row: PricingSettings,
    dry_run: bool,
) -> None:
    """Decide the final status, write it everywhere it belongs."""
    now = datetime.now(timezone.utc)
    link = await db.get(ProductRetailer, target.link_id)
    if link is None:
        return  # deleted mid-run; nothing to record against

    status = outcome.status
    message = outcome.message

    if reading is not None:
        accept, reason = judge(reading, target.current_price, settings_row.max_change_percent)

        if not accept:
            status, message = "rejected", reason
        elif dry_run or not settings_row.auto_apply:
            status = "unchanged" if reading.price == target.current_price else "updated"
            message = (
                f"Read {reading.price} via {reading.strategy}. "
                "Not written — this was a dry run."
                if dry_run
                else f"Read {reading.price} via {reading.strategy}. "
                "Not written — auto-apply is off in Pricing → Settings."
            )
        else:
            changed = await apply_reading(
                db,
                link=link,
                price=reading.price,
                currency=outcome.currency or target.currency,
                in_stock=reading.in_stock,
                job_id=job.id,
                update_product_price=settings_row.update_product_price,
            )
            status = "updated" if changed else "unchanged"
            message = f"{reading.strategy} · {reading.raw}"

    # The link records what happened even when nothing was applied — "we looked
    # and were blocked" is the state an editor needs to see, and leaving
    # last_scraped_at stale would make the run look like it skipped the link.
    if not dry_run:
        link.last_scrape_status = status
        link.last_scraped_at = now
        link.last_scrape_error = (
            None if status in ("updated", "unchanged") else (message or "")[:2000]
        )

    db.add(
        PriceScrapeResult(
            job_id=job.id,
            product_id=target.product_id,
            retailer_id=target.retailer_id,
            product_retailer_id=target.link_id,
            status=status,
            old_price=target.current_price,
            new_price=outcome.new_price,
            currency=outcome.currency,
            in_stock=outcome.in_stock,
            message=(message or "")[:2000] or None,
            http_status=outcome.http_status,
            duration_ms=duration_ms,
        )
    )

    if status == "updated":
        job.updated_count += 1
    elif status == "unchanged":
        job.unchanged_count += 1
    elif status == "skipped":
        job.skipped_count += 1
    else:
        job.failed_count += 1


async def _finish(db: AsyncSession, job: PriceScrapeJob, *, cancelled: bool) -> None:
    """Close the job out with a status that says what actually happened.

    'partial' is its own state rather than a success with a footnote: a run
    where a quarter of the links were blocked is not a success, and calling it
    one is how a broken selector survives for a month.
    """
    if cancelled:
        job.status = "cancelled"
    elif job.total == 0:
        job.status = "succeeded"
    elif job.failed_count == job.total:
        job.status = "failed"
    elif job.failed_count:
        job.status = "partial"
    else:
        job.status = "succeeded"

    job.finished_at = datetime.now(timezone.utc)
    await db.commit()
