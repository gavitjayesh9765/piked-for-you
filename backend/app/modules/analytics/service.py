"""
Analytics: the write path, the normalisers that keep it bounded, and the reads
the admin dashboard runs.

Read the header of `supabase/migrations/20260827180440_analytics_daily.sql`
first. The short version: these are daily counters, not events; nothing here
identifies a visitor; and the tables stay small only because every free-text
value is folded into a closed set BEFORE it reaches the database. That folding
is what this module mostly is.

---------------------------------------------------------------------------
THE PROPERTY THAT MUST NOT BE BROKEN

`analytics_daily` is bounded by (number of distinct keys) x (number of days).
`ROUTE_SHAPES` and `_referrer_host` are what make "number of distinct keys" a
small constant instead of a function of traffic. If either ever passes through
a value it was given — a raw path, a full referrer URL — the table silently
becomes the event log the migration was written to avoid, and nothing fails
loudly at the moment it happens.

Both therefore end in a fallback rather than a pass-through: an unrecognised
path is `/other`, an unrecognised referrer host is dropped. Losing the detail
is the point.

The ONE exception, and why it does not break the property: category pages are
counted individually (`/c/electronics/audio`, not `/c/:path`). That is still a
closed set — it is bounded by the number of rows in `categories`, which is a
number an admin controls, not a number traffic controls — and it is enforced by
an ALLOWLIST read from the taxonomy, never by trusting the path. A `/c/...` URL
that does not name a real active category still folds to `/c/:path`. If you are
tempted to relax that check, re-read the paragraph above: the difference
between "bounded by the catalogue" and "bounded by whatever anyone typed" is
the difference between this table and the event log it exists to avoid.
"""

from __future__ import annotations

import datetime as dt
import logging
import re
import uuid
from dataclasses import dataclass
from urllib.parse import urlsplit

from sqlalchemy import func, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Brand,
    Category,
    DimensionDaily,
    Product,
    ProductDaily,
    ProductRetailer,
    Retailer,
    RetailerDaily,
)

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Normalisation                                                                #
# --------------------------------------------------------------------------- #

#: Path -> route shape. Ordered: the first match wins, so the specific patterns
#: sit above the general ones and `/c` never swallows `/c/audio/headphones`.
#:
#: These are SHAPES, not URLs. `/p/audio/sony-wh-1000xm5` counts against
#: `/p/:category/:slug`, so a catalogue of ten thousand products contributes one
#: row a day here — the per-product numbers live in `analytics_product_daily`,
#: which is keyed by product id and does not need the path at all.
ROUTE_SHAPES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^/$"), "/"),
    (re.compile(r"^/p/[^/]+/[^/]+$"), "/p/:category/:slug"),
    # Kept as the FALLBACK for category URLs. A path that names a real active
    # category is counted under its own key before this pattern is reached —
    # see `normalise_path` — and everything else lands here.
    (re.compile(r"^/c/.+$"), "/c/:path"),
    (re.compile(r"^/c$"), "/c"),
    (re.compile(r"^/b/[^/]+$"), "/b/:slug"),
    (re.compile(r"^/b$"), "/b"),
    (re.compile(r"^/account(/.*)?$"), "/account"),
    (re.compile(r"^/help/report$"), "/help/report"),
    (re.compile(r"^/newsletter/confirm$"), "/newsletter/confirm"),
)

#: Static routes that map to themselves. Kept as a set rather than nine more
#: regexes because that is all this is: an allowlist of paths that are already
#: their own shape.
STATIC_ROUTES: frozenset[str] = frozenset(
    {
        "/about",
        "/affiliate-disclosure",
        "/compare",
        "/contact",
        "/cookies",
        "/editorial-policy",
        "/forgot-password",
        "/help",
        "/how-we-research",
        "/how-we-score",
        "/login",
        "/privacy",
        "/register",
        "/search",
        "/terms",
        "/top-picks",
    }
)

#: Where an unrecognised path goes. A rising `/other` count is the signal that
#: a route has been added to the site and not to the two collections above —
#: which is a nuisance, and is a great deal better than an unbounded table.
OTHER_PATH = "/other"

#: Referrer hosts are stored bare (`google.com`), so this strips the noise that
#: would otherwise split one source across a dozen rows.
_WWW = re.compile(r"^(www|m|amp)\.")

