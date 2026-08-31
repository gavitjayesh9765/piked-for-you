"""
Price-drop alerts.

---------------------------------------------------------------------------
WHAT MAKES THIS FIRE

Nothing on a schedule. This module has no timer, no cron entry and no database
trigger — it is called by the request that has just applied a price, so an alert
exists because an admin pressed the button, exactly as the price behind it does.
That is the same non-negotiable the scraper is built around, and it would have
been easy to quietly break here: "notify me when the price drops" is the classic
reason a codebase grows its first background poller.

---------------------------------------------------------------------------
WHAT A READER IS PROMISED, AND WHAT WE CAN PROVE

The baseline is `saved_products.price_at_save` — the figure they were looking at
when they pressed Save. It is the only number "it dropped" can honestly be
measured against: the all-time high would fire on a price they already declined,
and the previous observation would fire on noise.

After an alert goes out the baseline moves to `alerted_price`, so a second run
over the same catalogue does not re-send the same news, and a price oscillating
inside the threshold does not become a subscription to one email per run.

Rows saved before the alert columns existed were backfilled with the current
price rather than alerted retroactively (migration 20260831000020). We never
observed those readers at an earlier price, and a saving we cannot evidence is
precisely the thing this site exists not to claim.

---------------------------------------------------------------------------
WHY FAILURE IS SILENT

Every entry point here is wrapped so that nothing it does can fail the caller.
The caller is an admin applying a price — work that has already committed by the
time we are reached. Losing an email is a missed notification; raising into that
handler would make a successful price update look like a failed one, and the
admin's correct response would be to run it again.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.mail import MailMessage, get_transport
from app.emails import render
from app.models import Product, Profile, SavedProduct, UserPreferences

logger = logging.getLogger(__name__)


#: How far a price must fall before it is worth an email.
#:
#: Not zero. A ₹40 move on a ₹120,000 laptop is a rounding artefact of one
#: retailer's pricing engine, and an inbox that reports it stops being read
#: before the drop that matters arrives. Three percent is the smallest move a
#: reader would describe as "it got cheaper" without being prompted.
MIN_DROP_PERCENT = Decimal("3")


def _percent_off(baseline: Decimal, now: Decimal) -> Decimal:
    return (baseline - now) / baseline * 100


def _money(amount: Decimal, currency: str) -> str:
    """Formatted for an inbox, not for a locale-aware browser.

    Deliberately simple: an email client has no Intl, the audience is Indian
    rupees today, and a wrong-but-confident currency symbol in someone's inbox
    is worse than a plain one. Grouping follows the Indian convention because
    that is what every price on the site already renders.
    """
    whole = int(amount)
    s = str(whole)
    if currency == "INR" and len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    symbol = "₹" if currency == "INR" else f"{currency} "
    return f"{symbol}{s}"


async def dispatch_price_drops(db: AsyncSession, product_ids: list[uuid.UUID]) -> int:
    """Alert everyone whose shortlist just got cheaper. Returns emails sent.

    Called after prices have been applied and committed. Safe to call with an
    empty list, with products nobody saved, and with mail disabled.
    """
    if not product_ids:
        return 0

    transport = get_transport()
    # `MAIL_PROVIDER=disabled`. Returning before the query rather than after it
    # matters: without this the baselines would still be advanced by the loop
    # below and the drop would be marked as told to a reader who was never told.
    if not transport.delivers:
        return 0

    try:
        rows = (
            await db.execute(
                select(SavedProduct, Profile, Product)
                .join(Profile, Profile.id == SavedProduct.user_id)
                .join(Product, Product.id == SavedProduct.product_id)
                .join(UserPreferences, UserPreferences.user_id == SavedProduct.user_id)
                .options(selectinload(Product.category))
                .where(
                    SavedProduct.product_id.in_(product_ids),
                    # Opt-in, and checked in the query rather than filtered in
                    # Python: a reader who never turned this on should not have
                    # their address loaded into this process at all.
                    UserPreferences.notify_price_drops.is_(True),
                    Product.status == "published",
                    Product.price_current.is_not(None),
                )
            )
        ).all()
    except Exception:
        logger.exception("price-drop alert query failed")
        return 0

    sent = 0
    now = datetime.now(timezone.utc)

    for saved, profile, product in rows:
        current = Decimal(product.price_current)

        # The baseline: what we last told them, or failing that what they saw
        # when they saved it. A row with neither has no honest comparison to
        # make, so it is baselined now and alerted on the NEXT drop.
        baseline = saved.alerted_price or saved.price_at_save
        if baseline is None:
            saved.price_at_save = current
            continue

        baseline = Decimal(baseline)
        if current >= baseline or baseline <= 0:
            # Not a drop. A rise does NOT move the baseline: someone who saved
            # at ₹20,000, watched it climb to ₹26,000 and then fall back to
            # ₹21,000 has not seen a saving, and telling them they have would
            # be the retailer's trick rather than our research.
            continue

        if _percent_off(baseline, current) < MIN_DROP_PERCENT:
            continue

        if await _send(profile, product, baseline, current):
            saved.alerted_price = current
            saved.alerted_at = now
            sent += 1

    return sent


async def _send(profile: Profile, product: Product, baseline: Decimal, current: Decimal) -> bool:
    """One alert. True if the provider accepted it."""
    currency = product.currency or "INR"
    saving = _money(baseline - current, currency)
    now_str = _money(current, currency)
    was_str = _money(baseline, currency)

    url = f"{settings.SITE_URL}/p/{product.category.slug}/{product.slug}"
    prefs_url = f"{settings.SITE_URL}/account/preferences"
    name = f"{product.title}"

    try:
        html = render(
            "price_drop",
            ProductName=name,
            NewPrice=now_str,
            OldPrice=was_str,
            Saving=saving,
            ProductURL=url,
            PreferencesURL=prefs_url,
        )
    except Exception:
        # A template fault is our bug and breaks every alert, not this one.
        logger.exception("price drop template failed to render")
        return False

    text = (
        f"{name} is now {now_str}\n\n"
        f"It was {was_str} when you saved it — {saving} less.\n\n"
        f"{url}\n\n"
        "We check prices by hand rather than on a timer, so this is a price we "
        "actually looked at. It is not a prediction, and it can go back up.\n\n"
        f"Turn these off: {prefs_url}\n"
    )

    try:
        await get_transport().send(
            MailMessage(
                to=profile.email,
                subject=f"{name} is now {now_str}",
                html=html,
                text=text,
                # A one-click way out, honoured by the mail client itself. The
                # target is the preference that governs this exact email rather
                # than a generic account page.
                headers={"List-Unsubscribe": f"<{prefs_url}>"},
            )
        )
        return True
    except Exception:
        # One bad address must not stop the rest of the batch.
        logger.warning("price drop alert to %s failed", profile.id, exc_info=True)
        return False
