"""
Curated alternatives (spec §52).

The public product page ends on a question it has usually just created. Told to
SKIP, or to WAIT FOR A SALE, a reader's next thought is "then what should I
buy?" — and the price-band heuristic in modules/products/repository.py cannot
answer it. It knows two products cost about the same and sit in the same
category. It does not know that one of them is the right call on a student
budget and the other is the one to buy if you edit video for a living.

That sentence is editorial, so it is authored here.

Whole-set semantics, matching retailer links: the admin sees a list and saves a
list. Ordering is the array order, so an editor reorders by dragging rather
than by maintaining a number.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.models import Product, ProductAlternative, ProductBadge
from app.modules.products.service import sign_for, to_summary
from app.schemas.product import AlternativeOut, AlternativesUpsert

router = APIRouter()


async def _rows(db: DbSession, product_id: uuid.UUID) -> list[AlternativeOut]:
    """The stored set, as the admin should see it.

    Deliberately does NOT filter on published status, unlike the public
    endpoint. An editor lining up alternatives works on drafts constantly, and
    hiding a pick they just made because its target is not live yet would look
    like the save had failed.
    """
    links = (
        (
            await db.execute(
                select(ProductAlternative)
                .where(ProductAlternative.product_id == product_id)
                .order_by(ProductAlternative.display_order, ProductAlternative.created_at)
            )
        )
        .scalars()
        .all()
    )
    if not links:
        return []

    # Every relationship `to_summary` touches is eager-loaded. A lazy load
    # inside an async session does not fall back to a query — it raises
    # MissingGreenlet — so the eager options here are the difference between
    # this endpoint working and 500-ing on its first row.
    targets = {
        p.id: p
        for p in (
            await db.execute(
                select(Product)
                .where(Product.id.in_([link.alternative_id for link in links]))
                .options(
                    selectinload(Product.brand),
                    selectinload(Product.category),
                    selectinload(Product.media),
                    selectinload(Product.score),
                    selectinload(Product.badge_links).selectinload(ProductBadge.badge),
                )
            )
        )
        .unique()
        .scalars()
        .all()
    }
    ordered = [targets[link.alternative_id] for link in links if link.alternative_id in targets]
    urls = await sign_for(ordered)

    return [
        AlternativeOut(
            **to_summary(targets[link.alternative_id], urls).model_dump(by_alias=False),
            reason=link.reason,  # type: ignore[arg-type]
            note=link.note,
            is_curated=True,
        )
        for link in links
        if link.alternative_id in targets
    ]


@router.get("/products/{product_id}/alternatives", response_model=list[AlternativeOut])
async def list_alternatives(
    product_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> list[AlternativeOut]:
    if await db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return await _rows(db, product_id)


@router.put("/products/{product_id}/alternatives", response_model=list[AlternativeOut])
async def set_alternatives(
    product_id: uuid.UUID,
    payload: Annotated[AlternativesUpsert, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> list[AlternativeOut]:
    """Replace the curated set with exactly this one.

    Unlike retailer links, these rows own nothing — no history points at them —
    so replacing wholesale is safe and keeps the code honest about what the
    payload means.

    Two guards, both of which the database also enforces. Doing it here as well
    is not redundant: a 422 naming the problem is a usable error, and a raised
    IntegrityError halfway through a delete-then-insert is not.
    """
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    if any(item.alternative_id == product_id for item in payload.items):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A product cannot be its own alternative.",
        )

    wanted = [item.alternative_id for item in payload.items]
    if len(set(wanted)) != len(wanted):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The same product is listed twice.",
        )

    known = set(
        (
            await db.execute(
                select(Product.id).where(Product.id.in_(wanted or [uuid.uuid4()]))
            )
        )
        .scalars()
        .all()
    )
    missing = [str(pid) for pid in wanted if pid not in known]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown product(s): {', '.join(missing)}",
        )

    existing = (
        (
            await db.execute(
                select(ProductAlternative).where(ProductAlternative.product_id == product_id)
            )
        )
        .scalars()
        .all()
    )
    for link in existing:
        await db.delete(link)
    # Without this the inserts below race the deletes into the same unique
    # index and Postgres rejects the save as a duplicate pair.
    await db.flush()

    for order, item in enumerate(payload.items):
        db.add(
            ProductAlternative(
                product_id=product_id,
                alternative_id=item.alternative_id,
                reason=item.reason,
                note=(item.note or None),
                display_order=order,
            )
        )

    await db.flush()

    await audit.record(
        db,
        actor_id=admin.id,
        action="product.alternatives.set",
        entity_type="product",
        entity_id=product_id,
        summary=f"Set {len(payload.items)} alternative(s) on “{product.title}”",
        ip_address=client_ip(request),
    )

    return await _rows(db, product_id)