#: Long enough for any real host, short enough to refuse a URL that slipped
#: through as a host. The column's CHECK allows 180; this is the writer's own
#: tighter rule.
MAX_KEY_LENGTH = 100

#: Substring match, lowercased, against the user agent. Not an attempt at real
#: bot detection — that is a losing arms race and the wrong goal. It removes
#: the honest, self-identifying crawlers, which on a site built to be indexed
#: is the overwhelming majority of non-human traffic. A bot that lies about its
#: user agent will be counted, and the number is still far closer to readership
#: than a server-side request count would be.
BOT_MARKERS: tuple[str, ...] = (
    "bot", "crawl", "spider", "slurp", "curl", "wget", "python-requests",
    "httpx", "headless", "lighthouse", "pagespeed", "preview", "monitor",
    "uptime", "scrap", "fetch", "probe", "validator", "facebookexternalhit",
    "embedly", "quora link", "whatsapp", "telegram", "discord", "skype",
)


def is_bot(user_agent: str | None) -> bool:
    """True for self-identifying automation.

    An absent user agent counts as a bot. Every real browser sends one; the
    requests that do not are scripts, and a beacon is trivially replayable
    without one.
    """
    if not user_agent:
        return True
    ua = user_agent.lower()
    return any(marker in ua for marker in BOT_MARKERS)


def normalise_path(raw: str | None, categories: frozenset[str] | None = None) -> str:
    """Fold a URL path into one of the shapes in `ROUTE_SHAPES`/`STATIC_ROUTES`.

    Query strings and fragments are discarded before matching, and never
    stored: `?q=sony` on `/search` is a search term, which is user-entered text
    and exactly the kind of thing this table has no business holding.

    `categories` is the allowlist of real category paths ("electronics/audio").
    Pass it and a category page counts under its own key; omit it and every
    category page counts as `/c/:path`, which is what this function did for
    every caller before.

    ---------------------------------------------------------------------------
    WHY CATEGORIES ARE WORTH UN-FOLDING WHEN NOTHING ELSE IS

    `/p/:category/:slug` collapses because per-product numbers live in
    `analytics_product_daily`, keyed by product id — the shape is not hiding
    anything, it is avoiding a duplicate. Categories had no such table, so
    folding them threw the answer away: every category page on the site landed
    on one row, and "which categories do people actually browse" — the question
    that decides which homepage rails are worth having — was unanswerable from
    our own data while looking like it was being collected.

    The set stays closed because the allowlist comes from the taxonomy. 98
    categories is 98 possible keys; a crawler walking `/c/<random>` for a week
    still produces exactly one row, `/c/:path`.
    """
    if not raw:
        return OTHER_PATH

    path = urlsplit(raw).path or "/"
    path = path.lower().rstrip("/") or "/"

    if path in STATIC_ROUTES:
        return path

    # Before ROUTE_SHAPES, because `^/c/.+$` would otherwise swallow it.
    if categories and path.startswith("/c/") and len(path) <= MAX_KEY_LENGTH:
        if path[len("/c/") :] in categories:
            return path

    for pattern, shape in ROUTE_SHAPES:
        if pattern.match(path):
            return shape
    return OTHER_PATH


def normalise_referrer(raw: str | None, own_host: str | None = None) -> str | None:
    """Reduce a referrer to a bare host, or to nothing.

    Returns None for same-site navigation, which would otherwise be the largest
    "source" on the dashboard and would mean nothing: a reader moving from a
    category page to a product page is not a referral, and counting it would
    bury the handful of rows that answer the question actually being asked —
    where do NEW readers arrive from.
    """
    if not raw:
        return None

    host = (urlsplit(raw).hostname or "").lower().strip()
    if not host:
        return None

    host = _WWW.sub("", host)
    if not host or len(host) > MAX_KEY_LENGTH:
        return None
    if own_host and host == _WWW.sub("", own_host.lower()):
        return None
    return host


def device_class(user_agent: str | None) -> str:
    """desktop | mobile | tablet, from the coarsest possible read of the UA.

    Deliberately three buckets and no version, model or OS. The question this
    answers is "should the mobile layout be the one we optimise", and that is
    fully answered by three numbers. Anything finer would be a fingerprint.
    """
    ua = (user_agent or "").lower()
    if "ipad" in ua or ("tablet" in ua and "mobile" not in ua) or "kindle" in ua:
        return "tablet"
    if "mobi" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    return "desktop"


