"""
Turning a page of HTML into a price.

This module is deliberately pure: HTML string in, `Reading` out, no network, no
database, no clock. That is what makes it the part of the scraper that can be
tested honestly — every retailer quirk we have ever been bitten by can be
pinned as a fixture here without a live request.

The extraction ladder, in order, most trustworthy first:

  1. Configured CSS selectors  — what an editor set for this retailer.
  2. JSON-LD Product/Offer     — structured data the retailer publishes on
                                 purpose, for Google. Stable, and it carries
                                 currency and stock alongside the number.
  3. Microdata / RDFa itemprop — the older form of the same idea.
  4. Meta tags                 — og:price:amount and friends.
  5. Generic selectors         — the handful of class names half the web uses.
  6. Currency-symbol scan      — a regex over visible text. Last resort, and it
                                 reports low confidence, because on a page with
                                 "EMI from ₹499/month" it will happily find the
                                 wrong number.

Confidence is not decoration. The runner refuses to *apply* a low-confidence
reading that also disagrees sharply with the current price — the combination is
the signature of a selector that has drifted onto an unrelated figure.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from bs4 import BeautifulSoup

Strategy = Literal[
    "configured", "json_ld", "microdata", "meta", "generic", "text_scan"
]
Confidence = Literal["high", "medium", "low"]

# How much each strategy is trusted. Used by the runner's guard rail.
CONFIDENCE_BY_STRATEGY: dict[Strategy, Confidence] = {
    "configured": "high",
    "json_ld": "high",
    "microdata": "medium",
    "meta": "medium",
    "generic": "low",
    "text_scan": "low",
}

# Symbol → ISO code. Only the ones we actually serve; an unrecognised symbol
# leaves currency unset rather than guessing, and the caller falls back to the
# retailer's configured currency.
CURRENCY_SYMBOLS: dict[str, str] = {
    "₹": "INR",
    "Rs.": "INR",
    "Rs": "INR",
    "INR": "INR",
    "$": "USD",
    "USD": "USD",
    "£": "GBP",
    "GBP": "GBP",
    "€": "EUR",
    "EUR": "EUR",
    "AED": "AED",
}

# A run of digits with any mix of `.` and `,` separators inside it.
#
# Deliberately permissive rather than encoding a grouping pattern: which
# character groups and which one is the decimal point is decided afterwards, in
# `parse_price`, by looking at the last separator. Trying to express Indian
# (1,23,456), US (1,234,567) and European (1.234,56) grouping in one regex
# produces alternations that silently match a *prefix* — "4999" comes back as
# "499" — which is a far worse failure than being permissive here.
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")

# Currency symbol immediately before a number, which is how every storefront we
# care about writes a price. Requiring the symbol is what keeps the text scan
# from returning a review count or a wattage.
_PRICED_NUMBER_RE = re.compile(
    r"(₹|Rs\.?|INR|\$|USD|£|GBP|€|EUR|AED)\s{0,3}"
    r"(\d+(?:[.,]\d+)*)",
    re.IGNORECASE,
)

# Phrases that mean the number next to them is not the selling price. Checked
# against the surrounding text before a text-scan match is accepted.
_DISQUALIFYING_CONTEXT = (
    "emi",
    "per month",
    "/month",
    "delivery",
    "shipping",
    "cashback",
    "save ",
    "you save",
    "coupon",
    "exchange",
    "protect",
    "warranty",
    "installment",
    "instalment",
)

# Anything outside this is not a retail price for a product we cover; it is a
# parse accident. Cheap sanity floor and ceiling, checked before anything else.
MIN_PLAUSIBLE_PRICE = Decimal("1")
MAX_PLAUSIBLE_PRICE = Decimal("10000000")

_GENERIC_PRICE_SELECTORS = (
    "[data-testid='price']",
    "[data-price]",
    ".product-price",
    ".price--current",
    ".price-item--sale",
    ".current-price",
    ".price",
    "#price",
)

_OUT_OF_STOCK_PHRASES = (
    "out of stock",
    "currently unavailable",
    "sold out",
    "temporarily unavailable",
    "notify me when available",
    "coming soon",
)


@dataclass(frozen=True, slots=True)
class Reading:
    """One price read off one page."""

    price: Decimal
    currency: str | None
    in_stock: bool | None
    strategy: Strategy
    confidence: Confidence
    #: The raw text the number came out of. Shown in the admin panel when a
    #: reading is rejected, because "we read ₹1,299 from 'EMI from ₹1,299/mo'"
    #: tells an editor exactly which selector to fix.
    raw: str


class NoPriceFound(Exception):
    """The page loaded and parsed, but carried no price we could trust."""


# --------------------------------------------------------------------------- #
# Number parsing                                                              #
# --------------------------------------------------------------------------- #


def parse_price(text: str) -> Decimal | None:
    """Pull a decimal out of a human-formatted price string.

    The hard part is the separators. `1,234.56`, `1.234,56` and `1,23,456` are
    all real and all mean different things, so rather than assume a locale we
    read the *last* separator: if what follows it is one or two digits it is a
    decimal point, and otherwise every separator is grouping. That rule gets
    Indian, European and US formats right without knowing which one we are
    looking at.
    """
    if not text:
        return None

    match = _NUMBER_RE.search(text.replace("\xa0", " "))
    if match is None:
        return None

    raw = match.group(0)
    last_sep = max(raw.rfind(","), raw.rfind("."))

    if last_sep == -1:
        cleaned = raw
    else:
        fraction = raw[last_sep + 1 :]
        if len(fraction) <= 2 and fraction.isdigit():
            # Decimal separator: strip grouping from the integer part only.
            integer = re.sub(r"[.,]", "", raw[:last_sep])
            cleaned = f"{integer}.{fraction}"
        else:
            # Three-digit tail — grouping all the way down.
            cleaned = re.sub(r"[.,]", "", raw)

    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return None

    if not (MIN_PLAUSIBLE_PRICE <= value <= MAX_PLAUSIBLE_PRICE):
        return None
    return value.quantize(Decimal("0.01"))


def detect_currency(text: str) -> str | None:
    """The ISO code for whatever symbol appears in the string, if any."""
    # Longest first so "Rs." wins over "Rs", and "USD" over "$".
    for symbol in sorted(CURRENCY_SYMBOLS, key=len, reverse=True):
        if symbol.lower() in text.lower():
            return CURRENCY_SYMBOLS[symbol]
    return None


# --------------------------------------------------------------------------- #
# Strategies                                                                  #
# --------------------------------------------------------------------------- #


def _from_selectors(
    soup: BeautifulSoup, selectors: Iterable[str], strategy: Strategy
) -> Reading | None:
    """First selector that resolves to a parseable number wins.

    An element's `content` attribute is preferred over its text: retailers
    routinely render "₹1,299" visually while carrying the exact, unformatted
    figure in an attribute next to it.
    """
    for selector in selectors:
        try:
            nodes = soup.select(selector)
        except Exception:
            # A malformed selector is an editor's typo, not a scrape failure.
            # Skip it and try the next one rather than failing the whole link.
            continue

        for node in nodes:
            for candidate in (
                node.get("content"),
                node.get("data-price"),
                node.get_text(" ", strip=True),
            ):
                if not isinstance(candidate, str) or not candidate.strip():
                    continue
                price = parse_price(candidate)
                if price is not None:
                    return Reading(
                        price=price,
                        currency=detect_currency(candidate),
                        in_stock=None,
                        strategy=strategy,
                        confidence=CONFIDENCE_BY_STRATEGY[strategy],
                        raw=candidate.strip()[:200],
                    )
    return None


def _walk_json(node: Any) -> Iterable[dict[str, Any]]:
    """Every dict inside an arbitrarily nested JSON-LD document.

    Retailers nest Product inside @graph, inside arrays, inside ItemList —
    every combination is in the wild, so rather than model the shapes we walk
    the whole thing and look at each object on its own terms.
    """
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk_json(value)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_json(item)


def _from_json_ld(soup: BeautifulSoup) -> Reading | None:
    """schema.org Product/Offer — the retailer's own machine-readable price."""
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = script.string or script.get_text()
        if not text:
            continue
        try:
            document = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            # Unescaped newlines in JSON-LD are depressingly common. One bad
            # block should not cost us the others on the page.
            continue

        for obj in _walk_json(document):
            price_raw = obj.get("price")
            if price_raw is None and isinstance(obj.get("priceSpecification"), dict):
                price_raw = obj["priceSpecification"].get("price")
            if price_raw is None:
                continue

            price = parse_price(str(price_raw))
            if price is None:
                continue

            availability = str(obj.get("availability") or "")
            in_stock: bool | None = None
            if availability:
                lowered = availability.lower()
                if "outofstock" in lowered or "soldout" in lowered or "discontinued" in lowered:
                    in_stock = False
                elif "instock" in lowered or "limitedavailability" in lowered:
                    in_stock = True

            currency = obj.get("priceCurrency")
            if currency is None and isinstance(obj.get("priceSpecification"), dict):
                currency = obj["priceSpecification"].get("priceCurrency")

            return Reading(
                price=price,
                currency=str(currency)[:3].upper() if currency else None,
                in_stock=in_stock,
                strategy="json_ld",
                confidence=CONFIDENCE_BY_STRATEGY["json_ld"],
                raw=f"JSON-LD price={price_raw}",
            )
    return None


