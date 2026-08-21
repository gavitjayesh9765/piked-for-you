"""Category and brand wire types."""

from __future__ import annotations

import uuid
from typing import Optional

from pydantic import Field

from app.schemas.product import StrictWire, Wire


class CategoryOut(Wire):
    id: uuid.UUID
    name: str
    slug: str
    path: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    display_order: int = 0
    is_active: bool = True
    show_on_homepage: bool = False
    product_count: Optional[int] = None


class CategoryTreeOut(CategoryOut):
    children: list["CategoryTreeOut"] = Field(default_factory=list)


class BrandOut(Wire):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    is_pinned: bool = False
    display_order: int = 0
    product_count: Optional[int] = None


class CategoryCreate(StrictWire):
    name: str = Field(min_length=1, max_length=120)
    slug: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    show_on_homepage: bool = False


class BrandCreate(StrictWire):
    name: str = Field(min_length=1, max_length=120)
    slug: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    is_pinned: bool = False


CategoryTreeOut.model_rebuild()
