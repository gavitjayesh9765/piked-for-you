"""
Try one URL and report what we would have read, without writing anything.

This exists because the alternative — the way selectors normally get fixed — is
to edit a config, start a real run over the whole catalogue, and read a results
table to find out whether the guess was right. That loop is slow enough that
people stop tuning selectors and start accepting broken ones.

Nothing here touches the database. It is the "Test" button next to the selector
field, and it is honest about which strategy fired, so an editor can see that
their selector was skipped and the generic fallback answered instead.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.services.scraper.extract import NoPriceFound, extract_price
from app.services.scraper.fetch import Engine, Fetcher, FetchError


@dataclass(slots=True)
class Preview:
    ok: bool
    url: str
    engine: Engine
    price: Decimal | None = None
    currency: str | None = None
    in_stock: bool | None = None
    strategy: str | None = None
    confidence: str | None = None
    raw: str | None = None
    http_status: int | None = None
    duration_ms: int | None = None
    error: str | None = None


async def preview_url(
    url: str,
    *,
    config: dict[str, Any] | None = None,
    engine: Engine = "http",
    user_agent: str,
    timeout_seconds: int = 20,
    respect_robots: bool = True,
) -> Preview:
    """One fetch, one parse, no writes.

    `max_retries=0`: a test should answer quickly and tell the truth about the
    first attempt. Retrying would hide exactly the flakiness worth seeing.
    """
    started = time.monotonic()

    async with Fetcher(
        user_agent=user_agent,
        timeout_seconds=timeout_seconds,
        max_retries=0,
        respect_robots=respect_robots,
    ) as fetcher:
        try:
            fetched = await fetcher.fetch(url, engine=engine)
        except FetchError as err:
            return Preview(
                ok=False,
                url=url,
                engine=engine,
                error=str(err),
                http_status=err.status,
                duration_ms=int((time.monotonic() - started) * 1000),
            )

        try:
            reading = extract_price(fetched.html, config or {})
        except NoPriceFound as err:
            return Preview(
                ok=False,
                url=url,
                engine=engine,
                error=str(err),
                http_status=fetched.status,
                duration_ms=int((time.monotonic() - started) * 1000),
            )

    return Preview(
        ok=True,
        url=fetched.final_url,
        engine=engine,
        price=reading.price,
        currency=reading.currency,
        in_stock=reading.in_stock,
        strategy=reading.strategy,
        confidence=reading.confidence,
        raw=reading.raw,
        http_status=fetched.status,
        duration_ms=int((time.monotonic() - started) * 1000),
    )
