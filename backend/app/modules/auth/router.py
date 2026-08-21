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

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core import audit
from app.core.config import settings
from app.core.deps import CurrentAdmin, CurrentUser, DbSession, OptionalUser, client_ip
from app.core.limiter import WRITE, limiter
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


@router.post("/admin-sign-in", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
@limiter.limit(WRITE)
async def record_admin_sign_in(
    request: Request, admin: CurrentAdmin, db: DbSession, response: Response
) -> None:
    """Write one `auth.admin_sign_in` entry to the audit log.

    Why this endpoint exists at all: authentication happens in the browser
    against Supabase Auth, so the server never sees a sign-in and the audit
    trail could not answer "who entered the panel, and when?" — only what they
    changed once inside. Supabase keeps its own auth log, but correlating two
    systems by timestamp during an incident is exactly the work you do not want
    to be doing during an incident.

    What it can and cannot be trusted for, stated plainly:

      * **Who** is trustworthy. `CurrentAdmin` re-verifies the signature, the
        role and `aal2`, so the actor recorded is the token's real subject.
      * **Whether a sign-in happened** is not independently verified — a caller
        holding a valid aal2 admin token could post this without having just
        signed in. They are, by definition, already an authenticated admin, so
        the entry is at worst redundant, never a forged identity.

    It is therefore a convenience record, not evidence, and the rate limit
    keeps it from becoming a way to flood the log.
    """
    response.headers["Cache-Control"] = "no-store, private"

    await audit.record(
        db,
        actor_id=admin.id,
        action="auth.admin_sign_in",
        entity_type="session",
        summary=f"Admin session started for {admin.email or admin.id}",
        meta={"session_id": admin.session_id, "aal": admin.aal},
        ip_address=client_ip(request),
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
