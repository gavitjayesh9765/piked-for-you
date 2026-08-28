"""
The JWKS cache, proved to refresh *off* the request path.

This exists because of a specific outage shape, and the thing that makes it
worth a test is that the broken version looked completely fine in every quiet
moment. `PyJWKClient` performs a **blocking** urllib fetch. `verify_token` is
called from async code — including `rate_limit_key`, which runs in middleware
ahead of every single route — so for as long as that fetch is outstanding, a
single-worker process answers nothing at all: not the request that triggered
it, and not the ones queued behind it.

The old code rebuilt the client whenever it was older than the TTL, *inside*
the request that noticed. So once every ten minutes one unlucky admin paid for
a network round trip on the event loop, and if that round trip was slow the
whole API went dark until it finished — PyJWT's default ceiling being 30
seconds, doubled by the retry to a full minute. Downstream that surfaced as
"The API did not respond in time." on a form the server had, in fact, already
saved.

None of that is visible in a passing request or in the config. It only shows up
as latency someone else has to explain. Hence four properties, pinned:

  1. an expired TTL does not make the caller wait,
  2. a failed refresh does not throw away working keys,
  3. a burst starts one refresh, not one per request,
  4. the fetch ceiling is ours, not PyJWT's 30-second default.

Every test here uses a fake client. A test that reaches the real network could
only ever be flaky about the exact thing it is trying to measure.
"""

from __future__ import annotations

import threading
import time

import pytest

from app.core import supabase as S


class _FakeClient:
    """Stands in for PyJWKClient. `delay` is the fetch this must not block on."""

    def __init__(self, *, delay: float = 0.0, fail: bool = False, tag: str = "ok") -> None:
        self._delay = delay
        self._fail = fail
        self.tag = tag
        self.fetches = 0

    def get_jwk_set(self):
        self.fetches += 1
        if self._delay:
            time.sleep(self._delay)
        if self._fail:
            raise RuntimeError("jwks unreachable")
        return self


@pytest.fixture(autouse=True)
def _reset_jwks_state():
    """The cache is module-global, so one test's client would otherwise be the
    next test's starting state."""
    S._reset_jwks()
    yield
    _settle()
    S._reset_jwks()


def _settle(timeout: float = 5.0) -> None:
    """Wait for any in-flight background refresh to finish.

    Without this a refresh thread outlives its test and mutates module state
    while a later one is asserting on it.
    """
    deadline = time.monotonic() + timeout
    while S._jwk_refreshing and time.monotonic() < deadline:
        time.sleep(0.01)


def _install(client: _FakeClient) -> None:
    """Seed the cache as though this client had just been fetched."""
    S._jwk_client = client
    S._jwk_created_at = time.monotonic()


def _expire() -> None:
    S._jwk_created_at = time.monotonic() - S._JWKS_TTL_SECONDS - 1


def test_an_expired_ttl_does_not_block_the_caller(monkeypatch: pytest.MonkeyPatch) -> None:
    """The regression itself.

    A refresh that takes two seconds must cost the request that trips it
    nothing at all — it gets the keys already in hand while a thread does the
    fetching. The old code awaited this inline, on the event loop.
    """
    warm = _FakeClient(tag="warm")
    _install(warm)
    monkeypatch.setattr(S, "_new_client", lambda: _FakeClient(delay=2.0, tag="fresh"))

    _expire()
    started = time.perf_counter()
    returned = S._jwks()
    elapsed = time.perf_counter() - started

    assert elapsed < 0.1, f"_jwks() blocked for {elapsed:.2f}s — the fetch is back on the hot path"
    assert returned is warm, "callers must keep the cached keys while the refresh is in flight"

    _settle()
    assert S._jwk_client.tag == "fresh", "the refreshed key set was never swapped in"


def test_a_failed_refresh_keeps_the_working_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """Supabase being briefly unreachable must not sign every admin out.

    Signing keys change on rotation, not on our timer, so keys that are a few
    minutes past their refresh point are almost certainly still valid. Dropping
    them turns a transient network blip into a site-wide 401.
    """
    warm = _FakeClient(tag="warm")
    _install(warm)
    monkeypatch.setattr(S, "_new_client", lambda: _FakeClient(fail=True, tag="doomed"))

    _expire()
    assert S._jwks() is warm
    _settle()

    assert S._jwk_client is warm, "a failed refresh discarded keys that still worked"

    # And it backs off, rather than re-attempting on every request that follows.
    age = time.monotonic() - S._jwk_created_at
    assert age < S._JWKS_TTL_SECONDS, "no backoff — every later request would retry the fetch"


def test_a_burst_starts_one_refresh_not_one_per_request(monkeypatch: pytest.MonkeyPatch) -> None:
    """The TTL stays expired until the refresh lands, so without the in-flight
    guard a busy moment would start a thread per request — each one a fetch."""
    _install(_FakeClient(tag="warm"))

    built = 0
    lock = threading.Lock()

    def _counting_client() -> _FakeClient:
        nonlocal built
        with lock:
            built += 1
        return _FakeClient(delay=0.3, tag="fresh")

    monkeypatch.setattr(S, "_new_client", _counting_client)

    _expire()
    for _ in range(50):
        S._jwks()
    _settle()

    assert built == 1, f"{built} refreshes started for one expiry"


def test_the_fetch_ceiling_is_ours_not_pyjwts_default() -> None:
    """PyJWT defaults `timeout` to 30 seconds. On a blocking call that runs
    ahead of every route, that is 30 seconds of a dead API — and the retry in
    `_decode` makes it a minute. This pins the ceiling low enough that even the
    unavoidable inline fetch (a real key rotation) stays well inside the
    frontend's own 15s upstream budget."""
    client = S._new_client()

    assert client.timeout == S._JWKS_HTTP_TIMEOUT
    assert S._JWKS_HTTP_TIMEOUT <= 5, "too close to the frontend's 15s budget once retried"

    # Staleness is decided by `_jwks`, so the client must never take itself
    # offline mid-request to refetch. A short internal lifespan here would
    # reintroduce exactly the inline fetch this module removes.
    assert client.jwk_set_cache.lifespan > S._JWKS_TTL_SECONDS