# --------------------------------------------------------------------------- #
# The category allowlist                                                       #
# --------------------------------------------------------------------------- #

#: How long the allowlist is trusted before it is read again.
#:
#: This is consulted from the beacon endpoint, which is the most frequently
#: called write in the system, so it may not be a query per page view. Ten
#: minutes means a category added in the admin panel is counted under
#: `/c/:path` for at most ten minutes and under its own key after that — a
#: delay nobody will notice on a number that is explicitly approximate.
_CATEGORY_TTL = dt.timedelta(minutes=10)

#: Process-local, so each worker keeps its own copy and they expire
#: independently. That is fine and deliberate: this is a hint used to pick a
#: counter key, not a source of truth, and a worker that is briefly behind
#: writes a slightly coarser row rather than a wrong one.
_category_paths: frozenset[str] = frozenset()
_category_paths_read_at: dt.datetime | None = None


async def known_category_paths(db: AsyncSession) -> frozenset[str]:
    """Active category paths as slash-joined strings ("electronics/audio").

    Returns the last good value on any failure. The alternative — letting the
    exception out — would turn a stale cache into a lost beacon, and this is
    the one query on the write path that is not strictly necessary to count
    the event.
    """
    global _category_paths, _category_paths_read_at

    now = dt.datetime.now(dt.UTC)
    if _category_paths_read_at is not None and now - _category_paths_read_at < _CATEGORY_TTL:
        return _category_paths

    try:
        rows = (
            await db.execute(
                select(Category.path, Category.slug).where(Category.is_active.is_(True))
            )
        ).all()
    except Exception:  # noqa: BLE001 - see the docstring
        logger.debug("category allowlist refresh failed; serving the previous set")
        return _category_paths

    _category_paths = frozenset("/".join(path or [slug]) for path, slug in rows)
    _category_paths_read_at = now
    return _category_paths


# --------------------------------------------------------------------------- #
# Write path                                                                   #
# --------------------------------------------------------------------------- #


def _today() -> dt.date:
    """UTC, so a day boundary means the same thing on every instance.

    The dashboard renders these as dates without a timezone, which is a small
    lie for a reader in IST — a "day" here ends at 05:30 local. Correcting it
    would mean either storing a timezone per row or picking one for the whole
    business; the second is defensible and the first is not worth it, but
    neither is worth doing before anyone has looked at the numbers.
    """
    return dt.datetime.now(dt.UTC).date()


async def _bump_product(
    db: AsyncSession, product_id: uuid.UUID, *, views: int = 0, clicks: int = 0
) -> None:
    """One statement: insert the day's row, or add to it if it is already there.

    `ON CONFLICT DO UPDATE` rather than a SELECT-then-UPDATE, and the difference
    matters at exactly the moment this code runs — two readers opening the same
    product in the same second. Read-then-write loses one of the two increments
    and does it silently; this is a single atomic statement and cannot.
    """
    stmt = pg_insert(ProductDaily).values(
        day=_today(), product_id=product_id, views=views, clicks=clicks
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[ProductDaily.day, ProductDaily.product_id],
            set_={
                "views": ProductDaily.views + stmt.excluded.views,
                "clicks": ProductDaily.clicks + stmt.excluded.clicks,
            },
        )
    )


async def _bump_retailer(
    db: AsyncSession, product_id: uuid.UUID, retailer_id: uuid.UUID
) -> None:
    stmt = pg_insert(RetailerDaily).values(
        day=_today(), product_id=product_id, retailer_id=retailer_id, clicks=1
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[
                RetailerDaily.day,
                RetailerDaily.product_id,
                RetailerDaily.retailer_id,
            ],
            set_={"clicks": RetailerDaily.clicks + stmt.excluded.clicks},
        )
    )


async def _bump_dimension(db: AsyncSession, dimension: str, key: str) -> None:
    stmt = pg_insert(DimensionDaily).values(
        day=_today(), dimension=dimension, key=key[:MAX_KEY_LENGTH], count=1
    )
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[DimensionDaily.day, DimensionDaily.dimension, DimensionDaily.key],
            set_={"count": DimensionDaily.count + stmt.excluded.count},
        )
    )