def _from_microdata(soup: BeautifulSoup) -> Reading | None:
    """`itemprop="price"`, with the value usually in `content`."""
    return _from_selectors(
        soup,
        ("[itemprop='price']", "[itemprop='lowPrice']", "[property='product:price:amount']"),
        "microdata",
    )


def _from_meta(soup: BeautifulSoup) -> Reading | None:
    """OpenGraph and product meta tags in the document head."""
    for name in (
        "og:price:amount",
        "product:price:amount",
        "twitter:data1",
        "price",
    ):
        node = soup.find("meta", attrs={"property": name}) or soup.find(
            "meta", attrs={"name": name}
        )
        if node is None:
            continue
        content = node.get("content")
        if not isinstance(content, str):
            continue
        price = parse_price(content)
        if price is None:
            continue

        currency_node = soup.find(
            "meta", attrs={"property": "og:price:currency"}
        ) or soup.find("meta", attrs={"property": "product:price:currency"})
        currency = currency_node.get("content") if currency_node else None

        return Reading(
            price=price,
            currency=(
                str(currency)[:3].upper()
                if isinstance(currency, str)
                else detect_currency(content)
            ),
            in_stock=None,
            strategy="meta",
            confidence=CONFIDENCE_BY_STRATEGY["meta"],
            raw=f"{name}={content}"[:200],
        )
    return None


