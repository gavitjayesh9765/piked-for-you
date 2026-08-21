"""
Fetch-layer tests, against a real HTTP server.

Not mocked. The failures this layer exists to handle — a 403, a 404, a
robots.txt that says no, a response body larger than we are willing to hold —
are all properties of an actual socket conversation, and a stubbed transport
would let every one of them pass while the real thing broke.

The server runs on an ephemeral port in a background thread and answers a
handful of fixed paths.
"""

from __future__ import annotations

import threading
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.services.scraper.extract import extract_price
from app.services.scraper.fetch import MAX_RESPONSE_BYTES, FetchError, Fetcher

PRODUCT_PAGE = """<!doctype html>
<html><head>
  <script type="application/ld+json">
    {"@type":"Product","name":"Test","offers":{"@type":"Offer",
     "price":"24990.00","priceCurrency":"INR","availability":"https://schema.org/InStock"}}
  </script>
</head><body><div class="price">Rs. 24,990</div></body></html>
"""

ROBOTS = "User-agent: *\nDisallow: /forbidden/\n"


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str = "text/html; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler's contract
        if self.path == "/robots.txt":
            self._send(200, ROBOTS.encode(), "text/plain")
        elif self.path == "/product":
            self._send(200, PRODUCT_PAGE.encode())
        elif self.path == "/forbidden/product":
            self._send(200, PRODUCT_PAGE.encode())
        elif self.path == "/refused":
            self._send(403, b"no")
        elif self.path == "/rate-limited":
            self._send(429, b"slow down")
        elif self.path == "/gone":
            self._send(404, b"gone")
        elif self.path == "/enormous":
            # Streamed past the cap without ever being buffered whole.
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            chunk = b"x" * 65536
            for _ in range((MAX_RESPONSE_BYTES // len(chunk)) + 4):
                self.wfile.write(chunk)
        else:
            self._send(404, b"?")

    def log_message(self, *_args: object) -> None:
        """Silence. The default handler prints every request to stderr."""


@pytest.fixture(scope="module")
def server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{httpd.server_address[1]}"
    finally:
        httpd.shutdown()
        httpd.server_close()


def fetcher(**overrides) -> Fetcher:
    return Fetcher(
        **{
            "user_agent": "PickDForYouBot/1.0 (test)",
            "timeout_seconds": 10,
            "max_retries": 0,
            "respect_robots": True,
            **overrides,
        }
    )


async def test_fetch_and_extract_a_real_response(server: str) -> None:
    """The whole happy path across a socket: request, decode, parse."""
    async with fetcher() as f:
        fetched = await f.fetch(f"{server}/product")

    assert fetched.status == 200
    reading = extract_price(fetched.html)
    assert reading.price == Decimal("24990.00")
    assert reading.currency == "INR"
    assert reading.in_stock is True


async def test_refusal_is_reported_as_blocked_not_error(server: str) -> None:
    """403 and 429 mean "you, specifically" — a reason to slow down, not to fix
    a URL. The distinction drives what the results table tells an editor."""
    async with fetcher() as f:
        for path in ("/refused", "/rate-limited"):
            with pytest.raises(FetchError) as caught:
                await f.fetch(f"{server}{path}")
            assert caught.value.blocked is True


async def test_missing_page_is_a_404_not_a_block(server: str) -> None:
    async with fetcher() as f:
        with pytest.raises(FetchError) as caught:
            await f.fetch(f"{server}/gone")

    assert caught.value.status == 404
    assert caught.value.blocked is False


async def test_robots_disallow_is_honoured(server: str) -> None:
    """The page is served happily; we decline to ask for it."""
    async with fetcher() as f:
        with pytest.raises(FetchError) as caught:
            await f.fetch(f"{server}/forbidden/product")

    assert "robots.txt" in str(caught.value)


async def test_robots_can_be_turned_off(server: str) -> None:
    """The switch exists, and it is the admin panel's to flip."""
    async with fetcher(respect_robots=False) as f:
        fetched = await f.fetch(f"{server}/forbidden/product")
    assert fetched.status == 200


async def test_an_enormous_response_is_abandoned(server: str) -> None:
    """A retailer streaming us 200MB must not become a memory incident."""
    async with fetcher() as f:
        with pytest.raises(FetchError) as caught:
            await f.fetch(f"{server}/enormous")

    assert "large" in str(caught.value)


async def test_a_dead_host_is_an_error_not_a_crash(server: str) -> None:
    """Every transport failure has to arrive as a FetchError, because the
    runner records outcomes and a bare exception would end the whole run."""
    async with fetcher() as f:
        with pytest.raises(FetchError):
            # Port 1 on localhost: nothing listens, and the refusal is instant.
            await f.fetch("http://127.0.0.1:1/product")
