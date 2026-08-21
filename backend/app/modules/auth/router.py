"""
Session introspection.

**We no longer implement authentication.** Supabase Auth owns registration,
login, password reset, email confirmation, session refresh, and MFA — the
browser talks to it directly and never routes credentials through this API.

That is deliberate. Hand-rolled auth is where most real breaches come from, and
every line of it we delete is a line that cannot have a bug. There is no
`/register`, `/login`, or `/password-reset` endpoint here to attack.

What remains is read-only: "who does this token say I am, according to the
signature?" Useful for hydrating a UI; never a source of authority on its own.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.models import Profile

router = APIRouter()


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionOut(Wire):
    """Derived entirely from the verified JWT plus the caller's own profile row.

    `is_admin` is reported here for UI convenience only. Tampering with it in
    transit changes what the browser draws and nothing else — every admin
    endpoint re-derives the role from the signature on its own request.
    """

    id: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    is_admin: bool = False
    # True when the password checked out but the second factor has not been
    # supplied yet, so the client can prompt for a code rather than an error.
    mfa_required: bool = False


@router.get("/session", response_model=SessionOut | None)
async def get_session(user: OptionalUser, db: DbSession, response: Response) -> SessionOut | None:
    """Current session, or null when signed out.

    Never cached: a shared or stale copy of this response would be a session
    leak between users.
    """
    response.headers["Cache-Control"] = "no-store, private"

    if user is None:
        return None

    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalar_one_or_none()

    return SessionOut(
        id=str(user.id),
        email=user.email,
        display_name=profile.display_name if profile else None,
        avatar_url=profile.avatar_url if profile else None,
        is_admin=user.is_admin,
        mfa_required=user.is_admin_pending_mfa,
    )


class ProfileUpdate(Wire):
    # Strict: an unknown field is rejected outright rather than ignored, so a
    # crafted payload carrying `role`, `is_active`, or `email` cannot ride along.
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    display_name: str | None = None
    avatar_url: str | None = None


@router.patch("/profile", response_model=SessionOut)
async def update_profile(
    payload: ProfileUpdate, user: CurrentUser, db: DbSession, response: Response
) -> SessionOut:
    """Update your own profile — and only your own.

    The row is located by `user.id` from the token, never by an id in the
    request body, so there is no parameter to tamper with. Row Level Security
    refuses a mismatched row as well.

    Only `display_name` and `avatar_url` are writable. Email changes go through
    Supabase Auth, which requires confirming both addresses.
    """
    response.headers["Cache-Control"] = "no-store, private"

    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        # The auth trigger creates this row; its absence means a broken account,
        # not a permissions problem.
        from fastapi import HTTPException

        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

    if payload.display_name is not None:
        profile.display_name = payload.display_name.strip()
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url.strip() or None

    await db.flush()

    return SessionOut(
        id=str(user.id),
        email=user.email,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        is_admin=user.is_admin,
        mfa_required=user.is_admin_pending_mfa,
    )


@router.get("/config", response_model=dict)
async def auth_config(response: Response) -> dict:
    """Public auth configuration for the client SDK.

    Contains only values that are safe to publish. The service-role key and JWT
    secret are never exposed here or anywhere else reachable by a browser.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    return {
        "supabaseUrl": settings.SUPABASE_URL,
        "requireAdminMfa": settings.REQUIRE_ADMIN_MFA,
    }