def _from_text_scan(soup: BeautifulSoup) -> Reading | None:
    """Last resort: the smallest currency-prefixed number on the page.

    Smallest rather than first because a product page's largest figures are
    usually the struck-through MRP and the "you save" total, while the first is
    often a navigation banner. Neither heuristic is good, which is precisely
    why this strategy reports low confidence and the runner treats it as such.

    The scan walks *elements*, not the page's flattened text. That distinction
    is what makes the disqualifying-context list work at all: on a real product
    page "EMI from ₹2,499/month" and "Delivery ₹99" are their own nodes, so
    each number is judged against the words that actually label it. Flattening
    the page first would put those words within a few characters of the real
    price and reject every candidate — or, with a narrower window, accept the
    EMI figure. Neither is recoverable by tuning a character count.
    """
    body = soup.find("body") or soup

    candidates: list[tuple[Decimal, str, str | None]] = []
    for text_node in body.find_all(string=_PRICED_NUMBER_RE):
        parent = text_node.parent
        if parent is not None and parent.name in ("script", "style", "noscript"):
            continue

        # The element's own text is the label context — "Delivery ₹99" reads as
        # one phrase because the markup says it is one.
        context = (parent.get_text(" ", strip=True) if parent else str(text_node))[:300]
        if any(phrase in context.lower() for phrase in _DISQUALIFYING_CONTEXT):
            continue

        match = _PRICED_NUMBER_RE.search(str(text_node))
        if match is None:
            continue
        price = parse_price(match.group(2))
        if price is None:
            continue
        candidates.append((price, match.group(0), CURRENCY_SYMBOLS.get(match.group(1))))

    if not candidates:
        return None

    price, raw, currency = min(candidates, key=lambda c: c[0])
    return Reading(
        price=price,
        currency=currency or detect_currency(raw),
        in_stock=None,
        strategy="text_scan",
        confidence=CONFIDENCE_BY_STRATEGY["text_scan"],
        raw=raw[:200],
    )