async def _resolve_link(
    db: AsyncSession, link_id: uuid.UUID
) -> tuple[uuid.UUID, uuid.UUID] | None:
    """(product_id, retailer_id) for a product_retailers row, or None.

    None for a link that has been deleted since the page was rendered — a tab
    left open across an edit is the ordinary case, not an attack — and the
    caller then falls back to whatever `product_id` the payload carried.
    """
    row = (
        await db.execute(
            select(ProductRetailer.product_id, ProductRetailer.retailer_id).where(
                ProductRetailer.id == link_id
            )
        )
    ).first()
    return (row[0], row[1]) if row else None


async def record(
    db: AsyncSession,
    *,
    kind: str,
    product_id: uuid.UUID | None,
    retailer_id: uuid.UUID | None,
    link_id: uuid.UUID | None,
    path: str | None,
    referrer: str | None,
    user_agent: str | None,
    own_host: str | None,
) -> bool:
    """Record one view or one click. Returns False if it was not counted.

    ⚠ EVERY FAILURE HERE IS SWALLOWED, and that is a deliberate choice about
    what this feature is allowed to cost.

    A tracking beacon is fire-and-forget: the browser has already rendered the
    page and is not waiting for this, and the caller returns 204 regardless. So
    the only thing a raised exception could achieve is a 500 in the logs and,
    if it escaped mid-transaction, a poisoned session. An analytics counter
    must never be able to affect anything a reader can see.

    The specific failure worth naming is the foreign key. `product_id` arrives
    from a request body, so it can name a product that does not exist — a typo,
    a stale tab open across a delete, or someone poking the endpoint. That is
    an IntegrityError on insert, it is expected, and it is not interesting.
    """
    if is_bot(user_agent):
        return False

    try:
        if kind == "view":
            # ⚠ THE TWO HALVES ARE INDEPENDENT, and that is load-bearing.
            #
            # A product page fires TWO beacons: one from the site layout
            # carrying a path and no product, one from the page itself carrying
            # a product and no path. If this branch always bumped the path
            # dimension, the second beacon would count `/other` on every
            # product view — inventing the site's most popular page out of a
            # component that was only ever asked to count a product.
            #
            # So each half runs only when it was actually given something to
            # count. A beacon with neither is a no-op, which is correct: it
            # describes nothing.
            if product_id is not None:
                await _bump_product(db, product_id, views=1)
            if path is not None:
                # The allowlist is only consulted for the paths it can affect,
                # so a homepage or product beacon never touches it — including
                # the very first one after a cold start.
                categories = (
                    await known_category_paths(db) if path.lower().startswith("/c/") else None
                )
                await _bump_dimension(db, "path", normalise_path(path, categories))
                await _bump_dimension(db, "device", device_class(user_agent))
                host = normalise_referrer(referrer, own_host)
                if host:
                    await _bump_dimension(db, "referrer", host)

        elif kind == "click":
            # ⚠ THE ATTRIBUTION IS RESOLVED HERE, NOT ACCEPTED FROM THE CLIENT.
            #
            # The beacon sends `link_id` — the id of the product_retailers row
            # behind the button that was clicked, which is already public. Both
            # the product and the retailer are looked up from that row.
            #
            # The alternative was to have the browser send product_id and
            # retailer_id directly, and it is worse in a specific way: those
            # two fields are independent in the payload, so anything posting to
            # this endpoint could attribute a click on one product to a
            # retailer that does not sell it. The counters would still add up
            # and the per-retailer table would quietly be fiction. Resolving
            # from one id makes the pair internally consistent by construction
            # — a caller can name a link that exists, and nothing else.
            resolved = await _resolve_link(db, link_id) if link_id else None
            if resolved is not None:
                product_id, retailer_id = resolved

            # A click with no product is not a click on anything. Refusing it
            # keeps `clicks` meaning one specific thing: a reader leaving a
            # product page for a retailer.
            if product_id is None:
                return False
            await _bump_product(db, product_id, clicks=1)
            if retailer_id is not None:
                await _bump_retailer(db, product_id, retailer_id)

        else:
            return False

        await db.commit()
        return True

    except IntegrityError:
        await db.rollback()
        return False
    except Exception:
        await db.rollback()
        logger.warning("Analytics write failed (%s). Counter skipped.", kind, exc_info=True)
        return False


