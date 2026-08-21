"""Homepage section wire types (spec §39)."""

from __future__ import annotations

import uuid
from typing import Any, Literal, Optional

from pydantic import Field

from app.schemas.product import ProductSummaryOut, Wire
from app.schemas.taxonomy import BrandOut, CategoryOut

HomepageSectionKind = Literal[
    "hero",
    "category_tiles",
    "top_picks",
    "featured_products",
    "category_rail",
    "featured_brands",
    "newsletter",
    "editorial",
]


class HomepageSectionOut(Wire):
    """One composed section.

    Contents are resolved server-side and embedded, so the frontend renders the
    whole homepage from a single request rather than fanning out one call per
    rail (spec §48).
    """

    id: uuid.UUID
    kind: HomepageSectionKind
    title: Optional[str] = None
    subtitle: Optional[str] = None
    display_order: int = 0
    is_active: bool = True

    products: Optional[list[ProductSummaryOut]] = None
    categories: Optional[list[CategoryOut]] = None
    brands: Optional[list[BrandOut]] = None

    # Renderer parameters — which category to pull, how many items, and so on.
    data: dict[str, Any] = Field(default_factory=dict)
