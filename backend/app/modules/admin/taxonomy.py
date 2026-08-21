"""
Admin CRUD for categories, brands and badges (spec §21–§23), plus product
video links.

The tricky one is category reparenting: `path` is denormalised onto every row
so a URL like /c/electronics/audio/headphones resolves in one indexed query.
Moving a category therefore has to rewrite the path of every descendant, which
is why that runs as a single database function inside one transaction rather
than a loop in Python that could die halfway and leave a broken tree.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select, text

from app.core import audit
from app.core.deps import CurrentAdmin, DbSession, client_ip
from app.core.video_links import InvalidVideoLink
from app.core.video_links import parse as parse_video
from app.models import Badge, Brand, Category, Product, ProductMedia

router = APIRouter()


class Strict(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)[:140] or "untitled"


def _clean_db_error(exc: Exception) -> str:
    """Extract the human message a RAISE EXCEPTION produced.

    asyncpg wraps it in driver and SQLAlchemy noise; the last line is the text
    the trigger actually wrote. Anything unrecognised becomes a generic message
    rather than being echoed back.
    """
    text_value = str(getattr(exc, "orig", exc))
    # asyncpg stringifies as: <class 'asyncpg.exceptions.RaiseError'>: message
    text_value = re.sub(r"^<class '[^']+'>:\s*", "", text_value.strip())
    text_value = re.sub(r"^\([^)]*\)\s*", "", text_value)
    text_value = text_value.splitlines()[0].strip() if text_value.strip() else ""

    known = ("cycle", "own parent")
    if text_value and any(k in text_value.lower() for k in known):
        return text_value[:200]
    return "That change is not allowed."


async def _unique_slug(db: DbSession, model, base: str, exclude: uuid.UUID | None = None) -> str:
    slug, n = base, 1
    while True:
        stmt = select(model.id).where(model.slug == slug)
        if exclude:
            stmt = stmt.where(model.id != exclude)
        if (await db.execute(stmt)).scalar_one_or_none() is None:
            return slug
        n += 1
        slug = f"{base}-{n}"


# ====================================================================== #
# Categories                                                              #
# ====================================================================== #


class CategoryIn(Strict):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=140)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=60)
    parent_id: uuid.UUID | None = None
    display_order: int = 0
    is_active: bool = True
    show_on_homepage: bool = False


class CategoryPatch(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    icon: str | None = None
    parent_id: uuid.UUID | None = None
    display_order: int | None = None
    is_active: bool | None = None
    show_on_homepage: bool | None = None


def _cat_row(c: Category, product_count: int = 0, direct: int = 0) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "slug": c.slug,
        "description": c.description,
        "icon": c.icon,
        "parentId": str(c.parent_id) if c.parent_id else None,
        "path": list(c.path or []),
        "depth": c.depth,
        "displayOrder": c.display_order,
        "isActive": c.is_active,
        "showOnHomepage": c.show_on_homepage,
        "productCount": product_count,
        "directProductCount": direct,
        # Read-only. The scoring editor needs to know which criteria this
        # category actually allows — `set_score` rejects any other key
        # (spec §24), and without this the UI could only guess at them.
        # Deliberately absent from CategoryIn: these are seeded, not authored
        # through the panel, so exposing them here adds no write surface.
        "scoreCriteria": list(c.score_criteria or []),
    }


@router.get("/categories")
async def list_categories(admin: CurrentAdmin, db: DbSession) -> dict:
    """The whole tree, flat, in display order — the client nests it."""
    rows = list(
        (
            await db.execute(
                select(Category).order_by(Category.depth, Category.display_order, Category.name)
            )
        ).scalars().all()
    )

    counts = {
        cid: n
        for cid, n in (
            await db.execute(
                select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
            )
        ).all()
    }

    return {"items": [_cat_row(c, counts.get(c.id, 0), counts.get(c.id, 0)) for c in rows]}


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: Annotated[CategoryIn, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    if payload.parent_id:
        parent = await db.get(Category, payload.parent_id)
        if parent is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown parent category")

    slug = await _unique_slug(db, Category, slugify(payload.slug or payload.name))

    category = Category(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        icon=payload.icon,
        parent_id=payload.parent_id,
        display_order=payload.display_order,
        is_active=payload.is_active,
        show_on_homepage=payload.show_on_homepage,
        path=[],
        depth=0,
    )
    db.add(category)
    await db.flush()

    # path/depth are derived, never supplied — recompute from the tree itself.
    await db.execute(text("select public.rebuild_category_paths()"))
    await db.refresh(category)

    await audit.record(
        db, actor_id=admin.id, action="category.create", entity_type="category",
        entity_id=category.id, summary=f"Created category “{category.name}”",
        ip_address=client_ip(request),
    )
    return _cat_row(category)


@router.patch("/categories/{category_id}")
async def update_category(
    category_id: uuid.UUID,
    payload: Annotated[CategoryPatch, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    moved = False

    if "parent_id" in data:
        new_parent = data["parent_id"]
        if new_parent == category_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A category cannot be its own parent")
        if new_parent is not None and await db.get(Category, new_parent) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown parent category")
        moved = new_parent != category.parent_id
        category.parent_id = new_parent

    if "slug" in data and data["slug"]:
        category.slug = await _unique_slug(db, Category, slugify(data["slug"]), exclude=category_id)
        moved = True  # the slug is part of every descendant's path
    if "name" in data and data["name"]:
        category.name = data["name"].strip()
    for field in ("description", "icon", "display_order", "is_active", "show_on_homepage"):
        if field in data:
            setattr(category, field, data[field])

    try:
        await db.flush()
    except Exception as exc:
        # The cycle trigger raises here. Surface ITS message, not the whole
        # SQLAlchemy/asyncpg wrapper — a raw driver exception in an API
        # response leaks the schema and the ORM in use.
        await db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, _clean_db_error(exc)
        )

    if moved:
        # One transaction, one statement — a partial rewrite would leave URLs
        # pointing at categories that no longer resolve.
        await db.execute(text("select public.rebuild_category_paths()"))
        await db.refresh(category)

    await audit.record(
        db, actor_id=admin.id, action="category.update", entity_type="category",
        entity_id=category.id, summary=f"Updated category “{category.name}”",
        meta={"reparented": moved}, ip_address=client_ip(request),
    )
    return _cat_row(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_category(
    category_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    """Refuses while anything still depends on it.

    Deleting would orphan products or silently promote children to the root.
    Better to say what is in the way than to do something surprising.
    """
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    products = (
        await db.execute(
            select(func.count()).select_from(Product).where(Product.category_id == category_id)
        )
    ).scalar_one()
    children = (
        await db.execute(
            select(func.count()).select_from(Category).where(Category.parent_id == category_id)
        )
    ).scalar_one()

    if products or children:
        blockers = []
        if products:
            blockers.append(f"{products} product{'s' if products != 1 else ''}")
        if children:
            blockers.append(f"{children} sub-categor{'ies' if children != 1 else 'y'}")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Still in use by {' and '.join(blockers)}. Move them first, or deactivate this category instead.",
        )

    name = category.name
    await db.delete(category)
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="category.delete", entity_type="category",
        entity_id=category_id, summary=f"Deleted category “{name}”", ip_address=client_ip(request),
    )


# ====================================================================== #
# Brands                                                                  #
# ====================================================================== #


class BrandIn(Strict):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    website: str | None = Field(default=None, max_length=500)
    logo_url: str | None = Field(default=None, max_length=500)
    is_pinned: bool = False
    is_active: bool = True
    display_order: int = 0


class BrandPatch(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = None
    description: str | None = None
    website: str | None = None
    logo_url: str | None = None
    is_pinned: bool | None = None
    is_active: bool | None = None
    display_order: int | None = None


def _brand_row(b: Brand, n: int = 0) -> dict:
    return {
        "id": str(b.id), "name": b.name, "slug": b.slug,
        "description": b.description, "website": b.website, "logoUrl": b.logo_url,
        "isPinned": b.is_pinned, "isActive": b.is_active,
        "displayOrder": b.display_order, "productCount": n,
    }


@router.get("/brands")
async def list_brands_admin(admin: CurrentAdmin, db: DbSession) -> dict:
    rows = list(
        (await db.execute(select(Brand).order_by(Brand.display_order, Brand.name))).scalars().all()
    )
    counts = {
        bid: n
        for bid, n in (
            await db.execute(
                select(Product.brand_id, func.count(Product.id)).group_by(Product.brand_id)
            )
        ).all()
    }
    return {"items": [_brand_row(b, counts.get(b.id, 0)) for b in rows]}


@router.post("/brands", status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: Annotated[BrandIn, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    brand = Brand(
        name=payload.name.strip(),
        slug=await _unique_slug(db, Brand, slugify(payload.slug or payload.name)),
        description=payload.description,
        website=payload.website,
        logo_url=payload.logo_url,
        is_pinned=payload.is_pinned,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(brand)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="brand.create", entity_type="brand",
        entity_id=brand.id, summary=f"Created brand “{brand.name}”", ip_address=client_ip(request),
    )
    return _brand_row(brand)


@router.patch("/brands/{brand_id}")
async def update_brand(
    brand_id: uuid.UUID,
    payload: Annotated[BrandPatch, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand not found")

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if "slug" in data and data["slug"]:
        brand.slug = await _unique_slug(db, Brand, slugify(data["slug"]), exclude=brand_id)
    if "name" in data and data["name"]:
        brand.name = data["name"].strip()
    for f in ("description", "website", "logo_url", "is_pinned", "is_active", "display_order"):
        if f in data:
            setattr(brand, f, data[f])

    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="brand.update", entity_type="brand",
        entity_id=brand.id, summary=f"Updated brand “{brand.name}”", ip_address=client_ip(request),
    )
    return _brand_row(brand)


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_brand(
    brand_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand not found")

    n = (
        await db.execute(
            select(func.count()).select_from(Product).where(Product.brand_id == brand_id)
        )
    ).scalar_one()
    if n:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{n} product{'s' if n != 1 else ''} still use this brand. Reassign them, or deactivate it instead.",
        )

    name = brand.name
    await db.delete(brand)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="brand.delete", entity_type="brand",
        entity_id=brand_id, summary=f"Deleted brand “{name}”", ip_address=client_ip(request),
    )


# ====================================================================== #
# Badges                                                                  #
# ====================================================================== #

BADGE_STYLES = ("editorial", "brand", "value", "warn", "neutral")


class BadgeIn(Strict):
    name: str = Field(min_length=1, max_length=80)
    slug: str | None = None
    # A design-system token, not a colour — that is what stops a new badge
    # introducing an off-palette hue (spec §21).
    style: str = "neutral"
    icon: str | None = Field(default=None, max_length=60)
    description: str | None = None
    is_active: bool = True
    display_order: int = 0


class BadgePatch(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    slug: str | None = None
    style: str | None = None
    icon: str | None = None
    description: str | None = None
    is_active: bool | None = None
    display_order: int | None = None


def _badge_row(b: Badge) -> dict:
    return {
        "id": str(b.id), "name": b.name, "slug": b.slug, "style": b.style,
        "icon": b.icon, "description": b.description,
        "isActive": b.is_active, "displayOrder": b.display_order,
    }


@router.get("/badges")
async def list_badges_admin(admin: CurrentAdmin, db: DbSession) -> dict:
    rows = (
        await db.execute(select(Badge).order_by(Badge.display_order, Badge.name))
    ).scalars().all()
    return {"items": [_badge_row(b) for b in rows], "styles": list(BADGE_STYLES)}


@router.post("/badges", status_code=status.HTTP_201_CREATED)
async def create_badge(
    payload: Annotated[BadgeIn, Body()], admin: CurrentAdmin, db: DbSession, request: Request
) -> dict:
    if payload.style not in BADGE_STYLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Style must be one of: {', '.join(BADGE_STYLES)}"
        )
    badge = Badge(
        name=payload.name.strip(),
        slug=await _unique_slug(db, Badge, slugify(payload.slug or payload.name)),
        style=payload.style,
        icon=payload.icon,
        description=payload.description,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(badge)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="badge.create", entity_type="badge",
        entity_id=badge.id, summary=f"Created badge “{badge.name}”", ip_address=client_ip(request),
    )
    return _badge_row(badge)


@router.patch("/badges/{badge_id}")
async def update_badge(
    badge_id: uuid.UUID,
    payload: Annotated[BadgePatch, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    badge = await db.get(Badge, badge_id)
    if badge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Badge not found")

    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if "style" in data and data["style"] not in BADGE_STYLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Style must be one of: {', '.join(BADGE_STYLES)}"
        )
    if "slug" in data and data["slug"]:
        badge.slug = await _unique_slug(db, Badge, slugify(data["slug"]), exclude=badge_id)
    if "name" in data and data["name"]:
        badge.name = data["name"].strip()
    for f in ("style", "icon", "description", "is_active", "display_order"):
        if f in data:
            setattr(badge, f, data[f])

    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="badge.update", entity_type="badge",
        entity_id=badge.id, summary=f"Updated badge “{badge.name}”", ip_address=client_ip(request),
    )
    return _badge_row(badge)


@router.delete("/badges/{badge_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_badge(
    badge_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    badge = await db.get(Badge, badge_id)
    if badge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Badge not found")
    name = badge.name
    # product_badges cascades — detaching a badge from products is the
    # expected consequence of deleting it, not a surprise.
    await db.delete(badge)
    await db.flush()
    await audit.record(
        db, actor_id=admin.id, action="badge.delete", entity_type="badge",
        entity_id=badge_id, summary=f"Deleted badge “{name}”", ip_address=client_ip(request),
    )


# ====================================================================== #
# Product video links                                                     #
# ====================================================================== #


class VideoLinkIn(Strict):
    url: str = Field(min_length=8, max_length=1000)
    title: str | None = Field(default=None, max_length=200)


@router.post("/products/{product_id}/videos", status_code=status.HTTP_201_CREATED)
async def add_video_link(
    product_id: uuid.UUID,
    payload: Annotated[VideoLinkIn, Body()],
    admin: CurrentAdmin,
    db: DbSession,
    request: Request,
) -> dict:
    """Attach a YouTube or Vimeo link (spec §19).

    A link rather than an upload: no storage bill, no transcode, and the
    provider already supplies a poster frame. The URL is parsed into a
    validated `(provider, id)` pair — the embed address is rebuilt from those,
    so nothing user-supplied is ever reflected into an iframe.
    """
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    try:
        link = parse_video(payload.url)
    except InvalidVideoLink as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    existing = (
        await db.execute(
            select(ProductMedia).where(
                ProductMedia.product_id == product_id,
                ProductMedia.kind == "video_link",
                ProductMedia.external_id == link.external_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "That video is already attached.")

    order = (
        await db.execute(
            select(func.coalesce(func.max(ProductMedia.display_order), -1) + 1).where(
                ProductMedia.product_id == product_id
            )
        )
    ).scalar_one()

    media = ProductMedia(
        product_id=product_id,
        kind="video_link",
        storage_path=None,
        source_url=link.source_url,
        provider=link.provider,
        external_id=link.external_id,
        title=(payload.title or "").strip()[:200] or None,
        display_order=order,
    )
    db.add(media)
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="product.video.add", entity_type="product",
        entity_id=product_id, summary=f"Added {link.provider} video to “{product.title}”",
        meta={"provider": link.provider, "externalId": link.external_id},
        ip_address=client_ip(request),
    )

    return {
        "id": str(media.id),
        "kind": "video_link",
        "url": link.source_url,
        "embedUrl": link.embed_url,
        "thumbnailUrl": link.thumbnail_url,
        "provider": link.provider,
        "title": media.title,
        "displayOrder": media.display_order,
    }


@router.delete(
    "/products/videos/{media_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def remove_video_link(
    media_id: uuid.UUID, admin: CurrentAdmin, db: DbSession, request: Request
) -> None:
    media = await db.get(ProductMedia, media_id)
    if media is None or media.kind != "video_link":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")

    product_id = media.product_id
    await db.execute(delete(ProductMedia).where(ProductMedia.id == media_id))
    await db.flush()

    await audit.record(
        db, actor_id=admin.id, action="product.video.remove", entity_type="product",
        entity_id=product_id, summary="Removed a product video", ip_address=client_ip(request),
    )
