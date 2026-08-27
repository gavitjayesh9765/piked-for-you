"""
API v1 surface (spec §42).

Two clear halves:
  PUBLIC  — no auth (or optional auth). Returns published/active content only.
            The published filter is applied in the repository layer, so there is
            no way to reach a draft product through a public route.
  ADMIN   — mounted under /admin, every route gated by a role dependency.
"""

from fastapi import APIRouter, Depends

from app.core.deps import get_current_admin

# --- Public modules ---
from app.modules.auth.router import router as auth_router
from app.modules.products.router import router as products_router
from app.modules.categories.router import router as categories_router
from app.modules.brands.router import router as brands_router
from app.modules.badges.router import router as badges_router
from app.modules.reviews.router import router as reviews_router
from app.modules.search.router import router as search_router
from app.modules.homepage.router import router as homepage_router
from app.modules.media.router import router as media_router
from app.modules.newsletter.router import router as newsletter_router
from app.modules.contact.router import router as contact_router
from app.modules.personalisation.router import router as me_router
from app.modules.analytics.router import router as track_router

# --- Admin modules ---
from app.modules.admin.router import router as admin_router
from app.modules.admin.media import router as admin_media_router
from app.modules.admin.retailers import router as admin_retailers_router
from app.modules.admin.alternatives import router as admin_alternatives_router
from app.modules.admin.taxonomy import router as admin_taxonomy_router
from app.modules.admin.curation import router as admin_curation_router
from app.modules.admin.pricing import router as admin_pricing_router
from app.modules.admin.pricing import product_router as admin_pricing_product_router
from app.modules.admin.analytics import router as admin_analytics_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(products_router, prefix="/products", tags=["products"])
api_router.include_router(categories_router, prefix="/categories", tags=["categories"])
api_router.include_router(brands_router, prefix="/brands", tags=["brands"])
api_router.include_router(badges_router, prefix="/badges", tags=["badges"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["reviews"])
api_router.include_router(search_router, prefix="/search", tags=["search"])
api_router.include_router(homepage_router, prefix="/homepage", tags=["homepage"])
api_router.include_router(media_router, prefix="/media", tags=["media"])
api_router.include_router(newsletter_router, prefix="/newsletter", tags=["newsletter"])
api_router.include_router(contact_router, prefix="/contact", tags=["contact"])

# The tracking beacon. Public and unauthenticated by necessity — it is called
# by every reader's browser, most of whom are not signed in — and it answers
# 204 to everything, so being public gives an attacker a counter to inflate
# and nothing to read. See modules/analytics/router.py.
api_router.include_router(track_router, prefix="/track", tags=["analytics"])

# Personalisation. Every route scopes to the caller's own id from the verified
# token — no user id appears in any path or body, so the IDOR shape does not
# exist here.
api_router.include_router(me_router, prefix="/me", tags=["me"])

# Single admin gate. get_current_admin verifies the signed JWT, requires
# app_metadata.role == "admin", AND requires MFA to have been completed
# (aal2). Applied at mount, so a new admin route cannot forget it.
for _r in (
    admin_router,
    admin_media_router,
    admin_retailers_router,
    admin_alternatives_router,
    admin_taxonomy_router,
    admin_curation_router,
    # Price scraping. Nothing in here is scheduled — a run exists because
    # an admin created one (see app/services/scraper/).
    admin_pricing_router,
    admin_pricing_product_router,
    # Read-only. There is no admin route anywhere that can write a counter.
    admin_analytics_router,
):
    api_router.include_router(
        _r,
        prefix="/admin",
        tags=["admin"],
        dependencies=[Depends(get_current_admin)],
    )
