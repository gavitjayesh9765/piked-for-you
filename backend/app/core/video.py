"""
Video duration probing (spec §29, §46).

The 30-second cap has to be enforced against the **actual file**, not against
a duration the client says it has. A number in a form field is a claim; the
container header is evidence.

Rather than shelling out to ffprobe — an external binary that may not exist on
the host, and a subprocess boundary I would rather not add to an upload path —
this parses the container directly:

  * **MP4 / MOV / M4V** (ISO base media format): walk the box tree to
    `moov > mvhd`, which carries `timescale` and `duration`.
  * **WebM / Matroska** (EBML): read `Segment > Info` for `TimecodeScale`
    and `Duration`.

Those two cover essentially everything a phone or browser produces.

**Fails closed.** If the duration cannot be determined, the file is refused.
"Unknown length" must never resolve to "probably fine" on an endpoint whose
whole job is enforcing a length limit.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

# Guard rails on the parse itself. A malicious file can nest boxes thousands
# deep or declare absurd sizes; neither should be able to hang a worker.
MAX_DEPTH = 8
MAX_BOXES = 512
# The moov atom is normally within the first few MB (or at the very end for
# non-faststart files, which we also handle by scanning the tail).
HEAD_SCAN = 4 * 1024 * 1024


class UnknownDuration(Exception):
    """Duration could not be established — caller must reject the upload."""


@dataclass(frozen=True)
class VideoInfo:
    duration_seconds: float
    container: str


def probe_duration(data: bytes) -> VideoInfo:
    """Return the duration, or raise UnknownDuration."""
    if len(data) < 16:
        raise UnknownDuration("File too small to contain a video header")

    if _looks_like_isobmff(data):
        return VideoInfo(_mp4_duration(data), "mp4")
    if data[:4] == b"\x1a\x45\xdf\xa3":  # EBML magic
        return VideoInfo(_webm_duration(data), "webm")

    raise UnknownDuration("Unrecognised video container")


# --------------------------------------------------------------------- #
# ISO BMFF (mp4 / mov / m4v)                                             #
# --------------------------------------------------------------------- #


def _looks_like_isobmff(data: bytes) -> bool:
    # First box is normally 'ftyp'; QuickTime files sometimes lead with others.
    return data[4:8] in (b"ftyp", b"moov", b"mdat", b"free", b"skip", b"wide")


def _iter_boxes(data: bytes, start: int, end: int, depth: int, budget: list[int]):
    """Yield (type, payload_start, payload_end) for boxes in [start, end)."""
    offset = start
    while offset + 8 <= end:
        if budget[0] <= 0:
            return
        budget[0] -= 1

        size = struct.unpack(">I", data[offset : offset + 4])[0]
        btype = data[offset + 4 : offset + 8]
        header = 8

        if size == 1:  # 64-bit extended size
            if offset + 16 > end:
                return
            size = struct.unpack(">Q", data[offset + 8 : offset + 16])[0]
            header = 16
        elif size == 0:  # extends to end of file
            size = end - offset

        if size < header or offset + size > end:
            return

        yield btype, offset + header, offset + size
        offset += size


def _find_mvhd(data: bytes, start: int, end: int, depth: int, budget: list[int]) -> tuple[int, int] | None:
    if depth > MAX_DEPTH:
        return None
    for btype, body_start, body_end in _iter_boxes(data, start, end, depth, budget):
        if btype == b"mvhd":
            return body_start, body_end
        # Only these containers can hold mvhd; descending into mdat (the media
        # payload itself) would be parsing attacker-controlled bytes as boxes.
        if btype in (b"moov", b"trak", b"mdia", b"edts"):
            found = _find_mvhd(data, body_start, body_end, depth + 1, budget)
            if found:
                return found
    return None


def _mp4_duration(data: bytes) -> float:
    budget = [MAX_BOXES]
    found = _find_mvhd(data, 0, len(data), 0, budget)

    if found is None:
        raise UnknownDuration("No mvhd box found")

    body_start, body_end = found
    if body_end - body_start < 20:
        raise UnknownDuration("Truncated mvhd box")

    version = data[body_start]
    if version == 1:
        if body_end - body_start < 32:
            raise UnknownDuration("Truncated mvhd (v1)")
        timescale = struct.unpack(">I", data[body_start + 20 : body_start + 24])[0]
        duration = struct.unpack(">Q", data[body_start + 24 : body_start + 32])[0]
    else:
        timescale = struct.unpack(">I", data[body_start + 12 : body_start + 16])[0]
        duration = struct.unpack(">I", data[body_start + 16 : body_start + 20])[0]

    if not timescale:
        raise UnknownDuration("Invalid timescale")
    # 0xFFFFFFFF is the documented "unknown duration" sentinel.
    if duration in (0, 0xFFFFFFFF, 0xFFFFFFFFFFFFFFFF):
        raise UnknownDuration("Duration not declared")

    return duration / timescale


# --------------------------------------------------------------------- #
# EBML (webm / mkv)                                                      #
# --------------------------------------------------------------------- #


def _read_vint(data: bytes, pos: int, strip_marker: bool) -> tuple[int, int]:
    """Read an EBML variable-length integer. Returns (value, new_pos)."""
    if pos >= len(data):
        raise UnknownDuration("Truncated EBML")
    first = data[pos]
    if first == 0:
        raise UnknownDuration("Invalid EBML length")
    length = 8 - first.bit_length() + 1
    if length < 1 or length > 8 or pos + length > len(data):
        raise UnknownDuration("Invalid EBML width")

    value = first & ((1 << (8 - length)) - 1) if strip_marker else first
    for i in range(1, length):
        value = (value << 8) | data[pos + i]
    return value, pos + length


def _webm_duration(data: bytes) -> float:
    """Scan for Segment > Info, then TimecodeScale + Duration.

    A linear scan for the Info element rather than a full EBML tree walk:
    shorter, and it cannot be led into deep recursion by a crafted file.
    """
    # Info element id: 0x1549A966
    idx = data.find(b"\x15\x49\xa6\x66")
    if idx == -1:
        raise UnknownDuration("No EBML Info element")

    pos = idx + 4
    size, pos = _read_vint(data, pos, strip_marker=True)
    end = min(pos + size, len(data))

    timecode_scale = 1_000_000  # EBML default: nanoseconds
    duration: float | None = None

    while pos < end:
        try:
            el_id, pos = _read_vint(data, pos, strip_marker=False)
            el_size, pos = _read_vint(data, pos, strip_marker=True)
        except UnknownDuration:
            break
        if el_size < 0 or pos + el_size > end:
            break

        payload = data[pos : pos + el_size]

        if el_id == 0x2AD7B1 and payload:  # TimecodeScale
            timecode_scale = int.from_bytes(payload, "big")
        elif el_id == 0x4489 and payload:  # Duration (float)
            if el_size == 4:
                duration = struct.unpack(">f", payload)[0]
            elif el_size == 8:
                duration = struct.unpack(">d", payload)[0]

        pos += el_size

    if duration is None or not timecode_scale:
        raise UnknownDuration("Duration not declared")

    # Duration is in timecode units; scale is nanoseconds per unit.
    return duration * timecode_scale / 1_000_000_000
