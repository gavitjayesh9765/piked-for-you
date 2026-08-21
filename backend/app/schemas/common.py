"""Shared wire types."""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

T = TypeVar("T")

SortOption = Literal[
    "relevance", "score_desc", "price_asc", "price_desc", "rating_desc", "newest"
]

# The admin catalogue sorts on things the public list has no business
# exposing — draft creation order, when a price was last checked. Kept as a
# separate alphabet rather than widened into SortOption, so a public caller
# passing "price_checked_asc" gets a 422 instead of a working query.
AdminSortOption = Literal[
    "newest",           # created_at desc — latest products first (the default)
    "oldest",           # created_at asc
    "updated_desc",     # most recently edited
    "updated_asc",
    "published_desc",   # most recently made public
    "title_asc",
    "title_desc",
    "price_desc",
    "price_asc",
    "score_desc",
    "price_checked_asc",   # most stale price first — the scraper's worklist
    "price_checked_desc",
]


class Page(BaseModel, Generic[T]):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool


class PageParams(BaseModel):
    """Pagination is mandatory on every list endpoint — the spec is explicit
    that the homepage must not load every product (spec §48)."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class FacetOption(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    value: str
    label: str
    count: int


class Facet(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    key: str
    label: str
    options: list[FacetOption]


class Message(BaseModel):
    detail: str
