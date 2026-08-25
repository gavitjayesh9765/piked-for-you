"""
SQLAlchemy models — the source of truth for the schema (spec §40, §41).

Design rules enforced here:
  * Core entities are normalised relational tables. JSONB is used only where the
    data is genuinely variable per category (specifications, scoring criteria),
    never as a dumping ground for the whole record (spec §41).
  * Every table carries created_at / updated_at.
  * Media lives in Supabase Storage; these rows hold metadata and an object
    key only (spec §45).

NOTE: supabase/migrations/ is now the source of truth for the schema. These
models mirror it for querying — they are no longer used to generate DDL.
Credentials live in Supabase `auth.users` and never appear here.
"""

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.profile import Profile
from app.models.taxonomy import Badge, Brand, Category
from app.models.product import (
    Product,
    ProductAlternative,
    ProductBadge,
    ProductMedia,
    ProductRetailer,
    ProductScore,
    Retailer,
)
from app.models.pricing import (
    PriceHistory,
    PriceScrapeJob,
    PriceScrapeResult,
    PricingSettings,
)
from app.models.review import Review, ReviewMedia, ReviewReport
from app.models.content import ActivityLog, HomepageSection, TopPick
from app.models.newsletter import NewsletterSubscriber
from app.models.contact import ContactMessage
from app.models.personalisation import ReviewHelpfulVote, SavedProduct, UserPreferences

__all__ = [
    "Base",
    "TimestampMixin",
    "UUIDMixin",
    "Profile",
    "Category",
    "Brand",
    "Badge",
    "Product",
    "ProductAlternative",
    "ProductMedia",
    "ProductScore",
    "ProductBadge",
    "Retailer",
    "ProductRetailer",
    "PriceHistory",
    "PriceScrapeJob",
    "PriceScrapeResult",
    "PricingSettings",
    "Review",
    "ReviewMedia",
    "ReviewReport",
    "TopPick",
    "HomepageSection",
    "ActivityLog",
    "NewsletterSubscriber",
    "ContactMessage",
    "SavedProduct",
    "UserPreferences",
    "ReviewHelpfulVote",
]
