"""
The tracking beacon endpoint.

One public, unauthenticated POST. It is the only write path into the analytics
tables, and it is built around a single idea: **this endpoint may never be
observable from the outside**.

  * It always answers 204, whether it counted the event, discarded it as a bot,
    or failed outright. A response that varied would turn a counter into an
    oracle — "does this product id exist?" is a question the public API answers
    deliberately and carefully elsewhere, and it must not be answerable by
    accident here.
  * It never returns a body, so there is nothing to read back.
  * It cannot affect the page that called it. The browser has already rendered
    by the time the beacon fires and is not waiting for the response.

The counters this feeds are therefore approximate by design, and the places
that make them approximate are all on purpose: bots are filtered by user agent
(imperfectly), rate limits drop the excess, and anything that raises is
swallowed. A number that is 3% low is useful. A tracking call that can 500 a
reader's page load, or that can be used to enumerate the catalogue, is not.
"""

from __future__ import annotations

import uuid
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.core.config import settings
from app.core.deps import DbSession
from app.core.limiter import limiter
from app.modules.analytics import service

router = APIRouter()

#: Deliberately looser than RATE_LIMIT_WRITE (20/minute). This is the cheapest
#: write in the system — one upsert into a table with a four-column key — and
#: it fires once per page view rather than once per user action, so a reader
#: browsing quickly, or an office behind one NAT'd address, would trip a
#: write-sized budget while doing nothing wrong. The cost of that is silently
#: wrong numbers, which is the one failure mode this feature cannot detect.
TRACK_LIMIT = "240/minute"


class TrackIn(BaseModel):
    """What the beacon sends.

    Note what is NOT here: no session id, no visitor id, no timestamp, no
    screen size, no user id even when the reader is signed in. The endpoint
    reads the user agent from the request headers to classify the device and to
    filter bots, and it is never stored — only the bucket it maps to.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    kind: Literal["view", "click"]
    product_id: uuid.UUID | None = None
    retailer_id: uuid.UUID | None = None
    #: The `product_retailers` row behind the button that was clicked. When
    #: present it wins over the two fields above: the server resolves BOTH
    #: the product and the retailer from it, so a caller cannot pair a
    #: product with a shop that does not sell it. See `service.record`.
    link_id: uuid.UUID | None = None
    #: The path only. The client sends `location.pathname`, and the server
    #: normalises it to a route shape regardless — but the cap is here as well
    #: so a megabyte of text cannot be posted at a public endpoint.
    path: str | None = Field(default=None, max_length=512)
    #: `document.referrer`. Reduced to a bare host before storage, and dropped
    #: entirely when it is same-site.
    referrer: str | None = Field(default=None, max_length=512)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(TRACK_LIMIT)
async def track(request: Request, payload: TrackIn, db: DbSession) -> Response:
    """Record one view or one click. Always 204.

    ⚠ The `request: Request` parameter is required by slowapi's decorator, not
    by this function — remove it and the limit silently stops applying. It is
    also genuinely used here, for the user agent.
    """
    await service.record(
        db,
        kind=payload.kind,
        product_id=payload.product_id,
        retailer_id=payload.retailer_id,
        link_id=payload.link_id,
        path=payload.path,
        referrer=payload.referrer,
        user_agent=request.headers.get("user-agent"),
        own_host=_own_host(request),
    )

    # `no-store` because a cached 204 in front of this endpoint would mean a
    # CDN answering beacons on its own and the counters silently flatlining.
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})


def _own_host(request: Request) -> str | None:
    """The site's own host, so same-site referrers can be discarded.

    ---------------------------------------------------------------------------
    THE `Origin` HEADER FIRST, AND WHY IT IS THE RIGHT SOURCE

    This beacon is a cross-origin POST — the site and the API are on different
    hosts — so the browser sends `Origin` on every one of them, and it is the
    site that made the call. That is exactly the host we want to compare a
    referrer against, it is set by the browser rather than by configuration,
    and it stays correct across preview deployments, custom domains and local
    development without anybody remembering to update a setting.

    It is also trivially forgeable by a non-browser caller, and that does not
    matter here: the worst a forged Origin achieves is suppressing one
    referrer row in an anonymous counter. Nothing downstream is authorised by
    it — CORS enforcement is the middleware's job and is unaffected by this.

    ⚠ The earlier version of this derived the host from `CORS_ORIGINS` alone,
    and it was quietly wrong in development: the list is `http://localhost:3000`
    there, so `own_host` came out as "localhost", every real referrer compared
    unequal, and same-site referrers were counted as referrals. It looked
    correct in production and broken nowhere anyone would see it.

    The configured origin is kept as the fallback for callers that send no
    Origin at all — the `keepalive` fetch path in some browsers, and curl.
    """
    origin = request.headers.get("origin")
    if origin:
        host = urlsplit(origin).hostname
        if host:
            return host

    origins = settings.CORS_ORIGINS or []
    for configured in origins:
        host = urlsplit(configured).hostname
        if host:
            return host
    return None