# --------------------------------------------------------------------------- #
# Stock                                                                       #
# --------------------------------------------------------------------------- #


def detect_stock(soup: BeautifulSoup, out_of_stock_selectors: Iterable[str]) -> bool | None:
    """None means "the page did not say", which is different from "in stock".

    Recorded as None rather than assumed true: claiming a product is available
    when we simply could not tell would send a reader to a dead listing.
    """
    for selector in out_of_stock_selectors:
        try:
            if soup.select_one(selector) is not None:
                return False
        except Exception:
            continue

    body = soup.find("body") or soup
    text = body.get_text(" ", strip=True).lower()[:20000]
    if any(phrase in text for phrase in _OUT_OF_STOCK_PHRASES):
        return False
    return None


# --------------------------------------------------------------------------- #
# Entry point                                                                 #
# --------------------------------------------------------------------------- #


def extract_price(html: str, config: dict[str, Any] | None = None) -> Reading:
    """Read a price out of a product page.

    `config` is the retailer's `scrape_config`, straight from the database:

        priceSelectors       list[str]  tried first, in order
        outOfStockSelectors  list[str]  presence means unavailable
        currency             str        fallback when the page does not say
        allowTextScan        bool       enable the regex last resort (default on)

    Raises `NoPriceFound` when every strategy comes up empty — which is a
    normal, recordable outcome, not an error.
    """
    config = config or {}
    soup = BeautifulSoup(html, "html.parser")

    configured = [s for s in config.get("priceSelectors", []) if isinstance(s, str)]
    out_of_stock = [s for s in config.get("outOfStockSelectors", []) if isinstance(s, str)]

    reading: Reading | None = None
    if configured:
        reading = _from_selectors(soup, configured, "configured")
    reading = reading or _from_json_ld(soup)
    reading = reading or _from_microdata(soup)
    reading = reading or _from_meta(soup)
    reading = reading or _from_selectors(soup, _GENERIC_PRICE_SELECTORS, "generic")
    if reading is None and config.get("allowTextScan", True):
        reading = _from_text_scan(soup)

    if reading is None:
        raise NoPriceFound(
            "No price found on the page. If the retailer changed its layout, "
            "update this retailer's selectors in Pricing → Retailers."
        )

    # Stock from the page overrides nothing the structured data already told us.
    in_stock = reading.in_stock
    if in_stock is None:
        in_stock = detect_stock(soup, out_of_stock)

    currency = reading.currency or config.get("currency")

    return Reading(
        price=reading.price,
        currency=str(currency).upper()[:3] if currency else None,
        in_stock=in_stock,
        strategy=reading.strategy,
        confidence=reading.confidence,
        raw=reading.raw,
    )