# --------------------------------------------------------------------------- #
# Read path — everything below is admin-only and runs behind the admin gate    #
# --------------------------------------------------------------------------- #


@dataclass(slots=True)
class Window:
    """A date range, and the equally-long range immediately before it.

    Every headline number on the dashboard is shown with a change against the
    previous period, and "previous period" has to mean the same length or the
    percentage is nonsense. Deriving both from one place is what stops the
    comparison drifting from the range it claims to compare.
    """

    days: int
    start: dt.date
    end: dt.date
    prev_start: dt.date
    prev_end: dt.date

    @classmethod
    def of(cls, days: int) -> Window:
        end = _today()
        # Inclusive of today, so `days=7` is today plus the six before it —
        # which is what "last 7 days" means to the person reading it, even
        # though today is partial.
        start = end - dt.timedelta(days=days - 1)
        return cls(
            days=days,
            start=start,
            end=end,
            prev_start=start - dt.timedelta(days=days),
            prev_end=start - dt.timedelta(days=1),
        )


async def _totals(db: AsyncSession, start: dt.date, end: dt.date) -> tuple[int, int]:
    """(views, clicks) over a closed date range."""
    row = (
        await db.execute(
            select(
                func.coalesce(func.sum(ProductDaily.views), 0),
                func.coalesce(func.sum(ProductDaily.clicks), 0),
            ).where(ProductDaily.day.between(start, end))
        )
    ).one()
    return int(row[0]), int(row[1])


async def _page_views(db: AsyncSession, start: dt.date, end: dt.date) -> int:
    """Views across the whole site, product pages included.

    Read from the `path` dimension rather than summed from `ProductDaily`,
    because that table only knows about products — a reader who lands on the
    homepage, reads three category pages and leaves is invisible to it.
    """
    return int(
        (
            await db.execute(
                select(func.coalesce(func.sum(DimensionDaily.count), 0)).where(
                    DimensionDaily.dimension == "path",
                    DimensionDaily.day.between(start, end),
                )
            )
        ).scalar_one()
    )


async def timeseries(db: AsyncSession, window: Window) -> list[dict]:
    """One row per day in the window, zero-filled.

    ⚠ THE ZERO-FILL IS THE POINT, and it is done here rather than in the chart.
    A day with no traffic has no row, so the raw query returns a series with
    holes in it — and a line chart drawn from that connects Monday to Thursday
    with a straight line, which reads as "traffic held steady" when what
    happened is "the site had no visitors for two days". Missing data must look
    like zero, because that is what it was.
    """
    rows = {
        r.day: (int(r.views), int(r.clicks))
        for r in (
            await db.execute(
                select(
                    ProductDaily.day,
                    func.sum(ProductDaily.views).label("views"),
                    func.sum(ProductDaily.clicks).label("clicks"),
                )
                .where(ProductDaily.day.between(window.start, window.end))
                .group_by(ProductDaily.day)
            )
        ).all()
    }
    paths = {
        r.day: int(r.total)
        for r in (
            await db.execute(
                select(DimensionDaily.day, func.sum(DimensionDaily.count).label("total"))
                .where(
                    DimensionDaily.dimension == "path",
                    DimensionDaily.day.between(window.start, window.end),
                )
                .group_by(DimensionDaily.day)
            )
        ).all()
    }

    series = []
    for offset in range(window.days):
        day = window.start + dt.timedelta(days=offset)
        views, clicks = rows.get(day, (0, 0))
        series.append(
            {
                "day": day.isoformat(),
                "views": views,
                "clicks": clicks,
                "pageViews": paths.get(day, 0),
            }
        )
    return series


