"""
Outbound URL safety — the guard on every request the *server* makes to an
address someone else chose.

The price scraper is the only feature in this codebase with that shape, and
that shape is SSRF. The previous defence was an argument rather than a
control: the caller is an MFA-verified admin, `HttpUrl` rejects non-http
schemes, and the page body is never returned. None of those stop the request
that matters:

    http://169.254.169.254/latest/meta-data/    cloud instance metadata
    http://127.0.0.1:8000/api/v1/...            our own API, from inside
    http://10.0.0.5:6379/                       whatever else shares the VPC

And the body not being returned is only half true. `Preview` carries
`http_status`, `duration_ms`, the `error` string and the extracted `raw`
match — enough to tell an open port from a closed one, which is a port
scanner.

Three rules, in the order they actually stop things:

  1. **Scheme and port.** http/https only, and only on 80/443. A retailer's
     product page is not on 6379, 5432, 8000 or 9200. This single rule removes
     most of the interesting internal targets before DNS is even consulted.

  2. **Every resolved address must be publicly routable.** Not the hostname —
     the addresses it resolves to. `localtest.me`, and any attacker-controlled
     domain with an A record of 127.0.0.1, are hostnames that look fine and
     resolve inward.

  3. **Every redirect hop is re-checked.** A URL that passes on submission and
     then 302s to the metadata endpoint defeats any check performed only on
     the value the admin typed. `follow_redirects` must therefore be off, and
     the chain walked by hand — see `app/services/scraper/fetch.py`.

Residual risk, stated rather than papered over: between our `getaddrinfo` and
httpx's own resolution there is a window in which a hostile DNS server could
answer differently (DNS rebinding). Closing it completely means pinning the
connection to the address we validated, which needs a custom transport and
breaks TLS hostname verification if done carelessly. Rule 1 is what keeps that
window low-value: a rebind still cannot reach anything except ports 80 and 443.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

from app.core.config import settings

# A product page is served over HTTP. Anything else on the host is
# infrastructure, and infrastructure is exactly what must stay unreachable.
ALLOWED_SCHEMES = frozenset({"http", "https"})
ALLOWED_PORTS = frozenset({80, 443})

# Hostnames that resolve inward on essentially every platform. Cheap to check
# before paying for DNS, and it makes the common case fail with a clear reason.
BLOCKED_HOSTNAMES = frozenset({
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    # AWS/GCP/Azure/DigitalOcean metadata, by name as well as by address.
    "metadata",
    "metadata.google.internal",
    "metadata.goog",
    "instance-data",
})


class UnsafeUrl(Exception):
    """The URL points somewhere the server must not be made to fetch.

    The message is safe to show an admin — they typed the URL and need to know
    why it was refused — but carries no information about what *is* reachable.
    """


def _bypass_allowed(allow_private: bool) -> bool:
    """Is the caller's request to skip these checks honoured?

    There is exactly one legitimate reason to want that: the fetch-layer tests
    run a real HTTP server on 127.0.0.1 on an ephemeral port, and mocking the
    transport would let every failure this layer exists to handle pass while
    the real thing broke.

    So the hatch exists — and production refuses it regardless of who asks.
    Deliberately NOT a setting: an env var is a thing someone can flip on a
    dashboard at 2am to make an error go away, and this is not an error worth
    making go away. It is a keyword argument that only tests pass, with a
    production check behind it in case that ever stops being true.
    """
    return allow_private and not settings.is_production


def _is_public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Publicly routable, by the stdlib's own definition plus the gaps in it.

    `is_global` already excludes private, loopback, link-local, multicast,
    reserved and unspecified ranges. The extra checks below are the ones worth
    naming explicitly because they are the ones people actually target.
    """
    if ip.is_loopback or ip.is_private or ip.is_link_local:
        return False
    if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return False

    # 169.254.169.254 is link-local and already caught above; its IPv6
    # counterpart fd00:ec2::254 is unique-local, which `is_private` covers.
    # An IPv4-mapped IPv6 address (::ffff:127.0.0.1) is neither, so unwrap it
    # and re-test rather than letting it through on a technicality.
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return _is_public(ip.ipv4_mapped)
        if ip.sixtofour is not None:
            return _is_public(ip.sixtofour)
        if ip.teredo is not None:
            return _is_public(ip.teredo[1])

    return bool(ip.is_global)


def resolve_public_addresses(
    host: str, port: int, *, allow_private: bool = False
) -> list[str]:
    """Every address `host` resolves to, or raise if any of them is internal.

    Deliberately all-or-nothing. A hostname with one public and one loopback
    record is a rebinding attempt, not a partially valid host, and picking the
    public one would mean the check passes while the connection may still go
    inward.
    """
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeUrl(
            f"That hostname does not resolve ({exc.strerror or 'DNS failure'})."
        ) from exc

    if not infos:
        raise UnsafeUrl("That hostname does not resolve.")

    addresses: list[str] = []
    for info in infos:
        raw = info[4][0]
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            raise UnsafeUrl("That hostname resolved to something unreadable.") from None
        if not _is_public(ip) and not _bypass_allowed(allow_private):
            raise UnsafeUrl(
                "That address is on a private or internal network, so the server "
                "will not fetch it. Product pages must be on public addresses."
            )
        addresses.append(str(ip))

    return addresses


def validate_outbound_url(raw: str, *, allow_private: bool = False) -> str:
    """Check one URL, and hand back the normalised form to actually request.

    Call this on the submitted URL *and* on every redirect target. Raises
    `UnsafeUrl` with a message an admin can act on.
    """
    if not raw or len(raw) > 2048:
        raise UnsafeUrl("That URL is empty or unreasonably long.")

    try:
        parts = urlsplit(raw.strip())
    except ValueError as exc:
        raise UnsafeUrl("That URL could not be parsed.") from exc

    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeUrl("Only http and https URLs can be fetched.")

    # `user:pass@host` is how a URL gets read as one host by a human and
    # another by a parser. There is no reason for credentials on a public
    # product page.
    if parts.username or parts.password:
        raise UnsafeUrl("URLs with embedded credentials are not accepted.")

    host = (parts.hostname or "").strip().rstrip(".").lower()
    if not host:
        raise UnsafeUrl("That URL has no hostname.")
    if host in BLOCKED_HOSTNAMES and not _bypass_allowed(allow_private):
        raise UnsafeUrl("That hostname refers to this machine or its metadata service.")

    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeUrl("That URL has an invalid port.") from exc

    effective_port = port if port is not None else (443 if parts.scheme == "https" else 80)
    if effective_port not in ALLOWED_PORTS and not _bypass_allowed(allow_private):
        raise UnsafeUrl(
            f"Port {effective_port} is not fetchable. Product pages are served on 80 or 443."
        )

    # A bare IP literal skips DNS but not the address check.
    resolve_public_addresses(host, effective_port, allow_private=allow_private)

    return parts.geturl()
