"""
Retailer link management (spec §26).

Retailer URLs are never hard-coded in the frontend. They are data, attached
per product, and each carries a last-checked timestamp so a stale price can be
told apart from a current one. Adding a retailer — Amazon, Flipkart, the
brand's own Official store — is a row in `retailers`, not a code change.

A link row also owns price history: `price_history` points at its id, and the
scraper writes its state back here. That is why saving this form updates rows
in place rather than replacing them.

Outbound URLs are validated here rather than trusted: an admin account is a
compromise target, and a `javascript:` URL stored on a product page would
execute for every visitor.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Body, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.models import Product, ProductRetailer, Retailer
from app.schemas.product import RetailerLinkOut

router = APIRouter()


class RetailerLinkIn(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    retailer_id: uuid.UUID
    url: str = Field(min_length=8, max_length=1500)
    display_price: float | None = Field(default=None, ge=0)
    is_active: bool = True
    # Per-link opt-out. Some links are to a bundle or a marketplace listing
    # whose price means something different from the product's, and checking
    # them automatically does more harm than leaving them alone.
    scrape_enabled: bool = True


def _validate_url(raw: str) -> str:
    """Only http(s), and only an absolute URL with a host.

    Blocks `javascript:`, `data:`, and scheme-relative values — any of which
    would be rendered into an anchor and clicked by real visitors.
    """
    url = raw.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Retailer URL must be an absolute http(s) address.",
        )
    return url


@router.get("/retailers", response_model=list[dict])
async def list_retailers(admin: CurrentAdmin, db: DbSession) -> list[dict]:
    """The retailers a link can point at (Amazon, Flipkart, …)."""
    rows = (
        await db.execute(
            select(Retailer).where(Retailer.is_active.is_(True)).order_by(Retailer.display_order)
        )
    ).scalars().all()
    return [{"id": str(r.id), "name": r.name, "slug": r.slug} for r in rows]


@router.put("/products/{product_id}/retailers", response_model=list[RetailerLinkOut])
async def set_retailer_links(
    product_id: uuid.UUID,
    payload: Annotated[list[RetailerLinkIn], Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> list[RetailerLinkOut]:
    """Set the product's retailer links to exactly this set.

    The form submits the complete set, so links absent from the payload are
    removed — a merge would make deleting a link impossible without a second
    endpoint.

    But *removed* is not the same as *recreated*. Rows the payload still names
    are updated in place rather than deleted and re-inserted, because a link
    row now owns history: its scrape state, its last-checked timestamp, and the
    price_history rows that point at its id. Delete-and-recreate would silently
    detach every past price from the link it was observed on, and reset the
    scrape state on every unrelated save of the product form.

    A URL change is treated as an edit of the same link, not a new one. It is
    the same retailer selling the same product — usually a canonical URL or a
    regional domain — and the price series should stay continuous across it.
    """
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    valid_ids = set(
        (
            await db.execute(
                select(Retailer.id).where(
                    Retailer.id.in_([p.retailer_id for p in payload] or [uuid.uuid4()])
                )
            )
        ).scalars().all()
    )

    existing = {
        link.retailer_id: link
        for link in (
            await db.execute(
                select(ProductRetailer).where(ProductRetailer.product_id == product_id)
            )
        ).scalars().all()
    }

    now = datetime.now(timezone.utc)
    seen: set[uuid.UUID] = set()

    for item in payload:
        if item.retailer_id not in valid_ids or item.retailer_id in seen:
            continue  # unknown or duplicated retailer — skip rather than fail the save
        seen.add(item.retailer_id)

        url = _validate_url(item.url)
        link = existing.get(item.retailer_id)

        if link is None:
            db.add(
                ProductRetailer(
                    product_id=product_id,
                    retailer_id=item.retailer_id,
                    url=url,
                    display_price=item.display_price,
                    is_active=item.is_active,
                    scrape_enabled=item.scrape_enabled,
                    price_checked_at=now if item.display_price is not None else None,
                )
            )
            continue

        # Only stamp price_checked_at when the price actually changed. Stamping
        # it on every save would make a typo in the tagline look like a fresh
        # price check, and the whole point of the field is to tell a current
        # price from a stale one.
        if item.display_price != (
            float(link.display_price) if link.display_price is not None else None
        ):
            link.price_checked_at = now

        link.url = url
        link.display_price = item.display_price
        link.is_active = item.is_active
        link.scrape_enabled = item.scrape_enabled

    removed = [link for rid, link in existing.items() if rid not in seen]
    for link in removed:
        await db.delete(link)

    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.retailers.set",
        entity_type="product",
        entity_id=product_id,
        summary=f"Set {len(seen)} retailer link(s) on “{product.title}”",
        ip_address=client_ip(request),
    )

    rows = (
        await db.execute(
            select(ProductRetailer, Retailer)
            .join(Retailer, Retailer.id == ProductRetailer.retailer_id)
            .where(ProductRetailer.product_id == product_id)
        )
    ).all()

    return [
        RetailerLinkOut(
            id=link.id,
            retailer=ret.name,
            retailer_slug=ret.slug,
            url=link.url,
            display_price=link.display_price,
            is_active=link.is_active,
            last_updated_at=link.price_checked_at,
            is_affiliate=bool(ret.affiliate_template),
            in_stock=link.in_stock,
            scrape_enabled=link.scrape_enabled,
            last_scrape_status=link.last_scrape_status,
            last_scrape_error=link.last_scrape_error,
            last_scraped_at=link.last_scraped_at,
        )
        for link, ret in rows
    ]
