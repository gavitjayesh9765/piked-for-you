"""Badge endpoints (spec §21). Badges are content, never hard-coded."""

from __future__ import annotations

from fastapi import APIRouter, Response
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import DbSession
from app.models import Badge
from app.schemas.product import BadgeOut

router = APIRouter()


@router.get("", response_model=list[BadgeOut])
async def list_badges(db: DbSession, response: Response) -> list[BadgeOut]:
    """Active badges.

    The frontend maps `style` to a design token, so a badge created in the
    admin panel renders correctly with no deploy — and cannot introduce an
    off-palette colour.
    """
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}, stale-while-revalidate=60"
    )
    rows = (
        await db.execute(
            select(Badge)
            .where(Badge.is_active.is_(True))
            .order_by(Badge.display_order, Badge.name)
        )
    ).scalars().all()
    return [BadgeOut.model_validate(b) for b in rows]
