"""
The SSRF guard, tested against the payloads it exists to stop.

Every case here is a real technique, not a hypothetical. A guard that only
rejects the string "169.254.169.254" is theatre — the interesting bypasses are
the ones where the URL looks ordinary and the *resolution* goes inward.
"""

from __future__ import annotations

import pytest

from app.core.net import UnsafeUrl, validate_outbound_url


@pytest.mark.parametrize(
    "url",
    [
        # Cloud instance metadata — the single highest-value SSRF target.
        "http://169.254.169.254/latest/meta-data/",
        "http://[fd00:ec2::254]/latest/meta-data/",
        # Our own API, from inside its own trust boundary.
        "http://127.0.0.1:8000/api/v1/admin/products",
        "http://localhost/admin",
        # Private ranges: whatever else shares the network.
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        # IPv6 loopback, and the IPv4-mapped form that is neither loopback nor
        # private by the plain flags and needs unwrapping to be caught.
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        # 0.0.0.0 routes to localhost on Linux.
        "http://0.0.0.0/",
        # Named metadata endpoints.
        "http://metadata.google.internal/computeMetadata/v1/",
    ],
)
def test_internal_targets_are_refused(url: str) -> None:
    with pytest.raises(UnsafeUrl):
        validate_outbound_url(url)


@pytest.mark.parametrize(
    "url",
    [
        # Non-HTTP schemes. `file://` would read the container's filesystem;
        # `gopher://` is the classic way to smuggle a Redis command.
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379/_SET%20foo%20bar",
        "ftp://example.com/x",
        # No scheme at all.
        "example.com/product",
        "",
    ],
)
def test_non_http_schemes_are_refused(url: str) -> None:
    with pytest.raises(UnsafeUrl):
        validate_outbound_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com:6379/",   # Redis
        "http://example.com:5432/",   # Postgres
        "http://example.com:8000/",   # our own uvicorn
        "http://example.com:9200/",   # Elasticsearch
        "http://example.com:22/",     # SSH
    ],
)
def test_non_web_ports_are_refused(url: str) -> None:
    """The port rule does most of the work: it removes the interesting internal
    targets before DNS is even consulted, including on hosts that resolve
    publicly."""
    with pytest.raises(UnsafeUrl) as caught:
        validate_outbound_url(url)
    assert "not fetchable" in str(caught.value)


def test_embedded_credentials_are_refused() -> None:
    """`http://real-retailer.com@169.254.169.254/` is read as one host by a
    human skimming it and another by a URL parser."""
    with pytest.raises(UnsafeUrl):
        validate_outbound_url("http://example.com@169.254.169.254/latest/")


def test_an_absurdly_long_url_is_refused() -> None:
    with pytest.raises(UnsafeUrl):
        validate_outbound_url("https://example.com/" + "a" * 4000)


def test_a_public_url_survives() -> None:
    """The guard has to let the actual job through, or it is just an outage."""
    assert validate_outbound_url("https://example.com/product/123?x=1")
    assert validate_outbound_url("http://example.com:80/p")
    assert validate_outbound_url("https://example.com:443/p")


def test_a_trailing_dot_host_is_normalised_not_bypassed() -> None:
    """`localhost.` and `localhost` are the same host to a resolver, and the
    trailing dot is a standard way past a naive string comparison."""
    with pytest.raises(UnsafeUrl):
        validate_outbound_url("http://localhost./admin")