async def top_products(db: AsyncSession, window: Window, limit: int = 10) -> list[dict]:
    """Products ranked by views, with their clicks and CTR.

    One statement with a join, not a ranking followed by N lookups: the
    aggregate is computed over the date range first and the join runs against
    the ten rows that survive `LIMIT`.
    """
    totals = (
        select(
            ProductDaily.product_id.label("product_id"),
            func.sum(ProductDaily.views).label("views"),
            func.sum(ProductDaily.clicks).label("clicks"),
        )
        .where(ProductDaily.day.between(window.start, window.end))
        .group_by(ProductDaily.product_id)
        .order_by(func.sum(ProductDaily.views).desc())
        .limit(limit)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                totals.c.product_id,
                totals.c.views,
                totals.c.clicks,
                Product.title,
                Product.slug,
                Product.status,
                Brand.name.label("brand"),
                Category.name.label("category"),
            )
            .join(Product, Product.id == totals.c.product_id)
            .join(Brand, Brand.id == Product.brand_id)
            .join(Category, Category.id == Product.category_id)
            .order_by(totals.c.views.desc())
        )
    ).all()

    return [
        {
            "id": str(r.product_id),
            "title": r.title,
            "slug": r.slug,
            "status": r.status,
            "brand": r.brand,
            "category": r.category,
            "views": int(r.views),
            "clicks": int(r.clicks),
            "ctr": _ctr(int(r.views), int(r.clicks)),
        }
        for r in rows
    ]


async def top_converting(db: AsyncSession, window: Window, limit: int = 10) -> list[dict]:
    """Products ranked by CLICKS, which is a different list from `top_products`.

    Worth having as its own query rather than a re-sort of the top ten by
    views: the product that earns the most commission is frequently not in the
    top ten by traffic at all, and a dashboard that only ever ranks by views
    cannot show you that.
    """
    totals = (
        select(
            ProductDaily.product_id.label("product_id"),
            func.sum(ProductDaily.views).label("views"),
            func.sum(ProductDaily.clicks).label("clicks"),
        )
        .where(ProductDaily.day.between(window.start, window.end))
        .group_by(ProductDaily.product_id)
        .having(func.sum(ProductDaily.clicks) > 0)
        .order_by(func.sum(ProductDaily.clicks).desc())
        .limit(limit)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                totals.c.product_id,
                totals.c.views,
                totals.c.clicks,
                Product.title,
                Product.slug,
                Brand.name.label("brand"),
            )
            .join(Product, Product.id == totals.c.product_id)
            .join(Brand, Brand.id == Product.brand_id)
            .order_by(totals.c.clicks.desc())
        )
    ).all()

    return [
        {
            "id": str(r.product_id),
            "title": r.title,
            "slug": r.slug,
            "brand": r.brand,
            "views": int(r.views),
            "clicks": int(r.clicks),
            "ctr": _ctr(int(r.views), int(r.clicks)),
        }
        for r in rows
    ]


async def by_retailer(db: AsyncSession, window: Window) -> list[dict]:
    """Outbound clicks per retailer — where the affiliate revenue is coming from."""
    rows = (
        await db.execute(
            select(
                Retailer.id,
                Retailer.name,
                func.sum(RetailerDaily.clicks).label("clicks"),
            )
            .join(Retailer, Retailer.id == RetailerDaily.retailer_id)
            .where(RetailerDaily.day.between(window.start, window.end))
            .group_by(Retailer.id, Retailer.name)
            .order_by(func.sum(RetailerDaily.clicks).desc())
        )
    ).all()
    return [
        {"id": str(r.id), "name": r.name, "clicks": int(r.clicks)} for r in rows
    ]


async def dimension(
    db: AsyncSession, window: Window, name: str, limit: int = 12
) -> list[dict]:
    """Top keys for one dimension (`path`, `referrer`, `device`)."""
    rows = (
        await db.execute(
            select(DimensionDaily.key, func.sum(DimensionDaily.count).label("total"))
            .where(
                DimensionDaily.dimension == name,
                DimensionDaily.day.between(window.start, window.end),
            )
            .group_by(DimensionDaily.key)
            .order_by(func.sum(DimensionDaily.count).desc())
            .limit(limit)
        )
    ).all()
    return [{"key": r.key, "count": int(r.total)} for r in rows]


def _ctr(views: int, clicks: int) -> float:
    """Clicks as a percentage of views, to one decimal.

    Zero views yields 0.0 rather than a division error or a null. A product
    nobody has seen has no click-through rate, and every honest way to say that
    in a number is 0 — the row's `views` column is what tells you the 0 means
    "no data" rather than "nobody clicked".
    """
    return round((clicks / views) * 100, 1) if views else 0.0


