"""
Pydantic schemas for products. These are the wire contract — frontend
src/lib/types.ts mirrors them exactly.

`alias_generator=to_camel` means Python stays snake_case and JSON is camelCase,
so neither side has to translate.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel
from typing import Annotated as _Annotated

# Pydantic serialises Decimal as a JSON *string* by default, so `9.4` would
# reach the browser as "9.4" and any arithmetic on it silently breaks.
# TypeScript declares these as `number`, so the wire format must match.
#
# Decimal is still used in Python and NUMERIC in Postgres — the conversion
# happens only at the JSON boundary, where the value is being displayed and a
# double is what JavaScript will produce anyway.
Money = _Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]

ProductStatus = Literal["draft", "published", "archived"]
BadgeStyle = Literal["editorial", "brand", "value", "warn", "neutral"]


class Wire(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )


class StrictWire(Wire):
    """Base for every **write** schema.

    `extra="forbid"` is the mass-assignment defence: an unknown field is
    rejected with a 422 rather than silently dropped. So a crafted payload
    carrying `role`, `status`, `is_admin`, `rating_average` — anything not
    declared on the model — fails loudly instead of riding along unnoticed.

    Read schemas keep the permissive default; forbidding extras on responses
    would buy nothing and break forward compatibility.
    """

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


# --------------------------------------------------------------------- #
# Nested refs                                                            #
# --------------------------------------------------------------------- #


class BrandRef(Wire):
    id: uuid.UUID
    name: str
    slug: str


class CategoryRef(Wire):
    id: uuid.UUID
    name: str
    slug: str
    path: list[str] = Field(default_factory=list)


class BadgeOut(Wire):
    id: uuid.UUID
    name: str
    slug: str
    icon: Optional[str] = None
    style: BadgeStyle = "neutral"
    is_active: bool = True


class MediaOut(Wire):
    id: uuid.UUID
    # "video_link" is an embed (YouTube/Vimeo); "video" is an uploaded file.
    kind: Literal["image", "video", "video_link"]
    # For an image or upload: a signed URL. For a link: the watch page.
    url: str
    # Set only for video_link — the player src, rebuilt server-side from the
    # stored provider + id so nothing user-supplied reaches an iframe.
    embed_url: Optional[str] = None
    provider: Optional[str] = None
    title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[int] = None
    display_order: int = 0


class PricingOut(Wire):
    currency: str = "INR"
    current: Optional[Money] = None
    min: Optional[Money] = None
    max: Optional[Money] = None
    updated_at: Optional[datetime] = None


class ScoreCriterionOut(Wire):
    key: str
    label: str
    value: float
    weight: Optional[float] = None


class ScoreOut(Wire):
    overall: Money
    criteria: list[ScoreCriterionOut] = Field(default_factory=list)
    updated_at: Optional[datetime] = None


class ScoreSummaryOut(Wire):
    """Just the number — what a product card needs."""

    overall: Money


class CommunityRatingOut(Wire):
    """Kept structurally distinct from ScoreOut so the two can never be
    accidentally interchanged in a response (spec §32)."""

    average: Money
    count: int


class RetailerLinkOut(Wire):
    id: uuid.UUID
    retailer: str
    retailer_slug: str
    url: str
    display_price: Optional[Money] = None
    is_active: bool = True
    last_updated_at: Optional[datetime] = None

    # --- Scrape state ---
    # `in_stock` is deliberately three-valued. None means the retailer's page
    # did not say, which is not the same as available — claiming availability
    # we never observed would send a reader to a dead listing.
    in_stock: Optional[bool] = None
    scrape_enabled: bool = True
    last_scrape_status: Optional[str] = None
    last_scrape_error: Optional[str] = None
    last_scraped_at: Optional[datetime] = None


class SpecGroupOut(Wire):
    label: str
    items: list[dict[str, str]]


class SeoOut(Wire):
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    og_image_url: Optional[str] = None
    canonical_url: Optional[str] = None


# --------------------------------------------------------------------- #
# Read models                                                            #
# --------------------------------------------------------------------- #


class ProductSummaryOut(Wire):
    """List payload. Deliberately lean — category pages return dozens of these
    and the full product would multiply response size for no benefit (spec §48)."""

    id: uuid.UUID
    title: str
    slug: str
    brand: BrandRef
    category: CategoryRef
    tagline: str
    primary_image: Optional[MediaOut] = None
    score: Optional[ScoreSummaryOut] = None
    badges: list[BadgeOut] = Field(default_factory=list)
    pricing: PricingOut
    community_rating: Optional[CommunityRatingOut] = None
    status: ProductStatus


class ProductOut(ProductSummaryOut):
    description: Optional[str] = None
    short_description: Optional[str] = None
    images: list[MediaOut] = Field(default_factory=list)
    videos: list[MediaOut] = Field(default_factory=list)
    score: Optional[ScoreOut] = None  # type: ignore[assignment]
    verdict: Optional[str] = None
    best_for: list[str] = Field(default_factory=list)
    not_ideal_for: list[str] = Field(default_factory=list)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    specifications: list[SpecGroupOut] = Field(default_factory=list)
    retailers: list[RetailerLinkOut] = Field(default_factory=list)
    seo: Optional[SeoOut] = None
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------- #
# Write models (admin)                                                   #
# --------------------------------------------------------------------- #


class ProductCreate(StrictWire):
    title: str = Field(min_length=1, max_length=250)
    slug: Optional[str] = Field(default=None, max_length=280)
    brand_id: uuid.UUID
    category_id: uuid.UUID
    tagline: str = Field(default="", max_length=300)
    short_description: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = None

    currency: str = "INR"
    price_current: Optional[Decimal] = Field(default=None, ge=0)
    price_min: Optional[Decimal] = Field(default=None, ge=0)
    price_max: Optional[Decimal] = Field(default=None, ge=0)

    verdict: Optional[str] = None
    best_for: list[str] = Field(default_factory=list)
    not_ideal_for: list[str] = Field(default_factory=list)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    specifications: list[dict[str, Any]] = Field(default_factory=list)

    badge_ids: list[uuid.UUID] = Field(default_factory=list)

    meta_title: Optional[str] = Field(default=None, max_length=200)
    meta_description: Optional[str] = Field(default=None, max_length=400)

    # Never settable on create — publishing is an explicit, audited action so
    # that "save" can't accidentally push a half-written product live (spec §38).
    status: Literal["draft"] = "draft"


class ProductUpdate(StrictWire):
    """All fields optional — PATCH semantics."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=250)
    slug: Optional[str] = None
    brand_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    tagline: Optional[str] = Field(default=None, max_length=300)
    short_description: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    price_current: Optional[Decimal] = Field(default=None, ge=0)
    price_min: Optional[Decimal] = Field(default=None, ge=0)
    price_max: Optional[Decimal] = Field(default=None, ge=0)
    verdict: Optional[str] = None
    best_for: Optional[list[str]] = None
    not_ideal_for: Optional[list[str]] = None
    pros: Optional[list[str]] = None
    cons: Optional[list[str]] = None
    specifications: Optional[list[dict[str, Any]]] = None
    badge_ids: Optional[list[uuid.UUID]] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class ScoreUpsert(StrictWire):
    overall: Money = Field(ge=0, le=10)
    criteria: list[ScoreCriterionOut] = Field(default_factory=list)


class MediaReorder(StrictWire):
    """Drag-and-drop ordering (spec §19). Position 0 becomes the primary image."""

    media_ids: list[uuid.UUID]
