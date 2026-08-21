"""
Price scraping.

A small, deliberately boring pipeline:

    fetch.py    get the page (plain request, or headless render)
    extract.py  read a price out of it (pure — HTML in, number out)
    runner.py   do that for a list of links, and write down what happened

Started by an admin pressing a button, never by a schedule. See
`app/modules/admin/pricing.py` for the endpoints and
`docs/06-price-scraping.md` for how the whole thing hangs together.
"""

from app.services.scraper.extract import (
    NoPriceFound,
    Reading,
    detect_currency,
    extract_price,
    parse_price,
)
from app.services.scraper.fetch import Engine, Fetcher, FetchError
from app.services.scraper.preview import preview_url
from app.services.scraper.runner import (
    HostThrottle,
    Target,
    apply_reading,
    execute_job,
    judge,
    resolve_targets,
)

__all__ = [
    "Engine",
    "FetchError",
    "Fetcher",
    "HostThrottle",
    "NoPriceFound",
    "Reading",
    "Target",
    "apply_reading",
    "detect_currency",
    "execute_job",
    "extract_price",
    "judge",
    "parse_price",
    "preview_url",
    "resolve_targets",
]
