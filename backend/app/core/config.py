"""Application settings. Everything environment-driven; no secrets in Git (spec §66)."""

import json
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # --- App ---
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "PickDForYou API"

    # --- Supabase ---
    SUPABASE_URL: str = "http://localhost:54321"
    # Safe to expose; Row Level Security is what protects the data.
    SUPABASE_ANON_KEY: str = ""
    # BYPASSES RLS ENTIRELY. Server-side only, never in NEXT_PUBLIC_*.
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # Verifies incoming JWT signatures.
    SUPABASE_JWT_SECRET: str = ""
    # Supabase always issues this audience for signed-in users.
    SUPABASE_JWT_AUDIENCE: str = "authenticated"

    SUPABASE_STORAGE_PRODUCT_BUCKET: str = "product-media"
    SUPABASE_STORAGE_REVIEW_BUCKET: str = "review-media"
    SIGNED_URL_TTL_PRODUCT: int = 604_800  # 7 days — public editorial content
    SIGNED_URL_TTL_REVIEW: int = 3_600     # 1 hour — user-generated, tighter window

    # --- Database ---
    DATABASE_URL: PostgresDsn = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres"  # type: ignore[arg-type]
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # --- Authorization ---
    # Admins must have completed MFA. Supabase reports this as the token's
    # Authenticator Assurance Level: aal1 = password only, aal2 = second factor
    # verified. Requiring aal2 means a stolen admin password is not enough.
    REQUIRE_ADMIN_MFA: bool = True
    ADMIN_ROLE: str = "admin"

    # --- CORS ---
    # `NoDecode` because pydantic-settings JSON-decodes complex types INSIDE
    # the env source, before any validator runs — so a value like
    # `https://example.com` did not fail validation with a useful message, it
    # raised SettingsError at import time and took the whole process down
    # before uvicorn could bind a port. On a host where this is typed into a
    # web form rather than a file, that is a boot loop caused by a missing
    # pair of brackets. Decoding here instead means the accepted formats are
    # explicit and the error names the field.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # --- Media limits (spec §29, §45). Configurable, as the spec requires. ---
    MAX_IMAGE_BYTES: int = 8 * 1024 * 1024
    MAX_VIDEO_BYTES: int = 50 * 1024 * 1024
    MAX_REVIEW_VIDEO_SECONDS: int = 30
    MAX_REVIEW_IMAGES: int = 6
    MAX_REVIEW_VIDEOS: int = 1
    MAX_PRODUCT_IMAGES: int = 12
    ALLOWED_IMAGE_MIME: list[str] = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    ALLOWED_VIDEO_MIME: list[str] = ["video/mp4", "video/quicktime", "video/webm"]

    # --- Rate limiting (spec §46) ---
    REDIS_URL: str = "redis://localhost:6379/0"
    RATE_LIMIT_ANON: str = "60/minute"
    RATE_LIMIT_AUTH: str = "180/minute"
    RATE_LIMIT_WRITE: str = "20/minute"

    # --- Caching (spec §48) ---
    PUBLIC_CACHE_SECONDS: int = 300

    # --- Data retention ---
    IP_RETENTION_DAYS: int = 90

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        """Accept a JSON array or a plain comma-separated list.

        Both of these mean the same thing, and both are things a person
        reasonably types into a dashboard field:

            ["https://a.com", "https://b.com"]
            https://a.com, https://b.com

        A single bare origin works too. Anything genuinely malformed still
        fails, but as a normal validation error naming CORS_ORIGINS rather
        than an opaque SettingsError during module import.
        """
        if not isinstance(v, str):
            return v

        raw = v.strip()
        if not raw:
            return []

        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                # The overwhelmingly common cause is single quotes, which look
                # like a list to a human and are not JSON.
                raise ValueError(
                    f"CORS_ORIGINS looks like a JSON array but will not parse ({exc.msg}). "
                    'Use double quotes: ["https://example.com"] — or drop the '
                    "brackets entirely and give a comma-separated list."
                ) from exc

        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @field_validator("SUPABASE_JWT_SECRET")
    @classmethod
    def _jwt_secret_present_in_prod(cls, v: str, info) -> str:
        """Fail fast rather than start a production server that cannot verify a
        token — an unverifiable token is an unauthenticated request."""
        if info.data.get("ENVIRONMENT") == "production" and len(v) < 32:
            raise ValueError("SUPABASE_JWT_SECRET must be set in production")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
