"""
Supabase JWT verification — the authorization primitive for the whole API.

Every protected request passes through `verify_token()`. Nothing about the
caller's identity is ever read from a request body, header, or query string;
it comes from the cryptographically signed token and nowhere else.

That is the answer to response manipulation: an attacker can rewrite what their
browser *displays* all they like, but they cannot forge a signature, so the
server's view of who they are never changes.

**Signing algorithms.** Supabase now issues **asymmetric** tokens (ES256, EC
P-256) verified against the project's public JWKS. Older projects still use a
shared HS256 secret. Both are supported here, chosen by the `alg` in the token
header — but only from an explicit allow-list, never from the token's own
claim about what it would like us to use.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from jwt import InvalidTokenError, PyJWKClient

from app.core.config import settings

logger = logging.getLogger(__name__)

# Algorithms we will ever accept. Deriving this from the token header alone
# would allow an "alg": "none" or HS256-signed-with-the-public-key attack —
# the classic JWT confusion bug.
ASYMMETRIC_ALGS = ("ES256", "RS256")
SYMMETRIC_ALGS = ("HS256",)


@dataclass(frozen=True)
class AuthedUser:
    """The verified caller. Constructed only from signed claims."""

    id: uuid.UUID
    email: str | None
    role: str | None
    # Authenticator Assurance Level: "aal1" = password only,
    # "aal2" = second factor verified.
    aal: str
    session_id: str | None

    @property
    def is_admin(self) -> bool:
        """Admin *and* MFA-verified when REQUIRE_ADMIN_MFA is on.

        The MFA check lives here rather than at the login screen deliberately:
        a login page can be bypassed by calling the API directly, but every
        request goes through this property.
        """
        if self.role != settings.ADMIN_ROLE:
            return False
        if settings.REQUIRE_ADMIN_MFA and self.aal != "aal2":
            return False
        return True

    @property
    def is_admin_pending_mfa(self) -> bool:
        """Correct password, correct role, second factor not yet supplied.

        Distinguished from a plain rejection so the UI can prompt for a code
        instead of showing a misleading "access denied".
        """
        return self.role == settings.ADMIN_ROLE and self.aal != "aal2"


class TokenError(Exception):
    """Raised for any verification failure. Deliberately carries no detail
    about *which* check failed — callers turn this into a generic 401."""


# --------------------------------------------------------------------- #
# JWKS                                                                   #
# --------------------------------------------------------------------- #

_jwk_client: PyJWKClient | None = None
_jwk_lock = threading.Lock()
_jwk_created_at: float = 0.0
_jwk_refreshing = False

# How long a fetched key set is served before a refresh is *started*. The
# refresh happens on a background thread and the existing keys keep serving
# until it lands (see `_jwks`), so this is a staleness budget, not a stall.
_JWKS_TTL_SECONDS = 600

# How long to wait before re-arming after a refresh fails. Without this a
# Supabase blip would put a fetch attempt on every subsequent request.
_JWKS_RETRY_SECONDS = 30

# Ceiling on one JWKS HTTP fetch.
#
# This number is load-bearing. `PyJWKClient` performs a *blocking* urllib
# request, and `_decode` is called from async code — including the rate-limit
# key function, which runs in middleware ahead of every route. So for as long
# as a fetch is outstanding, this single-worker process answers nothing at all:
# not the request that triggered it, and not the dozen behind it. PyJWT's own
# default is 30 seconds, doubled by the retry below to a full minute of a dead
# API, which reaches the frontend as "The API did not respond in time."
# Measured fetches take 0.16-0.42s, so this leaves an order of magnitude.
_JWKS_HTTP_TIMEOUT = 4.0

# Staleness is decided here, so PyJWKClient must never choose to refetch in the
# middle of a request on its own. Its internal cache is given a lifespan long
# enough that only the background refresh below ever replaces a key set.
_JWKS_CLIENT_LIFESPAN = 86_400


def _new_client() -> PyJWKClient:
    """A client for the project's key set. Construction does no network I/O —
    the fetch happens on first use, or on the refresh thread."""
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(
        url,
        cache_keys=True,
        lifespan=_JWKS_CLIENT_LIFESPAN,
        timeout=_JWKS_HTTP_TIMEOUT,
    )


def _reset_jwks() -> None:
    """Drop the cached client so the next call rebuilds and refetches."""
    global _jwk_client, _jwk_created_at
    with _jwk_lock:
        _jwk_client = None
        _jwk_created_at = 0.0


def warm_jwks() -> bool:
    """Fetch the key set at startup so the first real request does not pay for
    it — and so a misconfigured SUPABASE_URL is visible in the boot log rather
    than as mysterious 401s later."""
    try:
        _jwks().get_jwk_set()
        return True
    except Exception:
        _reset_jwks()
        return False


def _refresh_jwks() -> None:
    """Fetch a new key set and swap it in. Runs on a background thread.

    The swap only happens on success. A refresh that fails leaves the previous
    keys in place: they are almost certainly still valid — signing keys change
    on rotation, not on our timer — and signing every admin out because
    Supabase was briefly unreachable would be a far worse failure than serving
    a key set a few minutes past its refresh point.
    """
    global _jwk_client, _jwk_created_at, _jwk_refreshing

    client: PyJWKClient | None = None
    try:
        candidate = _new_client()
        candidate.get_jwk_set()  # the actual network call, off the event loop
        client = candidate
    except Exception:
        logger.warning("JWKS refresh failed; continuing with the cached key set", exc_info=True)

    with _jwk_lock:
        if client is not None:
            _jwk_client = client
            _jwk_created_at = time.monotonic()
        else:
            # Back off rather than retrying on every request that follows.
            _jwk_created_at = time.monotonic() - _JWKS_TTL_SECONDS + _JWKS_RETRY_SECONDS
        _jwk_refreshing = False


def _start_refresh() -> None:
    """Kick off a background refresh, at most one at a time.

    Caller must hold `_jwk_lock`.
    """
    global _jwk_refreshing
    if _jwk_refreshing:
        return
    _jwk_refreshing = True
    threading.Thread(target=_refresh_jwks, name="jwks-refresh", daemon=True).start()


def _jwks() -> PyJWKClient:
    """The current client, without ever blocking on the network to get it.

    Only the very first call can pay for a fetch, and `warm_jwks()` at startup
    exists so that call is not a user's. Afterwards an expired TTL starts a
    background refresh and hands back the keys we already have.
    """
    global _jwk_client, _jwk_created_at
    with _jwk_lock:
        if _jwk_client is None:
            _jwk_client = _new_client()
            _jwk_created_at = time.monotonic()
            return _jwk_client

        if (time.monotonic() - _jwk_created_at) > _JWKS_TTL_SECONDS:
            _start_refresh()
        return _jwk_client


def _decode(token: str) -> dict[str, Any]:
    """Verify the signature and standard claims.

    `require` forces exp/sub/aud to be present, so a token that simply omits
    `exp` cannot slip through as non-expiring.
    """
    options = {"require": ["exp", "sub", "aud"]}

    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise TokenError("Malformed token") from exc

    alg = header.get("alg")

    if alg in ASYMMETRIC_ALGS:
        # Retry once. The first call after a cold start pays the JWKS fetch,
        # and a transient failure there would sign every user out — so a
        # single retry with a fresh client is worth far more than it costs.
        #
        # This is the one path that can still fetch inline, and it is reached
        # only when the cached key set genuinely cannot verify the token (a
        # rotation, or a cold start that `warm_jwks` did not cover). Both
        # attempts are bounded by `_JWKS_HTTP_TIMEOUT`, so the worst case is
        # ~8s rather than the minute PyJWT's default would allow.
        signing_key = None
        for attempt in (1, 2):
            try:
                signing_key = _jwks().get_signing_key_from_jwt(token)
                break
            except Exception as exc:
                if attempt == 2:
                    raise TokenError("Could not resolve signing key") from exc
                _reset_jwks()

        return jwt.decode(
            token,
            signing_key.key,
            algorithms=list(ASYMMETRIC_ALGS),
            audience=settings.SUPABASE_JWT_AUDIENCE,
            options=options,
        )

    if alg in SYMMETRIC_ALGS:
        # Legacy projects. Refusing when the secret is absent is the only safe
        # behaviour: without it we cannot distinguish a valid token from a
        # forged one.
        if not settings.SUPABASE_JWT_SECRET:
            raise TokenError("JWT secret not configured")
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=list(SYMMETRIC_ALGS),
            audience=settings.SUPABASE_JWT_AUDIENCE,
            options=options,
        )

    raise TokenError("Unsupported signing algorithm")


def verify_token(token: str) -> AuthedUser:
    """Verify a Supabase access token and extract the caller."""
    try:
        claims = _decode(token)
    except TokenError:
        raise
    except InvalidTokenError as exc:
        raise TokenError("Invalid or expired token") from exc

    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise TokenError("Malformed subject") from exc

    # ---- The security-critical line ----------------------------------------
    # Role comes from app_metadata, which is writable ONLY with the
    # service_role key. `user_metadata` is user-writable and is therefore never
    # consulted for authorization — reading it here would hand out admin.
    app_metadata = claims.get("app_metadata") or {}
    role = app_metadata.get("role")

    return AuthedUser(
        id=user_id,
        email=claims.get("email"),
        role=role if isinstance(role, str) else None,
        aal=claims.get("aal") or "aal1",
        session_id=claims.get("session_id"),
    )


def bearer_from_header(header: str | None) -> str | None:
    """Extract a bearer token, tolerating case but not malformed schemes."""
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None
