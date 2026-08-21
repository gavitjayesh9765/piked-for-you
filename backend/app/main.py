"""
PickDForYou API — a modular monolith (spec §64).

Each domain lives in app/modules/<domain>/ with its own router, service and
repository. They share one process and one database, but the boundaries are
real, so a module can be lifted out later if scale genuinely demands it. The
spec is explicit about not splitting into microservices prematurely.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import limiter, rate_limited
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the JWKS before serving. Without this the first few requests after
    # a deploy pay for the fetch, and a slow one shows up as spurious 401s.
    import asyncio
    import logging

    from app.core.supabase import warm_jwks

    ok = await asyncio.to_thread(warm_jwks)
    if not ok:
        logging.getLogger("uvicorn.error").warning(
            "Could not fetch Supabase JWKS at startup — check SUPABASE_URL. "
            "Token verification will retry per request."
        )

    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description=(
        "Product research, comparison and recommendation platform. "
        "Public endpoints expose published content only; admin endpoints require "
        "authentication and an appropriate role."
    ),
    # Interactive docs are useful in development and an attack surface in
    # production — off by default there (spec §46).
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# --- Rate limiting -------------------------------------------------------
# The limiter object has to live on app.state: slowapi's decorator looks it up
# there at request time rather than closing over the instance.
#
# SlowAPIMiddleware applies `default_limits` to every route, including ones
# that never named a limit. Routes that need a different budget declare it with
# @limiter.limit(...) and that declaration wins. Ordering matters — this is
# added last, so it runs first, and a caller who is over their budget is turned
# away before the request reaches a database session.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limited)  # type: ignore[arg-type]
app.add_middleware(SlowAPIMiddleware)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["system"], include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.ENVIRONMENT}
