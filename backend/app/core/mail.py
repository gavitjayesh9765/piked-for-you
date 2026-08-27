"""Outbound mail transport.

This is the piece three modules were written around and none of them had:
`app/modules/newsletter` and `app/modules/contact` both carry a `⚠ NOT
IMPLEMENTED` note pointing here. Double opt-in cannot complete without it —
the confirmation link is the only way a subscriber can ever reach
`confirmed_at`, and the send job filters on that column, so with no transport
the list grows and nothing is ever sent to anyone.

PROVIDER
--------
Brevo, on the free plan: 300 emails/day, unlimited contacts. The daily ceiling
is the number that matters and it is why the choice is not Resend, whose free
plan allows 3,000/month but only 100/day. A newsletter is a burst, not a
trickle — one weekly send to 500 confirmed subscribers is 500 messages in one
minute, which fits neither cap, but 300/day drains it in two days instead of
five. Brevo's transactional and campaign sends share that one budget, so the
confirmation mails here spend from the same 300 as a future campaign.

The transport is an interface with three implementations rather than a
function that calls Brevo, because switching provider should be an env var.
`MAIL_PROVIDER=brevo|console|disabled`.

WHAT THIS MODULE DELIBERATELY DOES NOT DO
-----------------------------------------
Retry. A failed confirmation send leaves `confirmation_sent_at` NULL, which is
already the retry mechanism: the address can be submitted again and the
endpoint rolls a fresh token. Queuing retries in-process would mean holding a
token in memory on a `plan: free` instance that spins down after 15 minutes
idle, which loses them silently.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"

# Brevo's own guidance is that this call is fast or broken. A generous timeout
# on the request path just means the caller waits — the subscribe endpoint is
# rate-limited and user-facing.
TIMEOUT_SECONDS = 10.0


class MailDeliveryError(RuntimeError):
    """The message was not accepted for delivery."""


@dataclass(frozen=True, slots=True)
class MailMessage:
    to: str
    subject: str
    html: str
    # Some corporate gateways score a multipart-less HTML mail as suspicious,
    # and a text part is what a screen reader in a plain-text client gets.
    text: str
    # `List-Unsubscribe` belongs here rather than being synthesised by the
    # transport: only the caller knows the recipient's persistent token.
    headers: dict[str, str] = field(default_factory=dict)


class MailTransport(Protocol):
    #: Does this transport actually put the message somewhere a recipient can
    #: reach it? True for Brevo (an inbox) and for the console (a developer
    #: reads the link out of the log and clicks it). False for the null
    #: transport, which drops the message.
    #:
    #: This exists because `newsletter.subscribe()` records
    #: `confirmation_sent_at` when a send does not raise, and NullTransport
    #: does not raise. So with `MAIL_PROVIDER=disabled` every subscriber was
    #: stamped as having been sent a confirmation that never left the process.
    #: That is a lie in the one column that says who still needs one — and it
    #: is a lie that only becomes expensive later, when mail is switched on
    #: and there is no way to tell the never-mailed from the mailed-and-
    #: ignored. Collecting addresses now and sending in two months is a
    #: supported plan; silently forging the audit of it is not.
    delivers: bool

    async def send(self, message: MailMessage) -> None: ...


class BrevoTransport:
    """Brevo's transactional endpoint.

    Note `api-key`, not `Authorization: Bearer` — Brevo uses its own header
    name and a bearer token is rejected as unauthenticated, which reads like a
    bad key rather than a wrong scheme.
    """

    delivers = True

    def __init__(self, api_key: str, sender_email: str, sender_name: str, reply_to: str) -> None:
        self._api_key = api_key
        self._sender = {"name": sender_name, "email": sender_email}
        self._reply_to = {"email": reply_to} if reply_to else None

    async def send(self, message: MailMessage) -> None:
        body: dict[str, object] = {
            "sender": self._sender,
            "to": [{"email": message.to}],
            "subject": message.subject,
            "htmlContent": message.html,
            "textContent": message.text,
        }
        if message.headers:
            body["headers"] = message.headers
        if self._reply_to:
            body["replyTo"] = self._reply_to

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                res = await client.post(
                    BREVO_ENDPOINT,
                    json=body,
                    headers={
                        "api-key": self._api_key,
                        "accept": "application/json",
                        "content-type": "application/json",
                    },
                )
        except httpx.HTTPError as exc:
            raise MailDeliveryError(f"Brevo unreachable: {exc}") from exc

        if res.status_code in (200, 201, 202):
            return

        # The three that mean something specific enough to act on. Everything
        # else is reported with its status and body, because a Brevo error
        # body names the offending field and swallowing it costs an hour.
        if res.status_code == 401:
            raise MailDeliveryError("Brevo rejected BREVO_API_KEY (401).")
        if res.status_code == 402:
            raise MailDeliveryError(
                "Brevo is out of credits (402) — the free plan's 300/day is spent."
            )
        if res.status_code == 429:
            raise MailDeliveryError("Brevo rate-limited this send (429).")

        raise MailDeliveryError(f"Brevo returned {res.status_code}: {res.text[:400]}")


_HREF = re.compile(r'href="([^"]+)"')


class ConsoleTransport:
    """Development transport: log the message instead of sending it.

    It logs the links, which is the whole point — without a provider key,
    reading the confirmation URL out of the log is the only way to exercise
    double opt-in locally. That is also why `config.py` refuses to let this be
    the provider in production: these URLs are single-use credentials and a
    production log is not the place for them.
    """

    #: True: the link in the log is real and clicking it confirms the address,
    #: which is exactly how double opt-in is exercised locally.
    delivers = True

    async def send(self, message: MailMessage) -> None:
        links = "\n".join(f"    {url}" for url in dict.fromkeys(_HREF.findall(message.html)))
        logger.info(
            "[mail:console] to=%s subject=%s\n%s",
            message.to,
            message.subject,
            links or "    (no links)",
        )


class NullTransport:
    """Accept and drop. `MAIL_PROVIDER=disabled` — an explicit off switch, so
    that turning mail off is a decision in the environment rather than the
    accident of an unset key.

    `delivers = False` is the operative line. Dropping the message must not
    read to the caller as having sent it — see the note on the protocol."""

    delivers = False

    async def send(self, message: MailMessage) -> None:
        return None


@lru_cache
def get_transport() -> MailTransport:
    provider = settings.MAIL_PROVIDER

    if provider == "brevo":
        # Checked here as well as in config validation: config only enforces
        # this for production, and a staging box with `brevo` and no key
        # should fail at startup rather than on a subscriber's signup.
        if not settings.BREVO_API_KEY:
            raise MailDeliveryError("MAIL_PROVIDER=brevo but BREVO_API_KEY is empty.")
        return BrevoTransport(
            api_key=settings.BREVO_API_KEY,
            sender_email=settings.MAIL_FROM_EMAIL,
            sender_name=settings.MAIL_FROM_NAME,
            reply_to=settings.MAIL_REPLY_TO,
        )

    if provider == "console":
        return ConsoleTransport()

    return NullTransport()
