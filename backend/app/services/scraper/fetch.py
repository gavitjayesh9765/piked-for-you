"""
Getting the page.

Two engines behind one interface:

  http     one `httpx` request. Fast, cheap, and enough for any storefront that
           renders its price server-side — which is most of them, because they
           want Google to see it.
  browser  a headless render via Crawl4AI, for the ones that build the price in
           JavaScript. Optional: the dependency is not installed by default,
           and asking for this engine without it produces a clear message
           rather than an ImportError halfway through a run.

Also here: robots.txt, honoured by default and cached per host for the lifetime
of a run. We are reading a handful of pages we already link to, on behalf of a
site that sends these retailers traffic — but "we could get away with it" is
not a reason to ignore a site's stated preference, and the switch to turn it
off is deliberately in the admin panel where someone has to own the decision.
"""

from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.core.net import UnsafeUrl, validate_outbound_url

Engine = Literal["http", "browser"]

# Sent alongside the configured User-Agent. A storefront that gets a request
# with no Accept-Language and no Accept at all is being told, fairly clearly,
# that it is not talking to a browser.
BASE_HEADERS: dict[str, str] = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}

# Statuses that mean "you, specifically, are not welcome" rather than "this
# page is broken". Worth distinguishing: one is a reason to slow down, the
# other is a reason to fix a URL.
BLOCKED_STATUSES = frozenset({401, 403, 407, 429, 503})

# Larger than any product page has a right to be. A retailer streaming us a
# 200 MB response should not become a memory incident.
MAX_RESPONSE_BYTES = 8 * 1024 * 1024

# Redirect hops we will follow. Retailers genuinely chain two or three (country
# redirect, then a consent interstitial, then the canonical URL); nobody needs
# six. Every hop is re-validated, which is the reason the chain is walked here
# instead of by httpx.
MAX_REDIRECTS = 5


class FetchError(Exception):
    """The page could not be retrieved. Carries what to record about it."""

    def __init__(self, message: str, *, status: int | None = None, blocked: bool = False):
        super().__init__(message)
        self.status = status
        self.blocked = blocked


@dataclass(frozen=True, slots=True)
class Fetched:
    html: str
    status: int
    final_url: str


class RobotsCache:
    """robots.txt per host, fetched once per run.

    A failure to *read* robots.txt is treated as permission, not refusal —
    which is the conventional reading, and the alternative would mean one flaky
    request silently cancels a whole retailer's worth of checks.
    """

    def __init__(
        self, client: httpx.AsyncClient, user_agent: str, allow_private: bool = False
    ) -> None:
        self._client = client
        self._user_agent = user_agent
        self._allow_private = allow_private
        self._cache: dict[str, RobotFileParser | None] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def allows(self, url: str) -> bool:
        parsed = urlparse(url)
        host = f"{parsed.scheme}://{parsed.netloc}"

        lock = self._locks.setdefault(host, asyncio.Lock())
        async with lock:
            if host not in self._cache:
                self._cache[host] = await self._load(host)

        parser = self._cache[host]
        if parser is None:
            return True
        return parser.can_fetch(self._user_agent, url)

    async def _load(self, host: str) -> RobotFileParser | None:
        # Same guard as a page fetch. robots.txt is fetched from a host string
        # built out of a URL someone supplied, so it is an outbound request to
        # a chosen address like any other.
        try:
            robots_url = validate_outbound_url(
                urljoin(host, "/robots.txt"), allow_private=self._allow_private
            )
        except UnsafeUrl:
            return None

        try:
            response = await self._client.get(robots_url, timeout=10.0)
        except httpx.HTTPError:
            return None

        # Redirects are not followed for robots.txt. Following one would mean
        # fetching an address nothing validated, and this class already treats
        # "could not read it" as permission — so a redirect costs nothing here
        # beyond the same permissive default a timeout would give.
        if response.is_redirect or response.status_code >= 400:
            return None

        parser = RobotFileParser()
        parser.parse(response.text.splitlines())
        return parser


