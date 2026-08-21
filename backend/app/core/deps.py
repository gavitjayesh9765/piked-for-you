"""
Shared FastAPI dependencies — database sessions and authorization gates.

**This module is the security control.** Route protection in the frontend is
chrome; `middleware.ts` only performs a fast redirect. Every protected endpoint
resolves its caller here, from a signed token, on every single request
(spec §44).

Single admin role: an admin is an `auth.users` row with
`app_metadata.role = 'admin'`, set manually (docs/05-admin-setup.md). The
previous four-tier `require_role`/`ROLE_RANK` scheme is gone.
"""

from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.supabase import AuthedUser, TokenError, verify_token
from app.db.session import async_session_factory

# auto_error=False so a missing token produces our own uniform 401 rather than
# FastAPI's, which would leak which routes are protected by shape of error.
bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


DbSession = Annotated[AsyncSession, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def get_current_user(creds: Credentials) -> AuthedUser:
    """Any authenticated caller. Required to create reviews (spec §27)."""
    if creds is None:
        raise _unauthorized()
    try:
        return verify_token(creds.credentials)
    except TokenError:
        # Uniform message: never reveal whether the signature, expiry, or
        # audience was the problem.
        raise _unauthorized("Invalid or expired token")


async def get_optional_user(creds: Credentials) -> AuthedUser | None:
    """For endpoints that read differently when signed in but do not require it."""
    if creds is None:
        return None
    try:
        return verify_token(creds.credentials)
    except TokenError:
        return None


async def get_current_admin(
    user: Annotated[AuthedUser, Depends(get_current_user)],
) -> AuthedUser:
    """An admin with MFA satisfied.

    Two distinct failures, because they need different responses:

      * correct role, no second factor  -> 403 `mfa_required`, so the client
        prompts for a code instead of showing "access denied"
      * anything else                   -> 403 generic, revealing nothing about
        whether the role exists
    """
    if user.is_admin:
        return user
    if user.is_admin_pending_mfa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="mfa_required",
            headers={"X-MFA-Required": "true"},
        )
    raise _forbidden()


def owns_or_admin(resource_owner_id, user: AuthedUser) -> bool:
    """Ownership check for IDOR-prone routes (review edit/delete, media).

    Callers must raise **404**, not 403, when this returns False: whether a
    resource exists is not public information. Row Level Security enforces the
    same rule at the database, so a miss here still cannot leak the row.
    """
    return user.is_admin or str(resource_owner_id) == str(user.id)


def client_ip(request: Request) -> str | None:
    """Best-effort client IP for abuse logging.

    `X-Forwarded-For` is attacker-controlled unless a trusted proxy overwrites
    it, so this is only ever used for rate-limit keys and audit metadata —
    never for authorization.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


CurrentUser = Annotated[AuthedUser, Depends(get_current_user)]
OptionalUser = Annotated[AuthedUser | None, Depends(get_optional_user)]
CurrentAdmin = Annotated[AuthedUser, Depends(get_current_admin)]
