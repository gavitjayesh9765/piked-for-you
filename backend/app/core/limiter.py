"""
Rate limiting.

`slowapi` and `redis` have been in `pyproject.toml`, and `RATE_LIMIT_ANON`,
`RATE_LIMIT_AUTH`, `RATE_LIMIT_WRITE` and `REDIS_URL` have been in the settings
and in `.env`, since the first commit. Nothing imported any of them. The
configuration read as done while every endpoint was unmetered — which is worse
than having none, because it is the sort of thing nobody re-checks.

This module is the missing wiring.

**Keying.** Authenticated callers are keyed by their token subject, anonymous
ones by IP. That distinction is the whole reason a single global limit is not
enough: one office or one mobile carrier NATs many people behind one address,
so an IP-only limit punishes them for each other, while a signed-in abuser
behind a rotating IP is not slowed down at all. The subject comes from the
verified signature, so it cannot be spoofed to borrow someone else's budget.

**Storage.** Redis when `REDIS_URL` points somewhere reachable, in-process
memory otherwise. In-memory is honest but weak: it resets on deploy and is
per-worker. That is acceptable at one worker (see `render.yaml`) and stops
being acceptable the moment you scale out — hence the startup log line rather
than a silent fallback.
"""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.supabase import TokenError, bearer_from_header, verify_token

logger = logging.getLogger(__name__)


def rate_limit_key(request: Request) -> str:
    """Token subject for signed-in callers, IP for everyone else.

    Verification here is the same `verify_token` every dependency uses, so an
    expired or forged token silently falls back to the IP bucket rather than
    granting the larger authenticated allowance.
    """
    token = bearer_from_header(request.headers.get("authorization"))
    if token:
        try:
            return f"user:{verify_token(token).id}"
        except TokenError:
            pass

    # `get_remote_address` reads request.client.host. Behind Render's proxy
    # uvicorn is started with --proxy-headers, so this is the real client
    # address rather than the proxy's.
    return f"ip:{get_remote_address(request)}"


def _storage_uri() -> str:
    """Redis if it is configured AND actually reachable, memory otherwise.

    The reachability check is the important half, and it is here because of a
    specific way this feature would have shipped broken: `REDIS_URL` defaults
    to `redis://localhost:6379/0`, and `render.yaml` does not set it. So on
    the deployed instance the limiter would have pointed at a Redis that does
    not exist, and — with `swallow_errors=True` below — failed open on every
    request. The configuration would have read as "rate limiting: on" while
    nothing was ever counted, which is the exact failure this whole module was
    written to correct.

    Falling back to in-process memory is a real limit rather than none. It is
    per-worker and resets on deploy, which is acceptable at one worker (see
    `render.yaml`, which pins `--workers 1`) and stops being acceptable the
    moment you scale out — hence the log line loud enough to notice.
    """
    url = (settings.REDIS_URL or "").strip()
    if not url:
        logger.warning(
            "No REDIS_URL set. Rate limits are kept in memory: per-worker, and "
            "reset on every deploy. Correct at --workers 1; not beyond that."
        )
        return "memory://"

    try:
        from limits.storage import storage_from_string

        storage = storage_from_string(url)
        if storage.check():
            return url
        raise RuntimeError("storage check returned False")
    except Exception as exc:
        logger.warning(
            "REDIS_URL is set (%s) but unreachable (%s). Falling back to in-memory "
            "rate limiting: per-worker, and reset on every deploy. Fix the URL or "
            "clear it to silence this.",
            url.split("@")[-1],  # never log credentials from the URL
            exc,
        )
        return "memory://"


limiter = Limiter(
    key_func=rate_limit_key,
    # Applied to every route that does not name its own. A default of "none"
    # is how endpoints get forgotten; this way a new route is metered before
    # anyone remembers to think about it.
    default_limits=[settings.RATE_LIMIT_ANON],
    storage_uri=_storage_uri(),
    # A limiter that cannot reach its backend must not take the API down with
    # it. Failing open is the right call *here* specifically because these
    # limits are abuse control, not authorization — nothing below this line
    # decides who may do what.
    swallow_errors=True,
    # OFF, for two independent reasons.
    #
    # Correctness: with headers on, slowapi injects X-RateLimit-* into the
    # response of every `@limiter.limit`-decorated endpoint, which requires
    # that endpoint to hand it a `starlette.Response`. Ours return Pydantic
    # models, so each decorated route raised at request time — caught by
    # tests/test_rate_limit.py rather than in production.
    #
    # Disclosure: those headers state the exact budget and how much of it is
    # left. That is a precise description of how fast an abuser may go without
    # tripping the limit, and it would contradict the 429 below, which
    # deliberately withholds the same numbers.
    headers_enabled=False,
)


# --- The three budgets, named so routes read as intent rather than numbers ---

#: Public reads: product pages, search, taxonomy.
PUBLIC = settings.RATE_LIMIT_ANON

#: Signed-in reads: the account area, saved lists, personalisation.
AUTHENTICATED = settings.RATE_LIMIT_AUTH

#: Anything that writes, uploads, emails, or starts a scrape.
WRITE = settings.RATE_LIMIT_WRITE


def rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """The 429.

    One uniform message. It deliberately does not say which limit was hit or
    what the ceiling is: on the public write endpoints those numbers describe
    exactly how fast an abuser may go without tripping it.

    `Retry-After` is still sent, because a legitimate client needs to know when
    to come back and that is a bound the caller can measure anyway.
    """
    response = JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Slow down and try again shortly."},
    )
    retry_after = getattr(exc, "retry_after", None)
    response.headers["Retry-After"] = str(retry_after or 60)
    response.headers["Cache-Control"] = "no-store"
    return response
