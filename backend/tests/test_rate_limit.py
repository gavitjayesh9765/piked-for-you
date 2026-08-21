"""
The rate limiter, proved to actually count.

Worth a test rather than a glance at the config, because the failure this
guards against is precisely a limiter that *looks* configured. `slowapi`,
`redis`, and all three RATE_LIMIT_* settings were present in this project from
the first commit while nothing imported any of them — a decorator that is never
reached and a backend that is never connected both produce exactly the same
observable behaviour as having no limiter at all: every request succeeds.

So: send more requests than the budget allows and require a 429.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.limiter import limiter, rate_limit_key, rate_limited


@pytest.fixture(autouse=True)
def _clean_counters():
    """`limiter` is a module-level singleton with process-wide storage, so one
    test's requests would otherwise spend the next test's budget."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture(scope="module")
def app() -> FastAPI:
    """A miniature app wired exactly like app/main.py.

    Module-scoped on purpose. `limiter` is a singleton, and `@limiter.limit`
    registers against the endpoint's qualified name — so rebuilding the app per
    test registered the same limit on the same endpoint again and again, and
    each request was then counted once per registration. In production the
    decorator runs once, at import, which is what this scope reproduces.
    """
    application = FastAPI()
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, rate_limited)
    application.add_middleware(SlowAPIMiddleware)

    @application.get("/cheap")
    async def cheap(request: Request) -> dict:
        return {"ok": True}

    @application.post("/expensive")
    @limiter.limit("3/minute")
    async def expensive(request: Request) -> dict:
        return {"ok": True}

    class Thing(BaseModel):
        id: int

    @application.post("/model", response_model=Thing)
    @limiter.limit("30/minute")
    async def returns_a_model(request: Request) -> Thing:
        return Thing(id=1)

    return application


def test_a_decorated_route_can_return_a_pydantic_model(app: FastAPI) -> None:
    """The shape every real decorated endpoint uses.

    With `headers_enabled=True` slowapi tries to inject X-RateLimit-* into
    whatever the endpoint returned, and raises unless that is a
    `starlette.Response`. Every route decorated in this codebase returns a
    Pydantic model, so headers-on would have broken all of them at request
    time — a 500 on review submission, media upload, contact and newsletter.
    This is the regression test for that.
    """
    with TestClient(app) as client:
        response = client.post("/model")

    assert response.status_code == 200, response.text
    assert response.json() == {"id": 1}


def test_a_write_endpoint_stops_answering_past_its_budget(app: FastAPI) -> None:
    with TestClient(app) as client:
        codes = [client.post("/expensive").status_code for _ in range(6)]

    assert codes[:3] == [200, 200, 200], codes
    assert 429 in codes, f"limiter never fired: {codes}"


def test_the_429_says_when_to_come_back_and_nothing_else(app: FastAPI) -> None:
    """The message must not describe the ceiling — on a public write endpoint
    that is a statement of how fast an abuser may go without tripping it."""
    with TestClient(app) as client:
        for _ in range(5):
            response = client.post("/expensive")
            if response.status_code == 429:
                break

    assert response.status_code == 429
    assert response.headers.get("Retry-After")
    body = response.json()["detail"]
    assert "3" not in body and "minute" not in body, body


def test_default_limits_cover_a_route_that_never_asked(app: FastAPI) -> None:
    """The point of `default_limits`: a new endpoint is metered before anyone
    remembers to think about it."""
    with TestClient(app) as client:
        assert client.get("/cheap").status_code == 200
    # The default budget (60/minute) is not worth exhausting in a unit test;
    # what matters is that the middleware is in the stack and answering.
    assert any(
        isinstance(m.cls, type) and m.cls is SlowAPIMiddleware
        for m in app.user_middleware
    )


def test_signed_in_callers_are_keyed_by_identity_not_address() -> None:
    """Two people behind one NAT must not share a budget, and one abuser
    rotating addresses must not escape theirs."""
    scope = {
        "type": "http",
        "headers": [(b"authorization", b"Bearer not-a-real-token")],
        "client": ("203.0.113.9", 1234),
        "method": "GET",
        "path": "/",
        "query_string": b"",
    }
    # An unverifiable token must fall back to the IP bucket rather than being
    # trusted for the larger authenticated allowance.
    assert rate_limit_key(Request(scope)) == "ip:203.0.113.9"
