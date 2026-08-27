"""
Admin analytics endpoints.

Mounted under the same `get_current_admin` gate as the rest of `/admin`, so
every route here already requires a verified token, `role == "admin"` and
completed MFA. Nothing in this file re-checks that, and nothing in it should.

Read-only by construction: there is no write route here at all. The only thing
that writes an analytics counter is the public beacon in
`modules/analytics/router.py`, which means there is no admin action anywhere
that can adjust a number after the fact. That is worth keeping.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.core.deps import CurrentAdmin, DbSession
from app.modules.analytics import service

router = APIRouter()

#: The windows the UI offers. A closed set rather than a free integer because
#: `days` reaches a BETWEEN on an indexed range scan — 100000 would be a full
#: table scan requested from a query string, on an authenticated route where
#: nobody would think to look for it.
ALLOWED_WINDOWS = (7, 30, 90)
DEFAULT_WINDOW = 30


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"


@router.get("/analytics")
async def analytics_overview(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
    days: Annotated[int, Query(description="Window length. 7, 30 or 90.")] = DEFAULT_WINDOW,
) -> dict:
    """Everything the analytics screen renders, in one round trip."""
    _private(response)
    window = days if days in ALLOWED_WINDOWS else DEFAULT_WINDOW
    # `hasData` comes back as part of this payload — it distinguishes "quiet
    # week" from "tracking was never deployed", both of which are all zeroes.
    return await service.overview(db, window)


@router.get("/analytics/pulse")
async def analytics_pulse(
    admin: CurrentAdmin,
    db: DbSession,
    response: Response,
) -> dict:
    """The small summary the main dashboard shows beside its other tiles.

    Separate from `/analytics` because the dashboard needs four numbers and a
    fourteen-point sparkline, and running the full overview to get them would
    execute six aggregate queries the page then throws away.
    """
    _private(response)
    return await service.pulse(db)
