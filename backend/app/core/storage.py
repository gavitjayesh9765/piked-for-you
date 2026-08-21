"""
Supabase Storage access.

Both buckets are **private**. Nothing is world-readable, so every file is
served through a time-limited signed URL minted here with the service-role key.

Why private even for product images: a public bucket exposes the whole object
namespace, which means draft-product imagery would be fetchable by URL before
the product is published. Signed URLs keep spec §38 honest.

Signed URLs are generated at read time and never stored — the database holds
only the object key (`storage_path`).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

Bucket = Literal["product-media", "review-media"]


@lru_cache
def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.SUPABASE_URL.rstrip("/"),
        headers={
            # Service role, so signing works regardless of the caller's own
            # permissions. This client is server-side only and must never be
            # reachable from a request the browser controls.
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        },
        timeout=15.0,
    )


def ttl_for(bucket: Bucket) -> int:
    """Review media gets a much shorter window than product imagery: it is
    user-generated, may be pending moderation, and should not stay reachable
    once removed."""
    return (
        settings.SIGNED_URL_TTL_REVIEW
        if bucket == "review-media"
        else settings.SIGNED_URL_TTL_PRODUCT
    )


async def sign_url(bucket: Bucket, path: str, expires_in: int | None = None) -> str | None:
    """Mint a signed URL for one object, or None on failure.

    Returns None rather than raising: a missing image should degrade to a
    placeholder, not take down a product page.
    """
    if not path or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None

    ttl = expires_in or ttl_for(bucket)
    try:
        res = await _client().post(
            f"/storage/v1/object/sign/{bucket}/{path.lstrip('/')}",
            json={"expiresIn": ttl},
        )
        res.raise_for_status()
        signed = res.json().get("signedURL")
        if not signed:
            return None
        return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1{signed}"
    except Exception:
        logger.warning("Failed to sign %s/%s", bucket, path, exc_info=True)
        return None


async def sign_many(bucket: Bucket, paths: list[str]) -> dict[str, str]:
    """Sign a batch in one request — a product grid needs dozens of URLs and
    one round trip each would dominate the response time."""
    clean = [p.lstrip("/") for p in paths if p]
    if not clean or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return {}

    try:
        res = await _client().post(
            f"/storage/v1/object/sign/{bucket}",
            json={"expiresIn": ttl_for(bucket), "paths": clean},
        )
        res.raise_for_status()
        base = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        return {
            item["path"]: f"{base}{item['signedURL']}"
            for item in res.json()
            if item.get("signedURL") and item.get("path")
        }
    except Exception:
        logger.warning("Batch signing failed for %s", bucket, exc_info=True)
        return {}


async def upload(bucket: Bucket, path: str, data: bytes, content_type: str) -> bool:
    """Store an object.

    The caller must have already run the §46 validation chain — declared MIME,
    magic bytes, size, EXIF strip, re-encode. Supabase does not inspect file
    contents, so `content_type` here is our assertion, not the uploader's.
    """
    try:
        res = await _client().post(
            f"/storage/v1/object/{bucket}/{path.lstrip('/')}",
            content=data,
            headers={"Content-Type": content_type, "x-upsert": "false"},
        )
        res.raise_for_status()
        return True
    except Exception:
        logger.error("Upload failed for %s/%s", bucket, path, exc_info=True)
        return False


async def remove(bucket: Bucket, paths: list[str]) -> bool:
    try:
        res = await _client().request(
            "DELETE",
            f"/storage/v1/object/{bucket}",
            json={"prefixes": [p.lstrip("/") for p in paths]},
        )
        res.raise_for_status()
        return True
    except Exception:
        logger.error("Delete failed for %s", bucket, exc_info=True)
        return False
