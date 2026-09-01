"""
Mail settings an editor can change without a deploy.

---------------------------------------------------------------------------
WHY THIS EXISTS AT ALL

`MAIL_PROVIDER` was an environment variable, which means turning sending off
required someone with deploy access, at the exact moment you least want a deploy
— a bad campaign going out, a provider incident, a domain that has just been
flagged. `pricing_settings` already made this argument for the scraper: these are
"operational knobs an editor turns while watching a run fail, and an editor
cannot deploy". Mail is the same class of switch.

---------------------------------------------------------------------------
THE THREE-STATE PROVIDER, AND WHY `NULL` IS NOT `disabled`

`provider` is nullable, and null means **follow the environment**. That is a
genuinely different state from "off":

  NULL       -> whatever MAIL_PROVIDER says. The state every existing deploy is
                already in, so this table changes nothing until someone touches
                it.
  'disabled' -> off, because a person decided so, and it overrides the
                environment. This is the incident switch.
  'brevo'    -> on, using the key stored here or the one in the environment.

Collapsing null into 'disabled' would mean this migration silently turned off
mail on any host where the environment had it on.

---------------------------------------------------------------------------
WHY THE KEY IS ENCRYPTED AND NEVER RETURNED

Moving a secret out of the environment and into a database row is a downgrade
unless it is handled as a secret the whole way. So:

  * It is stored as a Fernet token, not plaintext. A database dump, a log line,
    or a backup restored somewhere less careful does not hand over a live key.
  * The encryption key is derived from `SUPABASE_JWT_SECRET`, which the service
    already requires in production. Nothing new to rotate, and a stolen database
    without the application secret is inert.
  * `mail_settings` has RLS enabled and **no policies at all**, so PostgREST —
    the path the public anon key travels — cannot read this row under any role.
    Only FastAPI, on its own connection, can.
  * The admin API never returns it. Not masked, not partially: the read endpoint
    answers "is one configured" and the last four characters, which is enough to
    tell two keys apart and not enough to use one.

The environment variable stays supported and takes over whenever no key has been
saved here, so nothing has to be migrated and a host can keep doing exactly what
it does today.
"""

from __future__ import annotations

import base64
import hashlib
import logging
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


def _fernet() -> Fernet | None:
    """The encryption key, derived from the service's own secret.

    SHA-256 of the JWT secret, base64url-encoded, which is exactly the 32-byte
    key Fernet wants. Derived rather than stored so there is no second secret to
    provision, rotate or leak — and rotating `SUPABASE_JWT_SECRET` correctly
    invalidates the stored mail key too, which is the safe direction to fail in
    (mail stops; a stale key is never silently reused).
    """
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        return None
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_key(plaintext: str) -> tuple[str, str] | None:
    """(ciphertext, last four). None if encryption is unavailable."""
    f = _fernet()
    if f is None or not plaintext:
        return None
    return f.encrypt(plaintext.encode("utf-8")).decode("ascii"), plaintext[-4:]


def decrypt_key(ciphertext: str | None) -> str | None:
    if not ciphertext:
        return None
    f = _fernet()
    if f is None:
        return None
    try:
        return f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken:
        # The secret changed under a stored key. Loud, because the symptom
        # otherwise is "mail silently stopped" and the cause is three layers
        # away from where anyone would look.
        logger.error(
            "mail_settings: stored provider key could not be decrypted — "
            "SUPABASE_JWT_SECRET has changed. Re-enter the key in /admin/settings."
        )
        return None


@dataclass(frozen=True, slots=True)
class MailConfig:
    """What the transport factory needs, after the database and the environment
    have been reconciled."""

    provider: str
    api_key: str
    from_email: str
    from_name: str
    reply_to: str
    #: True when the effective provider came from the database rather than the
    #: environment. The admin screen says which, so nobody edits a field that
    #: is not the one in force.
    from_database: bool


async def resolve(db: AsyncSession) -> MailConfig:
    """The settings actually in force, database over environment, field by field.

    Field by field rather than all-or-nothing: an editor who saves a from-name
    should not thereby take the API key out of the environment's hands.
    """
    from app.models import MailSettings  # local: app.models imports core.config

    row = (await db.execute(select(MailSettings).limit(1))).scalar_one_or_none()

    provider = settings.MAIL_PROVIDER
    from_db = False
    if row is not None and row.provider:
        provider = row.provider
        from_db = True

    key = (decrypt_key(row.api_key_ciphertext) if row else None) or settings.BREVO_API_KEY

    return MailConfig(
        provider=provider,
        api_key=key,
        from_email=(row.from_email if row and row.from_email else settings.MAIL_FROM_EMAIL),
        from_name=(row.from_name if row and row.from_name else settings.MAIL_FROM_NAME),
        reply_to=(row.reply_to if row and row.reply_to else settings.MAIL_REPLY_TO),
        from_database=from_db,
    )
