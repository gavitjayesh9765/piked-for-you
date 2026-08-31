"""
Sending a newsletter campaign.

---------------------------------------------------------------------------
THE CONSTRAINT THAT SHAPES ALL OF THIS

Brevo's free plan is 300 emails a day, and that ceiling is SHARED with every
transactional mail the site sends — signup confirmations, password resets,
price-drop alerts. A list larger than the remaining headroom cannot go out in
one pass. Sending is therefore inherently resumable, and resumable sending is
only safe if it is idempotent.

`newsletter_campaign_sends` is what makes it so: one row per subscriber per
campaign, primary-keyed, written in the same transaction as the send. A campaign
that stops at 180 of 400 resumes at 181; a retry after a crash cannot mail
anyone twice. Without that table the only safe options are "send nothing on
retry" and "send everything again", and the second is how a list gets burned.

Headroom is reserved rather than consumed: a digest must never be the reason a
password reset does not arrive. See RESERVE_FOR_TRANSACTIONAL.

---------------------------------------------------------------------------
WHO IS ELIGIBLE

Confirmed, not unsubscribed, still active, and matching the campaign's audience.
Every one of those is a separate column and every one is checked here rather
than assumed from another — an address that confirmed a year ago and
unsubscribed yesterday satisfies `confirmed_at is not null` perfectly well.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.mail import MailMessage, get_transport
from app.emails import escape, render
from app.models import (
    NewsletterCampaign,
    NewsletterCampaignSend,
    NewsletterSubscriber,
    Product,
)

logger = logging.getLogger(__name__)

#: The provider's daily ceiling. Brevo free plan, and shared across everything.
DAILY_CEILING = 300

#: Kept back for transactional mail. A confirmation that never arrives costs a
#: subscriber; a password reset that never arrives costs an account. A digest is
#: the one kind of mail here that can safely wait until tomorrow, so it is the
#: one that yields.
RESERVE_FOR_TRANSACTIONAL = 100

#: The most a single call will attempt, regardless of headroom. Sending happens
#: inside a request, and a request that mails two hundred people is a request
#: that times out somewhere unhelpful. The admin screen shows progress and the
#: send is resumed by pressing the button again.
BATCH_LIMIT = 50


def _eligible(campaign: NewsletterCampaign):
    """The audience, as a query filter.

    Each condition is its own column and none is inferred from another: an
    address that confirmed a year ago and unsubscribed yesterday satisfies
    `confirmed_at is not null` perfectly well, and would be mailed by a filter
    that treated confirmation as sufficient.
    """
    stmt = select(NewsletterSubscriber).where(
        NewsletterSubscriber.confirmed_at.is_not(None),
        NewsletterSubscriber.unsubscribed_at.is_(None),
        NewsletterSubscriber.is_active.is_(True),
    )
    if campaign.audience != "all":
        stmt = stmt.where(NewsletterSubscriber.frequency == campaign.audience)
    return stmt


async def count_audience(db: AsyncSession, campaign: NewsletterCampaign) -> int:
    return (
        await db.execute(select(func.count()).select_from(_eligible(campaign).subquery()))
    ).scalar_one()


async def _sent_today(db: AsyncSession) -> int:
    """Campaign mail sent in the last 24 hours.

    A rolling window rather than "since midnight", because the provider's reset
    is in its own timezone and guessing wrong means either wasting headroom or
    being refused mid-batch. A rolling window is never wrong in the direction
    that sends too many.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    return (
        await db.execute(
            select(func.count())
            .select_from(NewsletterCampaignSend)
            .where(NewsletterCampaignSend.sent_at >= since)
        )
    ).scalar_one()


async def headroom(db: AsyncSession) -> int:
    """How many campaign emails may still go out today."""
    return max(0, DAILY_CEILING - RESERVE_FOR_TRANSACTIONAL - await _sent_today(db))


def _money(amount: Decimal | None, currency: str) -> str:
    if amount is None:
        return ""
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
    return f"{'₹' if currency == 'INR' else currency + ' '}{s}"


def build_picks(products: list[Product]) -> tuple[str, str]:
    """The picks block, as (html, text).

    ---------------------------------------------------------------------------
    THIS IS THE ONE PLACE THAT PASSES MARKUP THROUGH `render` UNESCAPED

    So every field interpolated below goes through `escape` explicitly. Product
    titles, taglines and brand names are editor-entered, which is exactly the
    kind of input that is trusted right up until the day it is not.

    Inline elements only — the digest template puts this inside a paragraph, and
    a table there is invalid. That is also the better design: mail clients block
    remote images by default, so a card layout arrives as a column of grey
    boxes, and the tagline is the part that was load-bearing anyway.
    """
    rows: list[str] = []
    lines: list[str] = []

    for i, p in enumerate(products, start=1):
        n = f"{i:02d}"
        url = f"{settings.SITE_URL}/p/{p.category.slug}/{p.slug}"
        price = _money(p.price_current, p.currency or "INR")
        brand = p.brand.name if p.brand else ""

        rows.append(
            f'<span style="font-family:ui-monospace,monospace; font-size:12px; color:#8A8A8A;">{n}</span>'
            f'&nbsp;&nbsp;'
            f'<a href="{escape(url)}" style="color:#0A0A0A; text-decoration:none; font-weight:600;">'
            f"{escape(brand)} {escape(p.title)}</a>"
            + (f'&nbsp;&nbsp;<span style="color:#8A8A8A;">{escape(price)}</span>' if price else "")
            + (
                f'<br /><span style="color:#5A5A5A;">{escape(p.tagline)}</span>'
                if p.tagline
                else ""
            )
        )
        lines.append(f"{n}  {brand} {p.title}{f'  {price}' if price else ''}\n    {p.tagline or ''}\n    {url}")

    return "<br /><br />".join(rows), "\n\n".join(lines)