def _change(current: int, previous: int) -> float | None:
    """Percentage change, or None where the comparison would be a lie.

    A previous period of zero has no percentage change — going from 0 to 40 is
    not "up 100%", it is not a percentage at all — and rendering it as ∞ or as
    +100% both invent a number. None is the honest answer and the UI renders it
    as "no prior data".
    """
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


async def overview(db: AsyncSession, days: int = 30) -> dict:
    """Everything the analytics screen needs, in one response.

    Assembled server-side rather than as six endpoints the page calls in
    parallel, because every one of these queries is a range scan over the same
    date window on the same three tables. Six requests would mean six admin
    token verifications and six connection checkouts to answer one screen.
    """
    window = Window.of(days)

    views, clicks = await _totals(db, window.start, window.end)
    prev_views, prev_clicks = await _totals(db, window.prev_start, window.prev_end)
    page_views = await _page_views(db, window.start, window.end)
    prev_page_views = await _page_views(db, window.prev_start, window.prev_end)

    return {
        "days": days,
        "start": window.start.isoformat(),
        "end": window.end.isoformat(),
        "totals": {
            "pageViews": page_views,
            "productViews": views,
            "clicks": clicks,
            "ctr": _ctr(views, clicks),
            "pageViewsChange": _change(page_views, prev_page_views),
            "productViewsChange": _change(views, prev_views),
            "clicksChange": _change(clicks, prev_clicks),
        },
        "series": await timeseries(db, window),
        "topProducts": await top_products(db, window),
        "topConverting": await top_converting(db, window),
        "retailers": await by_retailer(db, window),
        "paths": await dimension(db, window, "path"),
        "referrers": await dimension(db, window, "referrer", limit=10),
        "devices": await dimension(db, window, "device", limit=3),
        # Part of the payload rather than something the route staples on
        # afterwards. It was the latter, and that made the field a property of
        # one endpoint instead of a property of this response — a second caller
        # of overview() would have produced a dict that satisfies the
        # TypeScript type in name only, missing the one field that tells a
        # broken deployment apart from a quiet week.
        "hasData": await has_any_data(db),
    }


async def has_any_data(db: AsyncSession) -> bool:
    """Whether anything has ever been recorded.

    The dashboard needs to tell two states apart that look identical in the
    data: "tracking is live and nobody visited this week" and "tracking has
    never recorded anything, so it is probably not deployed". Both render as
    zeroes; only the second is a problem, and only this query distinguishes them.
    """
    return (
        await db.execute(select(literal(1)).select_from(ProductDaily).limit(1))
    ).first() is not None or (
        await db.execute(select(literal(1)).select_from(DimensionDaily).limit(1))
    ).first() is not None


async def pulse(db: AsyncSession, days: int = 7, spark_days: int = 14) -> dict:
    """The compact summary the main dashboard shows beside its other tiles.

    Deliberately not `overview(days=7)` with the big tables thrown away: that
    would run six aggregates and two joins to produce four numbers and a
    fourteen-point sparkline. This is four scans.
    """
    window = Window.of(days)
    views, clicks = await _totals(db, window.start, window.end)
    prev_views, prev_clicks = await _totals(db, window.prev_start, window.prev_end)
    page_views = await _page_views(db, window.start, window.end)

    return {
        "days": days,
        "pageViews": page_views,
        "productViews": views,
        "clicks": clicks,
        "ctr": _ctr(views, clicks),
        "viewsChange": _change(views, prev_views),
        "clicksChange": _change(clicks, prev_clicks),
        "sparkline": await sparkline(db, spark_days),
        "hasData": await has_any_data(db),
    }


async def sparkline(db: AsyncSession, days: int = 14) -> list[int]:
    """Daily page views for the small chart on the main dashboard.

    Its own query rather than a slice of `overview()`: the dashboard shows this
    beside eleven other tiles and has no use for the top-product tables, and
    making it call `overview()` would run six aggregates to draw fourteen bars.
    """
    window = Window.of(days)
    rows = {
        r.day: int(r.total)
        for r in (
            await db.execute(
                select(DimensionDaily.day, func.sum(DimensionDaily.count).label("total"))
                .where(
                    DimensionDaily.dimension == "path",
                    DimensionDaily.day.between(window.start, window.end),
                )
                .group_by(DimensionDaily.day)
            )
        ).all()
    }
    return [
        rows.get(window.start + dt.timedelta(days=offset), 0) for offset in range(window.days)
    ]
