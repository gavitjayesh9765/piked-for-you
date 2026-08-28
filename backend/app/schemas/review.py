"""Review wire types (spec §28–§31)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import Field

from app.schemas.product import MediaOut, Wire

ReviewStatus = Literal["pending", "approved", "rejected", "hidden", "reported"]


class ReviewAuthorOut(Wire):
    """Only what is needed to attribute a review. Email is never exposed."""

    id: uuid.UUID
    display_name: str
    avatar_url: Optional[str] = None


class ReviewOut(Wire):
    id: uuid.UUID
    product_id: uuid.UUID
    author: ReviewAuthorOut
    # 1–5, the community scale. Distinct from the 0–10 SortedChoice Score (spec §32).
    rating: int
    title: Optional[str] = None
    body: str
    media: list[MediaOut] = Field(default_factory=list)
    status: ReviewStatus
    is_featured: bool = False
    helpful_count: int = 0
    created_at: datetime

    # Note: there is no `is_verified_buyer` field. We have no purchase
    # verification mechanism, so the contract offers no way to claim one
    # (spec §31). The UI labels these "User Review".