async def send_batch(db: AsyncSession, campaign: NewsletterCampaign) -> dict:
    """Send up to one batch of a campaign. Call again to continue.

    Returns what happened, so the admin screen can say it plainly rather than
    reporting a bare success for a send that stopped after eleven emails.
    """
    transport = get_transport()
    if not transport.delivers:
        return {"sent": 0, "remaining": 0, "status": campaign.status, "reason": "mail_disabled"}

    room = await headroom(db)
    if room <= 0:
        campaign.status = "paused"
        return {"sent": 0, "remaining": 0, "status": "paused", "reason": "daily_ceiling"}

    # Products, in the editor's order. `IN` returns rows in whatever order the
    # planner likes, so the campaign's own sequence is reapplied afterwards —
    # the order is the argument the editor was making.
    products: list[Product] = []
    if campaign.product_ids:
        found = (
            (
                await db.execute(
                    select(Product)
                    .options(selectinload(Product.category), selectinload(Product.brand))
                    .where(Product.id.in_(campaign.product_ids), Product.status == "published")
                )
            )
            .unique()
            .scalars()
            .all()
        )
        by_id = {p.id: p for p in found}
        # An unpublished or deleted pick is dropped rather than sent as a dead
        # link. It is a silent omission on purpose: the alternative is failing
        # the whole send for one product an editor archived this morning.
        products = [by_id[pid] for pid in campaign.product_ids if pid in by_id]

    picks_html, picks_text = build_picks(products)

    already = select(NewsletterCampaignSend.subscriber_id).where(
        NewsletterCampaignSend.campaign_id == campaign.id
    )
    batch = (
        (
            await db.execute(
                _eligible(campaign)
                .where(NewsletterSubscriber.id.not_in(already))
                .order_by(NewsletterSubscriber.created_at)
                .limit(min(BATCH_LIMIT, room))
            )
        )
        .scalars()
        .all()
    )

    if campaign.status == "draft":
        campaign.status = "sending"
        campaign.started_at = datetime.now(timezone.utc)
        campaign.recipient_count = await count_audience(db, campaign)

    sent = 0
    for sub in batch:
        unsubscribe = (
            f"{settings.SITE_URL.rstrip('/')}"
            f"/newsletter/unsubscribe?token={sub.unsubscribe_token}"
        )
        try:
            html = render(
                "newsletter_digest",
                raw={"Picks": picks_html},
                Subject=campaign.subject,
                Intro=campaign.intro or "",
                UnsubscribeURL=unsubscribe,
            )
        except Exception:
            # A template fault breaks every send, not this one. Fail the
            # campaign loudly rather than quietly mailing nobody.
            logger.exception("newsletter digest template failed to render")
            campaign.status = "failed"
            campaign.error = "The digest template failed to render."
            return {"sent": sent, "remaining": 0, "status": "failed", "reason": "template"}

        text = (
            f"{campaign.subject}\n\n"
            f"{campaign.intro or ''}\n\n{picks_text}\n\n"
            f"Unsubscribe: {unsubscribe}\n"
        )

        try:
            await transport.send(
                MailMessage(
                    to=sub.email,
                    subject=campaign.subject,
                    html=html,
                    text=text,
                    # The real one-click header, on the subscriber's persistent
                    # token — so a mail client's own unsubscribe button works
                    # without the recipient ever reaching the site.
                    headers={
                        "List-Unsubscribe": f"<{unsubscribe}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                )
            )
        except Exception:
            # One bad address does not stop the batch, and is not recorded as
            # sent — so the next pass retries it rather than skipping it.
            logger.warning("digest to subscriber %s failed", sub.id, exc_info=True)
            campaign.failed_count += 1
            continue

        # Written immediately, not batched at the end: if this process dies
        # mid-loop, everything already delivered must already be recorded.
        await db.execute(
            pg_insert(NewsletterCampaignSend)
            .values(campaign_id=campaign.id, subscriber_id=sub.id)
            .on_conflict_do_nothing(index_elements=["campaign_id", "subscriber_id"])
        )
        campaign.sent_count += 1
        sent += 1

    remaining = (
        await db.execute(
            select(func.count()).select_from(
                _eligible(campaign)
                .where(NewsletterSubscriber.id.not_in(already))
                .subquery()
            )
        )
    ).scalar_one()

    if remaining == 0:
        campaign.status = "sent"
        campaign.finished_at = datetime.now(timezone.utc)
    elif await headroom(db) <= 0:
        # Out of budget, not out of work. "Paused" says which, so the admin
        # screen can tell someone to come back tomorrow rather than showing a
        # half-sent campaign that looks stuck.
        campaign.status = "paused"
    else:
        campaign.status = "sending"

    return {
        "sent": sent,
        "remaining": remaining,
        "status": campaign.status,
        "reason": None,
    }
