"""
Video link parsing (YouTube / Vimeo).

Embedding beats hosting for product video: no storage bill, no egress, no
transcode pipeline, and the provider already generates a poster frame. We store
the provider and the video id — never the raw URL alone — so the embed and
thumbnail URLs are **built by us** rather than reflected from user input.

That distinction is the security point. A stored URL that gets dropped into an
`<iframe src>` is an injection surface; a validated `(provider, id)` pair is
not, because anything that fails the id pattern never reaches the page.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

# Deliberately strict. YouTube ids are exactly 11 chars from a known alphabet;
# Vimeo ids are digits. Anything else is not a video id.
YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
VIMEO_ID = re.compile(r"^\d{6,12}$")

YOUTUBE_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "youtu.be", "www.youtu.be", "music.youtube.com",
}
VIMEO_HOSTS = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}


class InvalidVideoLink(Exception):
    """The URL is not a recognised, well-formed video link."""


@dataclass(frozen=True)
class VideoLink:
    provider: str
    external_id: str
    source_url: str
    embed_url: str
    thumbnail_url: str


def parse(raw: str) -> VideoLink:
    """Parse a YouTube or Vimeo URL into a validated link, or raise."""
    url = (raw or "").strip()
    if not url:
        raise InvalidVideoLink("No URL given")

    # Accept a bare "youtube.com/watch?v=..." by assuming https, but never
    # invent a scheme for something that already has a hostile one.
    if "://" not in url:
        url = f"https://{url}"

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise InvalidVideoLink("Only http(s) links are accepted")

    host = (parsed.hostname or "").lower()

    if host in YOUTUBE_HOSTS:
        return _youtube(parsed, url)
    if host in VIMEO_HOSTS:
        return _vimeo(parsed, url)

    raise InvalidVideoLink("Only YouTube and Vimeo links are supported")


def _youtube(parsed, original: str) -> VideoLink:
    path = parsed.path.rstrip("/")
    vid = None

    if parsed.hostname and "youtu.be" in parsed.hostname:
        vid = path.lstrip("/").split("/")[0]
    elif path == "/watch":
        vid = (parse_qs(parsed.query).get("v") or [None])[0]
    elif path.startswith(("/embed/", "/v/", "/shorts/", "/live/")):
        vid = path.split("/")[2] if len(path.split("/")) > 2 else None

    if not vid or not YOUTUBE_ID.match(vid):
        raise InvalidVideoLink("Could not find a YouTube video id in that link")

    return VideoLink(
        provider="youtube",
        external_id=vid,
        source_url=f"https://www.youtube.com/watch?v={vid}",
        # youtube-nocookie: no tracking cookie is set until the viewer presses
        # play, which is the right default for a site that claims independence.
        embed_url=f"https://www.youtube-nocookie.com/embed/{vid}",
        thumbnail_url=f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
    )


def _vimeo(parsed, original: str) -> VideoLink:
    segments = [s for s in parsed.path.split("/") if s]
    vid = None

    for seg in segments:
        if VIMEO_ID.match(seg):
            vid = seg
            break

    if not vid:
        raise InvalidVideoLink("Could not find a Vimeo video id in that link")

    return VideoLink(
        provider="vimeo",
        external_id=vid,
        source_url=f"https://vimeo.com/{vid}",
        embed_url=f"https://player.vimeo.com/video/{vid}",
        # Vimeo thumbnails need an API call; the frontend falls back to the
        # product's primary image, which is a reasonable poster frame.
        thumbnail_url="",
    )


def embed_url(provider: str, external_id: str) -> str:
    """Rebuild the embed URL from stored parts. Never stores or reflects the
    raw input — the id is re-validated on the way out too."""
    if provider == "youtube" and YOUTUBE_ID.match(external_id or ""):
        return f"https://www.youtube-nocookie.com/embed/{external_id}"
    if provider == "vimeo" and VIMEO_ID.match(external_id or ""):
        return f"https://player.vimeo.com/video/{external_id}"
    return ""


def thumbnail_url(provider: str, external_id: str) -> str:
    if provider == "youtube" and YOUTUBE_ID.match(external_id or ""):
        return f"https://i.ytimg.com/vi/{external_id}/hqdefault.jpg"
    return ""