class Fetcher:
    """One HTTP client and one robots cache, shared across a whole run.

    Sharing the client is not a micro-optimisation: connection reuse and a
    single cookie jar are what keep a run from looking like a hundred
    unrelated first-time visitors to the same host.
    """

    def __init__(
        self,
        *,
        user_agent: str,
        timeout_seconds: int,
        max_retries: int,
        respect_robots: bool,
        allow_private_addresses: bool = False,
    ) -> None:
        self._user_agent = user_agent
        self._max_retries = max_retries
        self._respect_robots = respect_robots
        # Tests only, and ignored outright in production — see
        # app/core/net.py::_bypass_allowed. No production call site passes it.
        self._allow_private = allow_private_addresses

        self._client = httpx.AsyncClient(
            headers={**BASE_HEADERS, "User-Agent": user_agent},
            timeout=httpx.Timeout(timeout_seconds),
            # OFF, deliberately, and the reason is the whole point of
            # app/core/net.py: httpx following a redirect on our behalf means
            # fetching an address that nothing checked. A URL that validates on
            # submission and then 302s to 169.254.169.254 would defeat a guard
            # applied only to the value the admin typed. `_follow` below walks
            # the chain and re-validates every hop.
            follow_redirects=False,
            # Retailers redirect to regional domains and consent interstitials;
            # a shared jar means the second page in a run is not asked again.
            cookies=httpx.Cookies(),
        )
        self._robots = RobotsCache(self._client, user_agent, allow_private_addresses)

    async def __aenter__(self) -> Fetcher:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch(
        self, url: str, *, engine: Engine = "http", headers: dict[str, str] | None = None
    ) -> Fetched:
        # Before anything else — before robots, before a connection is opened.
        # `UnsafeUrl` becomes a blocked `FetchError` so callers keep their one
        # exception type, and `blocked=True` because that is what it is: a
        # refusal to make this request at all, not a transport failure to retry.
        try:
            url = validate_outbound_url(url, allow_private=self._allow_private)
        except UnsafeUrl as exc:
            raise FetchError(str(exc), blocked=True) from exc

        if self._respect_robots and not await self._robots.allows(url):
            raise FetchError(
                "This retailer's robots.txt disallows fetching this URL. "
                "Either exclude the link or turn off robots enforcement in Pricing → Settings.",
                blocked=True,
            )

        if engine == "browser":
            return await self._fetch_browser(url)
        return await self._fetch_http(url, headers or {})

    async def _fetch_http(self, url: str, headers: dict[str, str]) -> Fetched:
        """One GET, with backoff on the failures that backoff actually helps.

        Retries cover timeouts, connection resets and 5xx — transient things.
        A 403 is not retried: the answer will not change in two seconds, and
        hammering it is how a soft block becomes a hard one.
        """
        last_error: Exception | None = None

        for attempt in range(self._max_retries + 1):
            if attempt:
                # Jittered backoff. Fixed sleeps from several workers
                # re-synchronise into exactly the burst we are avoiding.
                await asyncio.sleep((2**attempt) * 0.5 + random.uniform(0, 0.4))

            try:
                return await self._follow(url, headers)
            except FetchError:
                # Already a decided outcome — a block, a 404, or a refused
                # redirect target. Not retryable.
                raise
            except (httpx.HTTPError, httpx.StreamError) as err:
                last_error = err

        raise FetchError(f"Could not reach the page: {last_error}")

    async def _follow(self, url: str, headers: dict[str, str]) -> Fetched:
        """Walk the redirect chain ourselves, validating every hop.

        This is the loop httpx would run internally if `follow_redirects` were
        on. It is here so that `validate_outbound_url` sees each target — a
        public URL that redirects to `http://169.254.169.254/` is the standard
        way an SSRF filter that only checks the submitted value gets bypassed.
        """
        current = url

        for _hop in range(MAX_REDIRECTS + 1):
            async with self._client.stream("GET", current, headers=headers) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise FetchError(
                            f"The retailer sent a {response.status_code} with no destination.",
                            status=response.status_code,
                        )
                    # Resolve relative Locations against the URL we actually
                    # requested, exactly as a browser would, then re-check the
                    # result from scratch.
                    target = str(response.url.join(location))
                    try:
                        current = validate_outbound_url(
                            target, allow_private=self._allow_private
                        )
                    except UnsafeUrl as exc:
                        raise FetchError(
                            f"That page redirects somewhere the server will not follow: {exc}",
                            status=response.status_code,
                            blocked=True,
                        ) from exc
                    continue

                if response.status_code in BLOCKED_STATUSES:
                    raise FetchError(
                        f"The retailer refused the request ({response.status_code}). "
                        "Slow the run down in Pricing → Settings, or switch this "
                        "retailer to the browser engine.",
                        status=response.status_code,
                        blocked=True,
                    )
                if response.status_code == 404:
                    raise FetchError(
                        "The product page no longer exists (404). The link needs updating.",
                        status=404,
                    )
                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"server error {response.status_code}",
                        request=response.request,
                        response=response,
                    )
                if response.status_code >= 400:
                    raise FetchError(
                        f"The request failed ({response.status_code}).",
                        status=response.status_code,
                    )

                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise FetchError(
                            "The page is unreasonably large; stopped reading it.",
                            status=response.status_code,
                        )
                    chunks.append(chunk)

                body = b"".join(chunks)
                encoding = response.charset_encoding or "utf-8"
                return Fetched(
                    html=body.decode(encoding, errors="replace"),
                    status=response.status_code,
                    final_url=str(response.url),
                )

        raise FetchError(
            f"That link redirected more than {MAX_REDIRECTS} times without arriving anywhere.",
            blocked=True,
        )

    async def _fetch_browser(self, url: str) -> Fetched:
        """Headless render, for prices that only exist after JavaScript runs.

        Imported here rather than at module scope so the whole scraper keeps
        working — with the http engine — on an install that never wanted a
        browser stack.

        ⚠ The entry URL has been validated by `fetch()`, but the redirect and
        sub-resource fetching from here on is the browser's, not ours — this
        engine cannot offer the per-hop guarantee `_follow` does. It is
        optional and off by default (the dependency is not installed); if it is
        ever turned on in production, the browser needs its own network policy
        — an egress firewall or a proxy — rather than a check in this process.
        """
        try:
            from crawl4ai import AsyncWebCrawler  # type: ignore[import-not-found]
        except ImportError as err:
            raise FetchError(
                "The browser engine needs Crawl4AI, which is not installed. "
                "Install the extra (pip install -e '.[scraping]' && crawl4ai-setup) "
                "or set this retailer back to the http engine.",
            ) from err

        try:
            async with AsyncWebCrawler(verbose=False) as crawler:
                result = await crawler.arun(url=url, bypass_cache=True)
        except Exception as err:  # crawl4ai raises its own hierarchy
            raise FetchError(f"The headless browser could not load the page: {err}") from err

        html = getattr(result, "html", None) or getattr(result, "cleaned_html", None)
        if not html:
            raise FetchError("The headless browser returned an empty page.")

        return Fetched(html=html, status=200, final_url=getattr(result, "url", url))
