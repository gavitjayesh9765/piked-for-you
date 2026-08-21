"""
Admin audit trail (spec §60).

Append-only. There is no update or delete path — not in this module, not in the
API, and no RLS policy grants either. An audit log you can rewrite is not an
audit log.

Every admin mutation calls `record()`. Doing it here rather than inline in each
handler means the shape stays consistent and a new endpoint cannot invent its
own format.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog


async def record(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    summary: str | None = None,
    meta: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    """Append one entry.

    Never raises into the caller's transaction path for logging reasons alone —
    but it is intentionally part of the same transaction, so a rolled-back
    mutation does not leave a log entry claiming it happened.
    """
    db.add(
        ActivityLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            meta=_redact(meta or {}),
            ip_address=ip_address,
        )
    )


# Fields that must never reach the log, even by accident. The audit trail is
# read by humans and retained for a long time; it is the wrong place for
# anything sensitive.
_SENSITIVE = {
    "password",
    "token",
    "secret",
    "authorization",
    "apikey",
    "api_key",
    "service_role",
    "jwt",
    "cookie",
    "session",
}


def _redact(meta: dict[str, Any]) -> dict[str, Any]:
    """Strip anything that looks like a credential, at any depth."""
    out: dict[str, Any] = {}
    for key, value in meta.items():
        if any(marker in key.lower() for marker in _SENSITIVE):
            out[key] = "[redacted]"
        elif isinstance(value, dict):
            out[key] = _redact(value)
        elif isinstance(value, str) and len(value) > 500:
            # Long blobs make the log unreadable and are rarely the point.
            out[key] = value[:500] + "…"
        else:
            out[key] = value
    return out


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Changed fields only, as {field: [old, new]}.

    Logging the whole record on every edit buries the signal; the useful
    question months later is "what changed", not "what did it look like".
    """
    changes: dict[str, Any] = {}
    for key, new_value in after.items():
        old_value = before.get(key)
        if old_value != new_value:
            changes[key] = [_short(old_value), _short(new_value)]
    return changes


def _short(value: Any) -> Any:
    if isinstance(value, str) and len(value) > 120:
        return value[:120] + "…"
    return value
