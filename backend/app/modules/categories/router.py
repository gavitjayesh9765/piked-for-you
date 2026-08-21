"""Category endpoints (spec §23). The tree is admin-managed, never hard-coded."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DbSession
from app.models import Category, Product
from app.schemas.taxonomy import CategoryOut, CategoryTreeOut

router = APIRouter()


def _cache(response: Response) -> None:
    response.headers["Cache-Control"] = (
        f"public, max-age=0, s-maxage={settings.PUBLIC_CACHE_SECONDS}, stale-while-revalidate=60"
    )


async def _counts(db: DbSession) -> dict:
    """Published product count per category, in one query.

    Counts published only — a category advertising "12 products" that shows 3
    is worse than no count at all.
    """
    rows = (
        await db.execute(
            select(Product.category_id, func.count(Product.id))
            .where(Product.status == "published")
            .group_by(Product.category_id)
        )
    ).all()
    return {cid: count for cid, count in rows}


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: DbSession,
    response: Response,
    homepage_only: Annotated[bool, Query()] = False,
) -> list[CategoryOut]:
    """Active categories in display order. Drives the site sub-nav (spec §13)
    and the homepage tiles."""
    _cache(response)

    stmt = select(Category).where(Category.is_active.is_(True))
    if homepage_only:
        stmt = stmt.where(Category.show_on_homepage.is_(True))
    stmt = stmt.order_by(Category.display_order, Category.name)

    categories = list((await db.execute(stmt)).scalars().all())
    counts = await _counts(db)

    return [
        CategoryOut(**{**_row(c), "product_count": counts.get(c.id, 0)}) for c in categories
    ]


@router.get("/tree", response_model=list[CategoryTreeOut])
async def category_tree(db: DbSession, response: Response) -> list[CategoryTreeOut]:
    """Full nested hierarchy — one query, assembled in memory rather than a
    recursive walk per level."""
    _cache(response)

    categories = list(
        (
            await db.execute(
                select(Category)
                .where(Category.is_active.is_(True))
                .order_by(Category.depth, Category.display_order, Category.name)
            )
        ).scalars().all()
    )
    counts = await _counts(db)

    nodes: dict = {
        c.id: CategoryTreeOut(**{**_row(c), "product_count": counts.get(c.id, 0), "children": []})
        for c in categories
    }
    roots: list[CategoryTreeOut] = []
    for c in categories:
        node = nodes[c.id]
        parent = nodes.get(c.parent_id) if c.parent_id else None
        (parent.children if parent else roots).append(node)
    return roots


@router.get("/{path:path}", response_model=CategoryOut)
async def get_category(path: str, db: DbSession, response: Response) -> CategoryOut:
    """Resolve a full slug path such as `electronics/audio/headphones`.

    Matches on the last segment and verifies the whole denormalised `path`
    array, so `/c/gaming/headphones` cannot resolve a category that actually
    lives under audio.
    """
    _cache(response)

    segments = [s for s in path.strip("/").split("/") if s]
    if not segments:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    category = (
        await db.execute(
            select(Category).where(
                Category.slug == segments[-1], Category.is_active.is_(True)
            )
        )
    ).scalar_one_or_none()

    if category is None or (len(segments) > 1 and list(category.path) != segments):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    counts = await _counts(db)
    return CategoryOut(**{**_row(category), "product_count": counts.get(category.id, 0)})


def _row(c: Category) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "slug": c.slug,
        "path": list(c.path or []),
        "description": c.description,
        "icon": c.icon,
        "image_url": c.image_url,
        "parent_id": c.parent_id,
        "display_order": c.display_order,
        "is_active": c.is_active,
        "show_on_homepage": c.show_on_homepage,
    }
