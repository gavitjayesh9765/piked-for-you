"""
Price tracking, from the admin panel.

The whole surface an editor drives:

    GET    /admin/pricing/settings          the knobs
    PUT    /admin/pricing/settings
    GET    /admin/pricing/retailers         per-retailer engine + selectors
    PUT    /admin/pricing/retailers/{id}
    POST   /admin/pricing/preview           try one URL, write nothing
    POST   /admin/pricing/runs              ← the button
    GET    /admin/pricing/runs              run history
    GET    /admin/pricing/runs/{id}         one run, with its results
    POST   /admin/pricing/runs/{id}/cancel
    POST   /admin/pricing/results/{id}/apply   accept a rejected reading
    GET    /admin/products/{id}/price-history
    POST   /admin/products/{id}/refresh-price

There is no schedule anywhere in this file, and no code path that creates a job
without an authenticated admin on the other end of it. That is the design the
brief asked for, so it is worth being explicit that nothing here quietly grew a
timer.

The run itself happens in a background task rather than inside the request: a
catalogue of four hundred links at a polite 1.5s per host is minutes of work,
and no HTTP client should be asked to hold a connection open for it. The button
returns a job id; the panel polls it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.models import (
    Brand,
    Category,
    PriceHistory,
    PriceScrapeJob,
    PriceScrapeResult,
    PricingSettings,
    Product,
    ProductRetailer,
    Retailer,
)
from app.schemas.common import MAX_PAGE
from app.services.scraper import apply_reading, execute_job, preview_url, resolve_targets

router = APIRouter(prefix="/pricing", tags=["admin", "pricing"])

# A second router for the two routes that belong under /products rather than
# /pricing. Same gate — both are mounted behind get_current_admin.
product_router = APIRouter(tags=["admin", "pricing"])


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"


class Wire(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, alias_generator=to_camel, populate_by_name=True
    )


class StrictWire(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


# --------------------------------------------------------------------------- #
# Settings                                                                    #
# --------------------------------------------------------------------------- #


class SettingsOut(Wire):
    concurrency: int
    delay_ms: int
    timeout_seconds: int
    max_retries: int
    respect_robots: bool
    user_agent: str
    stale_after_hours: int
    default_engine: str
    max_change_percent: float
    auto_apply: bool
    update_product_price: bool
    history_retention_days: int
    updated_at: datetime


class SettingsUpdate(StrictWire):
    """Every bound here is mirrored by a CHECK constraint on the table.

    Validating in both places is not redundancy for its own sake: this layer
    produces a message an editor can act on, and the constraint means a value
    that reached the database by any other route is still refused.
    """

    concurrency: int = Field(ge=1, le=16)
    delay_ms: int = Field(ge=0, le=60_000)
    timeout_seconds: int = Field(ge=5, le=120)
    max_retries: int = Field(ge=0, le=5)
    respect_robots: bool
    user_agent: str = Field(min_length=8, max_length=300)
    stale_after_hours: int = Field(ge=0, le=8760)
    default_engine: Literal["http", "browser"]
    max_change_percent: float = Field(ge=1, le=100)
    auto_apply: bool
    update_product_price: bool
    history_retention_days: int = Field(ge=30, le=3650)


async def _settings(db: DbSession) -> PricingSettings:
    row = await db.get(PricingSettings, True)
    if row is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Pricing settings are missing. Apply the pricing migration.",
        )
    return row


@router.get("/settings", response_model=SettingsOut)
async def get_settings(admin: CurrentAdmin, db: DbSession, response: Response) -> PricingSettings:
    _private(response)
    return await _settings(db)


@router.put("/settings", response_model=SettingsOut)
async def update_settings(
    payload: Annotated[SettingsUpdate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> PricingSettings:
    _private(response)
    row = await _settings(db)

    for field, value in payload.model_dump().items():
        setattr(row, field, Decimal(str(value)) if field == "max_change_percent" else value)

    await db.flush()
    await audit.record(
        db,
        actor_id=admin.id,
        action="pricing.settings.update",
        entity_type="pricing_settings",
        summary="Updated price-run settings",
        meta=payload.model_dump(),
        ip_address=client_ip(request),
    )
    return row


# --------------------------------------------------------------------------- #
# Retailers — engine and selectors                                            #
# --------------------------------------------------------------------------- #


class RetailerScrapeOut(Wire):
    id: uuid.UUID
    name: str
    slug: str
    is_active: bool
    display_order: int
    scrape_enabled: bool
    scrape_engine: str
    scrape_config: dict[str, Any]
    link_count: int = 0
    failing_count: int = 0


class RetailerScrapeUpdate(StrictWire):
    scrape_enabled: bool
    scrape_engine: Literal["http", "browser"]
    price_selectors: list[str] = Field(default_factory=list, max_length=20)
    out_of_stock_selectors: list[str] = Field(default_factory=list, max_length=20)
    currency: str | None = Field(default=None, max_length=3)
    allow_text_scan: bool = True

    @field_validator("price_selectors", "out_of_stock_selectors")
    @classmethod
    def _trim(cls, value: list[str]) -> list[str]:
        return [s.strip()[:300] for s in value if s and s.strip()]


@router.get("/retailers", response_model=list[RetailerScrapeOut])
async def list_retailer_configs(
    admin: CurrentAdmin, db: DbSession, response: Response
) -> list[RetailerScrapeOut]:
    """Every retailer, with how many links it carries and how many are unhappy.

    The failing count is the number that matters: a retailer whose selectors
    have drifted shows up here as a number, before anyone notices a wrong price
    on the site.
    """
    _private(response)

    retailers = (
        (await db.execute(select(Retailer).order_by(Retailer.display_order))).scalars().all()
    )

    counts = {
        rid: (total, failing)
        for rid, total, failing in (
            await db.execute(
                select(
                    ProductRetailer.retailer_id,
                    func.count(ProductRetailer.id),
                    func.count(ProductRetailer.id).filter(
                        ProductRetailer.last_scrape_status.in_(
                            ("error", "blocked", "not_found", "rejected")
                        )
                    ),
                ).group_by(ProductRetailer.retailer_id)
            )
        ).all()
    }

    return [
        RetailerScrapeOut(
            id=r.id,
            name=r.name,
            slug=r.slug,
            is_active=r.is_active,
            display_order=r.display_order,
            scrape_enabled=r.scrape_enabled,
            scrape_engine=r.scrape_engine,
            scrape_config=dict(r.scrape_config or {}),
            link_count=counts.get(r.id, (0, 0))[0],
            failing_count=counts.get(r.id, (0, 0))[1],
        )
        for r in retailers
    ]


@router.put("/retailers/{retailer_id}", response_model=RetailerScrapeOut)
async def update_retailer_config(
    retailer_id: uuid.UUID,
    payload: Annotated[RetailerScrapeUpdate, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> RetailerScrapeOut:
    """Selectors are data, so fixing a retailer's markup change is an edit here
    rather than a deploy. That is the entire reason `scrape_config` is a
    column."""
    _private(response)

    retailer = await db.get(Retailer, retailer_id)
    if retailer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Retailer not found")

    retailer.scrape_enabled = payload.scrape_enabled
    retailer.scrape_engine = payload.scrape_engine
    retailer.scrape_config = {
        "priceSelectors": payload.price_selectors,
        "outOfStockSelectors": payload.out_of_stock_selectors,
        "currency": (payload.currency or "").upper() or None,
        "allowTextScan": payload.allow_text_scan,
    }

    await db.flush()
    await audit.record(
        db,
        actor_id=admin.id,
        action="pricing.retailer.configure",
        entity_type="retailer",
        entity_id=retailer.id,
        summary=f"Updated scrape configuration for {retailer.name}",
        ip_address=client_ip(request),
    )

    return RetailerScrapeOut(
        id=retailer.id,
        name=retailer.name,
        slug=retailer.slug,
        is_active=retailer.is_active,
        display_order=retailer.display_order,
        scrape_enabled=retailer.scrape_enabled,
        scrape_engine=retailer.scrape_engine,
        scrape_config=dict(retailer.scrape_config or {}),
    )


# --------------------------------------------------------------------------- #
# Preview — try one URL, write nothing                                        #
# --------------------------------------------------------------------------- #


class PreviewIn(StrictWire):
    # HttpUrl, not str: this endpoint makes a server-side request to whatever
    # it is handed, so the scheme is validated by the type rather than by a
    # check someone can forget to write.
    url: HttpUrl
    retailer_id: uuid.UUID | None = None
    engine: Literal["http", "browser"] | None = None
    price_selectors: list[str] = Field(default_factory=list, max_length=20)


class PreviewOut(Wire):
    ok: bool
    url: str
    engine: str
    price: float | None = None
    currency: str | None = None
    in_stock: bool | None = None
    strategy: str | None = None
    confidence: str | None = None
    raw: str | None = None
    http_status: int | None = None
    duration_ms: int | None = None
    error: str | None = None


@router.post("/preview", response_model=PreviewOut)
async def preview(
    payload: Annotated[PreviewIn, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
) -> PreviewOut:
    """The "Test" button next to a selector.

    Editing selectors without this means changing a config, starting a real run
    and reading a results table to learn whether the guess was right — a loop
    slow enough that people stop tuning selectors and start living with broken
    ones.
    """
    _private(response)
    settings_row = await _settings(db)

    config: dict[str, Any] = {}
    engine = payload.engine or settings_row.default_engine

    if payload.retailer_id:
        retailer = await db.get(Retailer, payload.retailer_id)
        if retailer is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Retailer not found")
        config = dict(retailer.scrape_config or {})
        engine = payload.engine or retailer.scrape_engine

    # Unsaved selectors from the form win, so a candidate can be tried before
    # it is committed to every product on the retailer.
    if payload.price_selectors:
        config["priceSelectors"] = [s.strip() for s in payload.price_selectors if s.strip()]

    result = await preview_url(
        str(payload.url),
        config=config,
        engine="browser" if engine == "browser" else "http",
        user_agent=settings_row.user_agent,
        timeout_seconds=settings_row.timeout_seconds,
        respect_robots=settings_row.respect_robots,
    )

    return PreviewOut(
        ok=result.ok,
        url=result.url,
        engine=result.engine,
        price=float(result.price) if result.price is not None else None,
        currency=result.currency,
        in_stock=result.in_stock,
        strategy=result.strategy,
        confidence=result.confidence,
        raw=result.raw,
        http_status=result.http_status,
        duration_ms=result.duration_ms,
        error=result.error,
    )


# --------------------------------------------------------------------------- #
# Runs                                                                        #
# --------------------------------------------------------------------------- #


class RunScope(StrictWire):
    """What the button should cover.

    All-optional and composable, so "every Flipkart link in Headphones that has
    not been checked in three days" is a single run rather than a spreadsheet
    exercise. Everything left unset means "no restriction".
    """

    product_ids: list[uuid.UUID] = Field(default_factory=list, max_length=500)
    category_id: uuid.UUID | None = None
    brand_id: uuid.UUID | None = None
    retailer_slugs: list[str] = Field(default_factory=list, max_length=20)
    status: Literal["published", "draft", "archived", "all"] = "published"
    only_stale: bool = False
    stale_hours: int | None = Field(default=None, ge=0, le=8760)
    only_failing: bool = False
    limit: int | None = Field(default=None, ge=1, le=5000)
    #: Read everything, write nothing. The right way to try a settings change.
    dry_run: bool = False


class RunOut(Wire):
    id: uuid.UUID
    status: str
    trigger: str
    scope: dict[str, Any]
    total: int
    processed: int
    updated_count: int
    unchanged_count: int
    failed_count: int
    skipped_count: int
    cancel_requested: bool
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class RunEstimate(Wire):
    """What pressing the button right now would actually do."""

    link_count: int
    estimated_seconds: int


@router.post("/runs/estimate", response_model=RunEstimate)
async def estimate_run(
    payload: Annotated[RunScope, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
) -> RunEstimate:
    """How many links this scope covers, and roughly how long it will take.

    Shown next to the button before it is pressed. "Refresh prices" with no
    idea whether that means nine requests or nine hundred is not a control, it
    is a dare.
    """
    _private(response)
    settings_row = await _settings(db)
    targets = await resolve_targets(db, _scope_dict(payload), settings_row)

    # Work is spread across hosts, so wall-clock is roughly the busiest host's
    # queue: its share of the links, each spaced by the politeness delay.
    per_host: dict[uuid.UUID, int] = {}
    for target in targets:
        per_host[target.retailer_id] = per_host.get(target.retailer_id, 0) + 1
    busiest = max(per_host.values(), default=0)

    seconds = int(busiest * (settings_row.delay_ms / 1000 + 1.5))
    return RunEstimate(link_count=len(targets), estimated_seconds=seconds)


def _scope_dict(scope: RunScope) -> dict[str, Any]:
    """Wire model → the plain JSON the runner and the job row both speak."""
    return {
        "productIds": [str(p) for p in scope.product_ids],
        "categoryId": str(scope.category_id) if scope.category_id else None,
        "brandId": str(scope.brand_id) if scope.brand_id else None,
        "retailerSlugs": scope.retailer_slugs,
        "status": scope.status,
        "onlyStale": scope.only_stale,
        "staleHours": scope.stale_hours,
        "onlyFailing": scope.only_failing,
        "limit": scope.limit,
        "dryRun": scope.dry_run,
    }


async def _create_run(
    db: DbSession,
    background: BackgroundTasks,
    *,
    scope: dict[str, Any],
    trigger: str,
    admin_id: uuid.UUID,
    request: Request,
    summary: str,
) -> PriceScrapeJob:
    """Create the job row, commit it, then hand the id to a background task.

    The unique partial index on the table is what actually enforces one run at
    a time; the pre-check below only exists to turn that into a readable
    message instead of a constraint violation. Two admins pressing the button
    at the same moment is exactly the race the index is there for.

    **The explicit commit is load-bearing.** Starlette runs background tasks
    *before* FastAPI unwinds the `yield` dependencies, so `get_db`'s commit has
    not happened yet when the task starts. The worker opens its own session on
    its own connection, would not see a row still inside this request's
    transaction, and would exit silently — leaving a button that appears to
    work and does nothing. Committing here is what makes the job visible to it.
    """
    active = (
        await db.execute(
            select(PriceScrapeJob).where(PriceScrapeJob.status.in_(("queued", "running")))
        )
    ).scalars().first()
    if active is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A price run is already {active.status}. Wait for it to finish, or cancel it.",
        )

    job = PriceScrapeJob(scope=scope, trigger=trigger, triggered_by=admin_id, status="queued")
    db.add(job)

    try:
        await db.flush()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Another price run started a moment ago."
        ) from err

    await audit.record(
        db,
        actor_id=admin_id,
        action="pricing.run.start",
        entity_type="price_scrape_job",
        entity_id=job.id,
        summary=summary,
        meta=scope,
        ip_address=client_ip(request),
    )

    # The job row and its audit entry land together, and both are durable
    # before anything is queued. See the docstring: without this, the worker
    # races the request's own transaction and loses.
    await db.commit()

    background.add_task(execute_job, job.id)
    return job


@router.post("/runs", response_model=RunOut, status_code=status.HTTP_202_ACCEPTED)
async def start_run(
    payload: Annotated[RunScope, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
    background: BackgroundTasks,
) -> PriceScrapeJob:
    """**The button.**

    Returns 202 with a job id the moment the row exists. The work happens after
    the response; the panel polls `GET /pricing/runs/{id}` for progress.
    """
    _private(response)
    scope = _scope_dict(payload)
    return await _create_run(
        db,
        background,
        scope=scope,
        trigger="manual",
        admin_id=admin.id,
        request=request,
        summary="Started a price refresh" + (" (dry run)" if payload.dry_run else ""),
    )


@router.get("/runs", response_model=dict)
async def list_runs(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    _private(response)

    base = select(PriceScrapeJob)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(PriceScrapeJob.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return {
        "items": [RunOut.model_validate(r).model_dump(by_alias=True, mode="json") for r in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "hasMore": (page - 1) * page_size + len(rows) < total,
    }


class RunResultOut(Wire):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_title: str | None
    retailer_name: str | None
    status: str
    old_price: float | None
    new_price: float | None
    currency: str | None
    in_stock: bool | None
    message: str | None
    http_status: int | None
    duration_ms: int | None
    created_at: datetime


@router.get("/runs/{job_id}", response_model=dict)
async def get_run(
    job_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> dict:
    """One run and what it found.

    Defaults to every result; filter to `error`, `blocked`, `rejected` or
    `not_found` to get straight to the links that need a human. That filter is
    the screen's real job — a list of 400 successes is not information.
    """
    _private(response)

    job = await db.get(PriceScrapeJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")

    stmt = (
        select(PriceScrapeResult, Product.title, Retailer.name)
        .outerjoin(Product, Product.id == PriceScrapeResult.product_id)
        .outerjoin(Retailer, Retailer.id == PriceScrapeResult.retailer_id)
        .where(PriceScrapeResult.job_id == job_id)
    )
    if status_filter and status_filter != "all":
        if status_filter == "problems":
            stmt = stmt.where(
                PriceScrapeResult.status.in_(("error", "blocked", "not_found", "rejected"))
            )
        else:
            stmt = stmt.where(PriceScrapeResult.status == status_filter)

    rows = (
        await db.execute(stmt.order_by(PriceScrapeResult.created_at.desc()).limit(limit))
    ).all()

    return {
        "run": RunOut.model_validate(job).model_dump(by_alias=True, mode="json"),
        "results": [
            RunResultOut(
                id=r.id,
                product_id=r.product_id,
                product_title=title,
                retailer_name=retailer_name,
                status=r.status,
                old_price=float(r.old_price) if r.old_price is not None else None,
                new_price=float(r.new_price) if r.new_price is not None else None,
                currency=r.currency,
                in_stock=r.in_stock,
                message=r.message,
                http_status=r.http_status,
                duration_ms=r.duration_ms,
                created_at=r.created_at,
            ).model_dump(by_alias=True, mode="json")
            for r, title, retailer_name in rows
        ],
    }


@router.post("/runs/{job_id}/cancel", response_model=RunOut)
async def cancel_run(
    job_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> PriceScrapeJob:
    """Ask the run to stop.

    A flag rather than a kill: the worker reads it between links, so an
    in-flight request finishes and its result is recorded instead of being lost
    halfway through a write.
    """
    _private(response)

    job = await db.get(PriceScrapeJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if job.is_terminal:
        raise HTTPException(status.HTTP_409_CONFLICT, f"That run already {job.status}.")

    job.cancel_requested = True
    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="pricing.run.cancel",
        entity_type="price_scrape_job",
        entity_id=job.id,
        summary="Requested cancellation of a price run",
        ip_address=client_ip(request),
    )
    return job


@router.post("/runs/{job_id}/reap", response_model=RunOut)
async def reap_run(
    job_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> PriceScrapeJob:
    """Force a stuck run to terminal state.

    Background tasks live in the API process, so a restart mid-run leaves a job
    stranded as `running` with nobody working it — and the one-active-run index
    then blocks every future run. This is the way out, and it refuses to touch
    a run that has made progress in the last ten minutes so it cannot be used
    to shoot a healthy one.
    """
    _private(response)

    job = await db.get(PriceScrapeJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if job.is_terminal:
        return job

    idle_since = job.updated_at or job.created_at
    if datetime.now(timezone.utc) - idle_since < timedelta(minutes=10):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That run is still making progress. Cancel it instead, or wait ten minutes.",
        )

    job.status = "failed"
    job.error = "Marked as failed by an admin — the worker stopped reporting progress."
    job.finished_at = datetime.now(timezone.utc)
    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="pricing.run.reap",
        entity_type="price_scrape_job",
        entity_id=job.id,
        summary="Force-closed a stalled price run",
        ip_address=client_ip(request),
    )
    return job


# --------------------------------------------------------------------------- #
# Accepting a rejected reading                                                #
# --------------------------------------------------------------------------- #


@router.post("/results/{result_id}/apply", response_model=dict)
async def apply_result(
    result_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
) -> dict:
    """Publish a price the guard rail held back.

    The tolerance check is deliberately conservative, so it will sometimes stop
    a real 70%-off sale. This is the other half of that trade: a human looks at
    the reading, agrees, and applies it — and the history row records it as
    `manual`, because a person decided it, not a scraper.
    """
    _private(response)

    result = await db.get(PriceScrapeResult, result_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Result not found")
    if result.status != "rejected" or result.new_price is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only a rejected reading with a price can be applied by hand.",
        )
    if result.product_retailer_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That link no longer exists.")

    link = await db.get(ProductRetailer, result.product_retailer_id)
    if link is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That link no longer exists.")

    settings_row = await _settings(db)
    changed = await apply_reading(
        db,
        link=link,
        price=Decimal(result.new_price),
        currency=result.currency or link.currency or "INR",
        in_stock=result.in_stock,
        job_id=result.job_id,
        source="manual",
        update_product_price=settings_row.update_product_price,
    )
    link.last_scrape_status = "updated"
    link.last_scrape_error = None

    await db.flush()
    await audit.record(
        db,
        actor_id=admin.id,
        action="pricing.result.apply",
        entity_type="product",
        entity_id=result.product_id,
        summary=f"Applied a held-back price of {result.new_price} by hand",
        ip_address=client_ip(request),
    )

    return {"applied": True, "changed": changed, "price": float(result.new_price)}


# --------------------------------------------------------------------------- #
# Per-product: history and a single refresh                                   #
# --------------------------------------------------------------------------- #


class PricePointOut(Wire):
    price: float
    currency: str
    retailer: str | None
    in_stock: bool | None
    source: str
    captured_at: datetime


@product_router.get("/products/{product_id}/price-history", response_model=dict)
async def price_history(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    days: Annotated[int, Query(ge=1, le=1095)] = 180,
    retailer_slug: Annotated[str | None, Query()] = None,
) -> dict:
    """Every recorded price for a product, plus the summary the chart needs.

    Lowest and highest are computed over the window being shown rather than all
    time, so "lowest in 180 days" means what it says.
    """
    _private(response)

    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(PriceHistory, Retailer.name, Retailer.slug)
        .outerjoin(Retailer, Retailer.id == PriceHistory.retailer_id)
        .where(PriceHistory.product_id == product_id, PriceHistory.captured_at >= since)
        .order_by(PriceHistory.captured_at.asc())
    )
    if retailer_slug:
        stmt = stmt.where(Retailer.slug == retailer_slug)

    rows = (await db.execute(stmt)).all()
    points = [
        PricePointOut(
            price=float(h.price),
            currency=h.currency,
            retailer=name,
            in_stock=h.in_stock,
            source=h.source,
            captured_at=h.captured_at,
        )
        for h, name, _slug in rows
    ]

    prices = [p.price for p in points]
    return {
        "points": [p.model_dump(by_alias=True, mode="json") for p in points],
        "summary": {
            "count": len(points),
            "lowest": min(prices) if prices else None,
            "highest": max(prices) if prices else None,
            "latest": prices[-1] if prices else None,
            "windowDays": days,
        },
    }


@product_router.post(
    "/products/{product_id}/refresh-price",
    response_model=RunOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refresh_one_product(
    product_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
    response: Response,
    background: BackgroundTasks,
) -> PriceScrapeJob:
    """The same machinery, scoped to one product.

    Runs whatever the product's status is — a draft is exactly when an editor
    is checking whether the price they typed is still right.
    """
    _private(response)

    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    return await _create_run(
        db,
        background,
        scope={"productIds": [str(product_id)], "status": "all"},
        trigger="single_product",
        admin_id=admin.id,
        request=request,
        summary=f"Refreshed prices for “{product.title}”",
    )


# --------------------------------------------------------------------------- #
# Overview                                                                    #
# --------------------------------------------------------------------------- #


@router.get("/overview", response_model=dict)
async def overview(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    """The numbers at the top of the pricing screen.

    Chosen to answer "should I press the button?" — how much is stale, how much
    is broken, and whether anything is running right now.
    """
    _private(response)
    settings_row = await _settings(db)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings_row.stale_after_hours)

    totals = (
        await db.execute(
            select(
                func.count(ProductRetailer.id),
                func.count(ProductRetailer.id).filter(ProductRetailer.scrape_enabled.is_(True)),
                func.count(ProductRetailer.id).filter(
                    ProductRetailer.last_scraped_at.is_(None)
                    | (ProductRetailer.last_scraped_at < cutoff)
                ),
                func.count(ProductRetailer.id).filter(
                    ProductRetailer.last_scrape_status.in_(
                        ("error", "blocked", "not_found", "rejected")
                    )
                ),
                func.count(ProductRetailer.id).filter(ProductRetailer.display_price.is_(None)),
            ).where(ProductRetailer.is_active.is_(True))
        )
    ).one()

    active = (
        await db.execute(
            select(PriceScrapeJob)
            .where(PriceScrapeJob.status.in_(("queued", "running")))
            .order_by(PriceScrapeJob.created_at.desc())
        )
    ).scalars().first()

    last = (
        await db.execute(
            select(PriceScrapeJob)
            .where(PriceScrapeJob.status.in_(("succeeded", "partial", "failed", "cancelled")))
            .order_by(PriceScrapeJob.created_at.desc())
        )
    ).scalars().first()

    history_count = (
        await db.execute(select(func.count()).select_from(PriceHistory))
    ).scalar_one()

    return {
        "links": {
            "total": totals[0],
            "scrapable": totals[1],
            "stale": totals[2],
            "failing": totals[3],
            "missingPrice": totals[4],
        },
        "historyPoints": history_count,
        "staleAfterHours": settings_row.stale_after_hours,
        "activeRun": RunOut.model_validate(active).model_dump(by_alias=True, mode="json")
        if active
        else None,
        "lastRun": RunOut.model_validate(last).model_dump(by_alias=True, mode="json")
        if last
        else None,
    }


@router.get("/filters", response_model=dict)
async def scope_filters(admin: CurrentAdmin, db: DbSession, response: Response) -> dict:
    """Categories, brands and retailers, for the scope pickers on the run form."""
    _private(response)

    categories = (
        (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    )
    brands = (await db.execute(select(Brand).order_by(Brand.name))).scalars().all()
    retailers = (
        (await db.execute(select(Retailer).order_by(Retailer.display_order))).scalars().all()
    )

    return {
        "categories": [{"id": str(c.id), "name": c.name, "slug": c.slug} for c in categories],
        "brands": [{"id": str(b.id), "name": b.name, "slug": b.slug} for b in brands],
        "retailers": [
            {"id": str(r.id), "name": r.name, "slug": r.slug, "scrapeEnabled": r.scrape_enabled}
            for r in retailers
        ],
    }
