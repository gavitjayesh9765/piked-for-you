"""
Tests for the price extractor.

`app/services/scraper/extract.py` is pure — HTML in, `Reading` out — which is
what makes it worth testing properly. Every case below is a shape we have to
get right on a real Indian storefront, and each one is cheaper to pin here than
to discover from a wrong price on a live product page.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.scraper.extract import (
    NoPriceFound,
    detect_currency,
    detect_stock,
    extract_price,
    parse_price,
)
from app.services.scraper.runner import judge


# --------------------------------------------------------------------------- #
# Number parsing                                                              #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # Indian lakh grouping — two digits then three. The format that breaks
        # every naive "strip commas, split on the last dot" parser.
        ("₹1,23,456", Decimal("123456.00")),
        ("₹1,23,456.50", Decimal("123456.50")),
        ("Rs. 24,999", Decimal("24999.00")),
        ("₹2,999.00", Decimal("2999.00")),
        # US grouping.
        ("$1,234.56", Decimal("1234.56")),
        ("1,234,567", Decimal("1234567.00")),
        # European: dot groups, comma decimal. The mirror image of the above,
        # and the reason the rule reads the *last* separator rather than
        # assuming which character means what.
        ("€1.234,56", Decimal("1234.56")),
        # No separators at all.
        ("4999", Decimal("4999.00")),
        ("4999.99", Decimal("4999.99")),
        # Whitespace and non-breaking spaces, as pasted out of real markup.
        ("\xa0₹ 12,999\xa0", Decimal("12999.00")),
    ],
)
def test_parse_price_handles_real_formats(text: str, expected: Decimal) -> None:
    assert parse_price(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        "Currently unavailable",
        "Free delivery",
        # Below the plausibility floor and above the ceiling. Both are parse
        # accidents rather than prices, and returning them would let a rating
        # or a review count become a product's price.
        "₹0",
        "₹99,99,99,999",
    ],
)
def test_parse_price_rejects_non_prices(text: str) -> None:
    assert parse_price(text) is None


def test_detect_currency_prefers_the_longer_symbol() -> None:
    # "Rs." must not be read as a bare "Rs", and "USD" must beat "$".
    assert detect_currency("Rs. 1,299") == "INR"
    assert detect_currency("USD 40") == "USD"
    assert detect_currency("no symbol here") is None


# --------------------------------------------------------------------------- #
# Strategy ladder                                                             #
# --------------------------------------------------------------------------- #


def test_configured_selector_wins_over_everything_else() -> None:
    """An editor's selector is the most trustworthy source we have.

    The page below carries a *different* number in JSON-LD on purpose: if the
    ladder ever silently reorders, this test fails rather than the site quietly
    switching to a price nobody configured.
    """
    html = """
    <html><body>
      <script type="application/ld+json">
        {"@type": "Product", "offers": {"price": "9999", "priceCurrency": "INR"}}
      </script>
      <span class="my-price">₹7,499</span>
    </body></html>
    """
    reading = extract_price(html, {"priceSelectors": ["span.my-price"]})

    assert reading.price == Decimal("7499.00")
    assert reading.strategy == "configured"
    assert reading.confidence == "high"


def test_json_ld_is_found_inside_a_graph() -> None:
    """Retailers nest Product inside @graph, arrays and ItemList, in every
    combination. The walker looks at every object rather than modelling shapes."""
    html = """
    <html><body><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList"},
        {"@type":"Product","name":"X","offers":[
          {"@type":"Offer","price":"14999.00","priceCurrency":"INR",
           "availability":"https://schema.org/InStock"}]}
      ]}
    </script></body></html>
    """
    reading = extract_price(html)

    assert reading.price == Decimal("14999.00")
    assert reading.currency == "INR"
    assert reading.in_stock is True
    assert reading.strategy == "json_ld"


def test_json_ld_availability_marks_out_of_stock() -> None:
    html = """
    <html><body><script type="application/ld+json">
      {"@type":"Product","offers":{"price":"999","priceCurrency":"INR",
       "availability":"http://schema.org/OutOfStock"}}
    </script></body></html>
    """
    assert extract_price(html).in_stock is False


def test_one_malformed_json_ld_block_does_not_lose_the_others() -> None:
    """Unescaped newlines in JSON-LD are depressingly common."""
    html = """
    <html><body>
      <script type="application/ld+json">{ this is not json </script>
      <script type="application/ld+json">
        {"@type":"Product","offers":{"price":"2499","priceCurrency":"INR"}}
      </script>
    </body></html>
    """
    assert extract_price(html).price == Decimal("2499.00")


def test_content_attribute_beats_formatted_text() -> None:
    """Storefronts render "₹1,299" while carrying the exact figure alongside."""
    html = '<html><body><span itemprop="price" content="1299.49">₹1,299</span></body></html>'
    reading = extract_price(html)

    assert reading.price == Decimal("1299.49")
    assert reading.strategy == "microdata"


def test_meta_tags_are_used_when_nothing_structured_exists() -> None:
    html = """
    <html><head>
      <meta property="og:price:amount" content="3499">
      <meta property="og:price:currency" content="INR">
    </head><body></body></html>
    """
    reading = extract_price(html)

    assert reading.price == Decimal("3499.00")
    assert reading.currency == "INR"
    assert reading.strategy == "meta"


def test_a_broken_selector_is_skipped_rather_than_fatal() -> None:
    """A malformed selector is an editor's typo, not a scrape failure. It must
    not cost the link its price."""
    html = '<html><body><span class="p">₹1,999</span></body></html>'
    reading = extract_price(html, {"priceSelectors": ["span[[[", "span.p"]})

    assert reading.price == Decimal("1999.00")


# --------------------------------------------------------------------------- #
# The text scan — the risky one                                               #
# --------------------------------------------------------------------------- #


def test_text_scan_skips_emi_and_delivery_figures() -> None:
    """The failure this whole feature has to survive.

    A page whose real price is ₹54,990 also says "EMI from ₹2,499/month" and
    "Delivery ₹99". Reading either of those and writing it to the catalogue is
    the exact accident the disqualifying-context list exists to prevent.
    """
    html = """
    <html><body>
      <div>EMI from ₹2,499/month</div>
      <div>Delivery ₹99</div>
      <div id="the-price">₹54,990</div>
    </body></html>
    """
    reading = extract_price(html)

    assert reading.price == Decimal("54990.00")
    assert reading.strategy == "text_scan"
    # And it says so: the runner halves its tolerance for anything this weak.
    assert reading.confidence == "low"


def test_text_scan_can_be_turned_off() -> None:
    html = "<html><body><div>₹1,299</div></body></html>"
    with pytest.raises(NoPriceFound):
        extract_price(html, {"allowTextScan": False})


def test_no_price_anywhere_raises_rather_than_guessing() -> None:
    html = "<html><body><p>This product has been discontinued.</p></body></html>"
    with pytest.raises(NoPriceFound):
        extract_price(html)


# --------------------------------------------------------------------------- #
# Stock                                                                       #
# --------------------------------------------------------------------------- #


def test_unknown_stock_is_none_not_true() -> None:
    """None means "the page did not say", which is not the same as available.

    Claiming availability we never observed sends a reader to a dead listing,
    so the three-valued answer is deliberate.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup("<html><body><p>A product.</p></body></html>", "html.parser")
    assert detect_stock(soup, []) is None


def test_out_of_stock_selector_is_honoured() -> None:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup('<html><body><div id="oos"></div></body></html>', "html.parser")
    assert detect_stock(soup, ["#oos"]) is False


# --------------------------------------------------------------------------- #
# The guard rail                                                              #
# --------------------------------------------------------------------------- #


def _reading(price: str, confidence: str = "high"):
    from app.services.scraper.extract import Reading

    return Reading(
        price=Decimal(price),
        currency="INR",
        in_stock=None,
        strategy="configured" if confidence == "high" else "text_scan",
        confidence=confidence,  # type: ignore[arg-type]
        raw=price,
    )


def test_first_ever_reading_is_always_accepted() -> None:
    """With no current price there is nothing to disagree with."""
    accept, reason = judge(_reading("9999"), None, Decimal("60"))
    assert accept and reason is None


def test_a_modest_change_is_accepted() -> None:
    accept, _ = judge(_reading("9000"), Decimal("10000"), Decimal("60"))
    assert accept


def test_an_implausible_drop_is_held_back() -> None:
    accept, reason = judge(_reading("999"), Decimal("10000"), Decimal("60"))
    assert not accept
    assert reason is not None and "tolerance" in reason


def test_low_confidence_gets_a_tighter_tolerance() -> None:
    """The same 40% move: fine from a configured selector, refused from a
    regex over page text. That is what the confidence tiers buy."""
    current, tolerance = Decimal("10000"), Decimal("60")

    accept_high, _ = judge(_reading("6000", "high"), current, tolerance)
    accept_low, _ = judge(_reading("6000", "low"), current, tolerance)

    assert accept_high
    assert not accept_low
