# SortedChoice — Product Vision, Architecture & Specification

> **Document Type:** Master Product & Technical Specification  
> **Status:** Initial MVP Specification  
> **Project:** SortedChoice  
> **Primary Domain:** sortedchoice.com  
> **Secondary Domain:** sortedchoice.in (optional/protective)  
> **Purpose:** Single source of truth for product design and implementation

---

# 1. Brand & Product Identity

## 1.1 Product Name

**SortedChoice**

The product name communicates the core promise:

> **We research products so users can choose with confidence.**

The exact visual brand system, logo, typography, colors, and final naming treatment can evolve later. The product architecture must not depend on a particular logo treatment.

## 1.2 What SortedChoice Is

SortedChoice is a **product research, comparison, recommendation, and discovery platform**.

It is intentionally **not another Amazon or Flipkart marketplace**.

The platform does not need to maintain its own inventory or process the actual product purchase.

Instead:

1. SortedChoice discovers and organizes products.
2. The SortedChoice team researches and evaluates products.
3. Products are compared using structured information.
4. SortedChoice gives users clear recommendations and verdicts.
5. Users can read community reviews.
6. Users can upload review images and short videos.
7. When a user decides to buy, SortedChoice sends them to an external retailer such as Amazon or Flipkart.

### Core concept

> **Don't spend hours researching. SortedChoice does the research.**

---

# 2. Problem Statement

Online shopping creates a research problem.

A user may have to:

- Search Amazon.
- Search Flipkart.
- Read dozens or hundreds of reviews.
- Watch YouTube reviews.
- Compare specifications.
- Check prices.
- Compare different variants.
- Search Reddit/community discussions.
- Determine whether marketing claims are actually useful.
- Decide which product is best for their specific use case.

This process is time-consuming and often confusing.

Marketplaces are optimized primarily for **selling and listing products**, not for giving users a concise, trustworthy purchasing decision.

SortedChoice solves the decision problem.

---

# 3. Solution

SortedChoice creates a curated layer between product discovery and purchase.

### Traditional flow

```text
User
  ↓
Amazon / Flipkart
  ↓
Hundreds of products
  ↓
Search / filters / reviews
  ↓
External research
  ↓
Comparison
  ↓
Decision
  ↓
Purchase
```

### SortedChoice flow

```text
User
  ↓
SortedChoice
  ↓
Search / browse / categories
  ↓
Curated shortlist
  ↓
Research + comparison
  ↓
PickD Verdict
  ↓
Community reviews
  ↓
User makes decision
  ↓
Amazon / Flipkart
  ↓
Purchase
```

The platform's value is the **research and decision layer**.

---

# 4. Product Philosophy

SortedChoice should follow these principles:

## 4.1 Recommendation over catalog size

The goal is not to list every available product.

The goal is to list products that are actually worth considering.

## 4.2 Decision over information overload

Do not overwhelm users with specifications without context.

Explain:

- Why it is good.
- Who should buy it.
- Who should avoid it.
- What alternatives exist.
- Whether the price is reasonable.

## 4.3 Research first

Every major recommendation should have an underlying research process.

## 4.4 Transparency

Clearly distinguish:

- SortedChoice's own verdict.
- Community/user reviews.
- Marketplace ratings.
- Price information.

## 4.5 User choice

SortedChoice recommends; the user decides.

The platform must not misleadingly imply that it sells or directly fulfills products.

---

# 5. Target Users

## 5.1 Main consumer

People who:

- Want to buy electronics or other products.
- Do not want to spend hours researching.
- Want a shortlist instead of hundreds of choices.
- Want simple comparisons.
- Want real user experiences.
- Want to know whether a product is actually worth buying.

## 5.2 Research-oriented buyer

Users who already know the product category but need help choosing between several products.

Example:

> "Best headphones under ₹3,000 for bass and gaming."

## 5.3 Casual buyer

Users who simply want:

> "What should I buy?"

The platform should support both detailed research and quick decisions.

---

# 6. Initial Product Categories

The architecture must be category-independent.

Initial categories may include:

- Electronics
- Audio
- Headphones
- TWS
- Speakers
- Computers
- Monitors
- Keyboards
- Mouse
- Gaming
- Gaming Headsets
- Controllers
- Mobiles
- Accessories
- Other categories added through the admin panel

Categories must NOT be hard-coded into the frontend.

Admins create and manage categories dynamically.

---

# 7. Business Model

SortedChoice is designed to eventually monetize through external retailer referrals/affiliate relationships.

Example:

```text
User
 ↓
SortedChoice product page
 ↓
"View on Amazon"
 ↓
Amazon
 ↓
Purchase
 ↓
Affiliate attribution/commission where applicable
```

Another possible flow:

```text
SortedChoice
 ↓
"View on Flipkart"
 ↓
Flipkart
 ↓
Purchase
```

SortedChoice does not need to process payments in the MVP.

No shopping cart or checkout is required for the initial product.

---

# 8. Overall System Architecture

```text
                         SORTEDCHOICE
                              │
              ┌───────────────┴───────────────┐
              │                               │
        PUBLIC PLATFORM                  ADMIN PLATFORM
              │                               │
     ┌────────┼────────┐              ┌───────┼────────┐
     │        │        │              │       │        │
   Search   Browse   Reviews       Products Categories Brands
     │        │        │              │       │        │
     └────────┼────────┘              ├───────┼────────┤
              │                      Badges Top Picks Homepage
              │                               │
              └───────────────┬───────────────┘
                              │
                         BACKEND API
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Database        Media Storage    Authentication
             │                │                │
             └────────────────┼────────────────┘
                              │
                    External Retailers
                         /           \
                    Amazon          Flipkart
```

---

# 9. Recommended Application Structure

The project should be separated into logical applications/modules.

```text
SortedChoice/
│
├── frontend/
│   ├── public website
│   └── user-facing pages
│
├── admin/
│   └── administration dashboard
│
├── backend/
│   ├── authentication
│   ├── products
│   ├── categories
│   ├── brands
│   ├── badges
│   ├── reviews
│   ├── media
│   ├── search
│   ├── homepage
│   └── retailer links
│
├── database/
│   ├── migrations
│   └── schema
│
└── docs/
    └── product and technical documentation
```

The exact framework can be chosen during implementation, but the architecture must preserve clear separation of concerns.

---

# 10. User Roles

## 10.1 Guest

Can:

- Browse products.
- Browse categories.
- Search.
- View product details.
- View PickD verdicts.
- View public reviews.
- View product media.
- Follow external retailer links.

Cannot:

- Create reviews.
- Upload review media.
- Manage content.

## 10.2 Authenticated User

Can do everything a guest can do plus:

- Submit product reviews.
- Give ratings.
- Upload review images.
- Upload short review videos.
- Edit their own reviews.
- Delete their own reviews.
- View their review history.

## 10.3 Admin

Can:

- Manage products.
- Manage product media.
- Manage categories.
- Manage brands.
- Manage badges.
- Manage top picks.
- Manage homepage sections.
- Moderate reviews.
- Moderate user media.
- Manage retailer links.
- Manage product publication state.
- View platform activity.

Future versions may support multiple admin roles.

---

# 11. Public Website Pages

## 11.1 Home Page

The homepage is the primary discovery experience.

### Required sections

1. Main navbar.
2. Search.
3. Sub-navigation/category navigation.
4. Hero section.
5. Top Picks.
6. Featured/Recommended products.
7. Category-wise product sections.
8. Featured brands.
9. Explore all categories.
10. Footer.

### Homepage flow

```text
Navbar
 ↓
Search
 ↓
Hero
 ↓
Top Picks
 ↓
Featured Products
 ↓
Category 1 products
 ↓
Category 2 products
 ↓
Category 3 products
 ↓
Featured Brands
 ↓
Explore Categories
 ↓
Footer
```

---

# 12. Navbar

The navbar should include:

- SortedChoice brand/logo.
- Search bar.
- Categories/navigation.
- Top Picks or recommendations.
- Authentication entry.
- User account when authenticated.

Search should be highly visible and inspired by the usability of large shopping platforms without copying their design.

---

# 13. Sub-navigation

The sub-navigation contains important categories.

Example:

```text
Electronics | Computers | Audio | Gaming | Mobiles | Accessories
```

This must be dynamic.

Admin controls:

- Which categories appear.
- Category order.
- Visibility.
- Parent/child relationships.

---

# 14. Hero Section

The hero section should communicate the value proposition rather than behave like a generic shopping-sale banner.

Example positioning:

> **Stop wasting hours researching products.**

Supporting message:

> **We've done the research. You just choose what's right for you.**

Primary CTA:

> **Explore Top Picks**

The exact copy can change during branding/design.

---

# 15. Top Picks

Top Picks are curated by the admin.

Example:

```text
Top Picks

1. Product A
2. Product B
3. Product C
4. Product D
```

Admin controls:

- Product selection.
- Display order.
- Active/inactive state.
- Optional scheduling.
- Optional title/subtitle.

Top Picks should be prominently displayed on the homepage.

---

# 16. Category Product Sections

The homepage should dynamically display product sections by category.

Example:

```text
Electronics
[Product] [Product] [Product] [Product]

Computers
[Product] [Product] [Product] [Product]

Audio
[Product] [Product] [Product] [Product]
```

Only categories with published products should be displayed.

Each section should have:

> View All

which opens the category page.

---

# 17. Category Pages

Category pages provide:

- Category title.
- Description.
- Subcategories.
- Product grid.
- Sorting.
- Filtering.
- Search within category.
- Pagination or infinite scrolling.
- Relevant badges.
- Product score.
- Current price.
- Price range.
- Retailer availability.

Possible filters:

- Price.
- Brand.
- Rating.
- PickD Score.
- Features.
- Use case.
- Badge.
- Availability.

Filters should be configurable depending on category.

---

# 18. Product Detail Page

The product page is one of the most important pages.

### Required structure

```text
Breadcrumbs
 ↓
Product gallery
 ↓
Product title
 ↓
Brand
 ↓
Badges
 ↓
PickD Score
 ↓
Current price
 ↓
Price range
 ↓
Our Verdict
 ↓
Best For
 ↓
Not Ideal For
 ↓
Pros
 ↓
Cons
 ↓
Specifications
 ↓
Product videos
 ↓
Community reviews
 ↓
User media
 ↓
Alternatives
 ↓
Amazon / Flipkart buttons
```

---

# 19. Product Media

Admin can upload:

- Main product image.
- Multiple gallery images.
- Product videos.

## Image ordering

Images must support drag-and-drop ordering.

The first image is the primary image.

Example:

```text
[Image 1] [Image 2] [Image 3] [Image 4]
    ↑
Primary image
```

## Video

Admin can upload product videos according to configured media limits.

Media should be stored outside the relational database.

The database stores metadata and URLs/references.

---

# 20. Product Information

Each product should support:

### Basic fields

- Product ID.
- Title.
- Slug.
- Brand.
- Category.
- Description.
- Short description.
- Status.
- Created date.
- Updated date.

### Pricing

- Minimum price.
- Maximum price.
- Current price.
- Currency.
- Price updated timestamp.

Example:

```text
Price range: ₹1,799 – ₹2,499
Current price: ₹1,999
```

The system should be designed so prices can be updated later without recreating the product.

---

# 21. Product Badges

Badges are reusable content entities.

Examples:

- Top Recommendation
- Best Seller
- Worth It
- Best Value
- Best for Gaming
- Premium Pick
- New
- Editor's Choice

Admin can:

- Create badge.
- Edit badge.
- Delete/deactivate badge.
- Set badge name.
- Set icon.
- Set visual style.
- Attach badge to products.

A product can have multiple badges.

Example:

```text
Product X

🏆 Top Recommendation
💰 Best Value
```

Badges must NOT be hard-coded.

---

# 22. Brand Management

Admin can manage:

- Brand name.
- Brand slug.
- Logo.
- Description.
- Website.
- Status.
- Display order.
- Featured/pinned status.

## Pinned Brands

Admins can pin brands for homepage display.

Example:

```text
Featured Brands

Sony
Samsung
Logitech
Nothing
```

Pinned status should be controlled from admin.

---

# 23. Category Management

Admin can:

- Create categories.
- Edit categories.
- Delete/deactivate categories.
- Reorder categories.
- Upload category image.
- Set category icon.
- Set parent category.
- Configure visibility.
- Set homepage visibility.

Categories should support hierarchical structures.

Example:

```text
Electronics
 ├── Audio
 │    ├── Headphones
 │    ├── TWS
 │    └── Speakers
 ├── Computers
 │    ├── Monitors
 │    ├── Keyboards
 │    └── Mouse
 └── Gaming
      ├── Headsets
      └── Controllers
```

---

# 24. PickD Score

SortedChoice should not simply copy marketplace star ratings.

It should provide its own evaluation.

Example:

```text
PickD Score: 8.8 / 10

Sound       9.2
Build       8.7
Comfort     8.8
Features    8.1
Value       9.4
```

The scoring model must eventually support category-specific criteria.

For example, headphones may use:

- Sound.
- Bass.
- Comfort.
- Mic.
- Battery.
- Latency.
- Build.
- Value.

Monitors may use:

- Display.
- Color.
- Refresh rate.
- Response time.
- Ports.
- Ergonomics.
- Value.

The scoring system must therefore be configurable rather than permanently hard-coded.

---

# 25. PickD Verdict

Each major product should have a human/admin-authored verdict.

Example:

> **Our Verdict**
>
> This is one of the best options in its price range for users who prioritize sound quality and bass. It is less suitable for users who need active noise cancellation.

Also support:

### Best For

- Music.
- Gaming.
- Students.
- Office work.
- Travel.

### Not Ideal For

- Users requiring ANC.
- Professional studio monitoring.
- Competitive gaming, if applicable.

### Pros

- Strong sound.
- Good battery.
- Comfortable.
- Good value.

### Cons

- Average microphone.
- No ANC.

---

# 26. External Retailer Links

Each product can contain retailer links.

Initial supported retailers:

- Amazon.
- Flipkart.

Example:

```text
[ View on Amazon ]
[ View on Flipkart ]
```

The platform does not process the transaction.

Each retailer link should support:

- URL.
- Retailer name.
- Active/inactive.
- Optional displayed price.
- Tracking/affiliate parameters where applicable.
- Last updated timestamp.

Do not hard-code retailer URLs into frontend components.

---

# 27. User Authentication

Users must authenticate before creating reviews.

### Guest

Can read reviews.

### Authenticated user

Can:

- Review.
- Rate.
- Upload media.

The backend must enforce authentication.

Hiding the review button in the frontend is NOT sufficient.

---

# 28. User Reviews

Each review should support:

- Review ID.
- User ID.
- Product ID.
- Rating.
- Review title.
- Review body.
- Status.
- Created date.
- Updated date.
- Moderation metadata.

Example:

```text
⭐⭐⭐⭐⭐
Great headphones for the price

I've been using these for...
```

---

# 29. Review Media

Authenticated users can attach:

### Images

Multiple images per review.

### Videos

Short videos with:

> **Maximum duration: 30 seconds**

The exact file-size limit must be configurable.

Backend must validate:

- Authentication.
- Ownership.
- File type.
- MIME type.
- File size.
- Video duration.
- Media integrity.

Frontend validation is only a convenience.

---

# 30. Review Moderation

Because users can upload content, moderation is mandatory.

Admin review states:

```text
Pending
Approved
Rejected
Hidden
Reported
```

Admin can:

- Approve review.
- Reject review.
- Hide review.
- Delete review.
- Remove media.
- Review reports.
- Feature useful reviews.

Users can report reviews.

Possible report reasons:

- Spam.
- Fake review.
- Offensive content.
- Irrelevant content.
- Promotional content.
- Inappropriate media.

---

# 31. User Review Trust

Do not display **Verified Buyer** unless there is a legitimate mechanism to verify the purchase.

For the initial platform, use:

> **User Review**

Future versions may support verified-purchase mechanisms if a reliable integration is available.

---

# 32. Community Rating vs PickD Score

These are separate concepts.

## PickD Score

Our evaluation.

Example:

> **8.8/10**

## Community Rating

User rating.

Example:

> **4.6/5 from 128 reviews**

Never merge the two into a misleading single number.

---

# 33. Search

Search is a core feature.

Users can search:

- Product title.
- Brand.
- Category.
- Subcategory.
- Relevant tags.
- Product attributes where supported.

Example:

```text
"best headphones"
"sony"
"gaming mouse"
"monitor under 20000"
```

Search should return relevant published products only.

Admin/draft products must not appear publicly.

---

# 34. Admin Panel

The admin panel is the CMS and operational control center.

## Main navigation

```text
Dashboard

CONTENT
├── Products
├── Categories
├── Brands
├── Badges
├── Top Picks
├── Homepage
└── Media Library

COMMUNITY
├── Reviews
├── Reports
└── User Media

SYSTEM
├── Admin Users
├── Activity Logs
└── Settings
```

---

# 35. Admin Dashboard

Dashboard metrics:

- Total products.
- Published products.
- Draft products.
- Categories.
- Brands.
- Badges.
- Pending reviews.
- Reported reviews.
- Top Picks.
- Recent activity.

Recent activity example:

```text
Product created
Product published
Review approved
Category updated
Brand pinned
Badge attached
```

---

# 36. Product Admin Page

Admin product table:

- Image.
- Product title.
- Brand.
- Category.
- Current price.
- PickD Score.
- Status.
- Badges.
- Updated date.
- Actions.

Actions:

- View.
- Edit.
- Duplicate.
- Publish.
- Unpublish.
- Archive.
- Delete.

---

# 37. Product Creation/Edit Form

Sections:

### Basic

- Title.
- Slug.
- Brand.
- Category.
- Description.
- Short description.

### Pricing

- Minimum.
- Maximum.
- Current.

### Media

- Images.
- Image ordering.
- Videos.

### Recommendation

- PickD Score.
- Scoring criteria.
- Verdict.
- Best For.
- Not Ideal For.
- Pros.
- Cons.

### Badges

- Select multiple badges.

### Retailers

- Amazon URL.
- Flipkart URL.

### SEO

- Meta title.
- Meta description.
- OG image.

### Publication

- Draft.
- Published.
- Archived.

---

# 38. Product Lifecycle

```text
Draft
  ↓
Review
  ↓
Published
  ↓
Updated
  ↓
Archived
```

A draft product must never be publicly visible.

---

# 39. Homepage Management

Admins should eventually be able to control homepage content without code.

Possible configurable sections:

- Hero.
- Top Picks.
- Featured Products.
- Category sections.
- Featured Brands.
- Promotional/research sections.

Each section can have:

- Title.
- Subtitle.
- Content.
- Display order.
- Active/inactive.
- Start/end date if scheduling is implemented.

---

# 40. Data Model — High Level

Core entities:

```text
User
AdminUser
Product
ProductImage
ProductVideo
Category
Brand
Badge
ProductBadge
ProductScore
Retailer
ProductRetailer
Review
ReviewMedia
ReviewReport
TopPick
HomepageSection
```

Relationships:

```text
Brand 1 ─── N Product

Category 1 ─── N Product

Product 1 ─── N ProductImage

Product 1 ─── N ProductVideo

Product N ─── N Badge

Product 1 ─── N Review

User 1 ─── N Review

Review 1 ─── N ReviewMedia

Product 1 ─── N ProductRetailer
```

---

# 41. Database Design Principles

Use normalized relational data for core entities.

Do not store the entire application state as one giant JSON document.

Use JSON/JSONB only where flexible structured data is genuinely useful, such as:

- Category-specific specifications.
- Configurable scoring criteria.
- Flexible metadata.

Important fields should remain queryable relational columns.

All tables should have appropriate:

- Primary keys.
- Foreign keys.
- Unique constraints.
- Indexes.
- Created timestamps.
- Updated timestamps.

---

# 42. API Architecture

The backend should expose versioned APIs.

Example:

```text
/api/v1/auth
/api/v1/products
/api/v1/categories
/api/v1/brands
/api/v1/badges
/api/v1/reviews
/api/v1/media
/api/v1/search
/api/v1/homepage
/api/v1/admin
```

Public endpoints must only expose published/active content.

Admin endpoints require authentication and authorization.

---

# 43. Authentication Architecture

Minimum requirements:

- Secure password hashing.
- JWT or secure session-based authentication.
- Refresh-token strategy if JWT is used.
- Password reset.
- Email verification where appropriate.
- Rate limiting.
- Secure cookies where applicable.
- CSRF protection where applicable.
- Login attempt protection.
- Server-side authorization.

Never store plaintext passwords.

---

# 44. Authorization

Every admin endpoint must verify:

1. User is authenticated.
2. User has the required role/permission.
3. User is authorized to perform the requested action.

Do not rely on frontend route protection alone.

---

# 45. Media Architecture

Images and videos should not be stored directly in relational database rows.

Use object/file storage.

Database stores:

- Media ID.
- Owner/entity.
- File URL/reference.
- MIME type.
- Size.
- Width/height where relevant.
- Duration for video.
- Upload timestamp.
- Moderation status.

For user review videos:

> Maximum duration = 30 seconds.

Media upload must use controlled file handling.

---

# 46. Security Requirements

## User content

Treat all uploaded files as untrusted.

Validate:

- Extension.
- MIME type.
- Actual file signature.
- Size.
- Duration.
- Ownership.

## API

Use:

- Authentication.
- Authorization.
- Rate limiting.
- Input validation.
- Output validation.
- Secure error handling.
- Audit logging for admin actions.

## Admin

Admin authentication should have stronger protection than normal users.

Future recommendation:

> Admin 2FA/MFA.

---

# 47. SEO

SEO is important because product research pages should be discoverable through search engines.

Each public product should have:

- SEO title.
- Meta description.
- Canonical URL.
- Open Graph metadata.
- Structured data where appropriate.
- Clean slug.
- Breadcrumbs.

Example:

```text
/p/headphones/sony-wh-ch520
```

Category:

```text
/c/electronics/audio/headphones
```

The exact URL structure can be finalized during implementation.

---

# 48. Performance

The public site should prioritize:

- Fast initial load.
- Optimized images.
- Responsive images.
- Lazy loading.
- CDN delivery.
- Caching.
- Pagination.
- Efficient database queries.
- Search indexes.

Do not load every product on the homepage.

---

# 49. Responsive Design

The public website must support:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Admin should primarily optimize for desktop/tablet, while remaining usable on smaller screens.

---

# 50. Design Direction

The design should feel like a **premium modern consumer-tech product**, not a clone of Amazon or Flipkart.

Principles:

- Clean.
- Minimal.
- Strong typography.
- Clear hierarchy.
- Product imagery.
- Spacious layouts.
- Excellent cards.
- Strong search.
- Subtle interactions.
- Fast navigation.
- Mobile-friendly.

Do not directly copy Amazon/Flipkart layouts, branding, colors, assets, or UI.

The UX goal is:

> **Shopping clarity instead of shopping overload.**

---

# 51. Important Product Card Information

Product cards should prioritize decision-making.

Possible card structure:

```text
Badge
Product Image
Brand
Product Name
PickD Score
Short verdict/tagline
Current Price
Price Range
Optional community rating
View Product
```

Example:

```text
🏆 TOP RECOMMENDATION

Sony WH-CH520

PickD Score
8.8/10

Excellent everyday headphones
with strong battery life.

₹1,999
₹1,799 – ₹2,499

⭐ 4.6/5

View Product →
```

---

# 52. Public Product Discovery Philosophy

Users should be able to discover products through:

1. Search.
2. Categories.
3. Top Picks.
4. Featured products.
5. Badges.
6. Brands.
7. Recommendations.
8. Related products.
9. Product comparisons.

---

# 53. Product Comparison

Comparison should eventually support multiple products.

Example:

```text
                 Product A  Product B  Product C

PickD Score        8.9        8.5        8.2
Sound              9.2        8.7        8.3
Comfort            8.8        9.1        8.2
Battery            9.5        8.5        9.0
Value              9.4        8.3        8.9
```

The comparison system should use structured product attributes.

---

# 54. Admin Content Philosophy

The frontend should not contain product-specific business logic.

Bad:

```text
if product.name === "Sony..."
```

Good:

```text
API → Product → Render
```

The admin should control content through data.

This allows the site to grow without modifying frontend code every time a product is added.

---

# 55. Initial MVP Scope

The MVP should include:

## Public

- Homepage.
- Navbar.
- Search.
- Category navigation.
- Category pages.
- Product pages.
- Top Picks.
- Product badges.
- Product media.
- PickD Score.
- PickD Verdict.
- Pros/Cons.
- Amazon links.
- Flipkart links.
- Public reviews.
- User authentication.
- User ratings.
- User reviews.
- Image uploads.
- Short video uploads under 30 seconds.

## Admin

- Admin login.
- Dashboard.
- Product CRUD.
- Product media management.
- Image ordering.
- Product pricing.
- Product badges.
- Category CRUD.
- Brand CRUD.
- Pinned brands.
- Top Picks management.
- Homepage management.
- Review moderation.
- User media moderation.
- Admin activity logs.

---

# 56. Explicitly Out of MVP Scope

Do NOT build these unless specifically required later:

- Shopping cart.
- Checkout.
- Payment processing.
- Inventory management.
- Seller marketplace.
- Seller accounts.
- Shipping.
- Order management.
- Returns.
- Product fulfillment.
- Full social network.
- Complex loyalty system.

SortedChoice is not an e-commerce marketplace.

---

# 57. Future Features

Possible future additions:

- AI-assisted product research.
- Personalized recommendations.
- User preference profiles.
- "Find the best product for me" wizard.
- Price history.
- Price-drop alerts.
- Product availability tracking.
- More retailers.
- Advanced comparisons.
- Verified purchase integrations.
- Expert reviews.
- Community Q&A.
- Follow products.
- Wishlist.
- Notifications.
- Personalized homepages.
- Affiliate analytics.
- Editorial collections.
- Automated product data ingestion.
- Research source management.

---

# 58. Future "What Should I Buy?" Engine

One of the most important future features.

User enters:

> I need headphones under ₹3,000. I care about bass, sound quality and gaming latency.

The system evaluates structured product attributes and returns:

```text
Best Match
Product A

Why:
- Strong bass.
- Good sound.
- Low latency.
- Within budget.

Alternative:
Product B

Better if:
- Comfort is more important.
```

This feature represents the long-term vision of SortedChoice.

---

# 59. Trust & Transparency

SortedChoice should clearly distinguish:

### PickD Research

Information and recommendations created by SortedChoice.

### Community

Reviews and media uploaded by authenticated users.

### Retailer

The external seller/marketplace.

### Affiliate disclosure

If affiliate relationships exist, disclose them clearly and according to applicable requirements.

The platform must never fabricate user reviews, ratings, purchases, or product experiences.

---

# 60. Admin Activity Logging

Important admin actions should be logged.

Examples:

```text
Admin created product
Admin updated product price
Admin published product
Admin deleted image
Admin approved review
Admin rejected review
Admin pinned brand
Admin created badge
```

Log:

- Admin ID.
- Action.
- Entity.
- Entity ID.
- Timestamp.
- Relevant metadata.
- IP/device information only where justified by security requirements.

---

# 61. Product Status

Recommended states:

```text
Draft
Published
Archived
```

Optional future states:

```text
Pending Review
Scheduled
Out of Date
```

Only `Published` products appear publicly.

---

# 62. Content Quality Requirements

Every published product should ideally contain:

- High-quality primary image.
- Clear title.
- Brand.
- Category.
- Price.
- PickD Score.
- Verdict.
- Pros.
- Cons.
- Best For.
- Retailer links.

A product should not be published with incomplete critical data unless explicitly allowed by admin.

---

# 63. Product Data Ownership

The platform should treat product data as first-class content.

Do not build the frontend around scraped marketplace HTML.

The internal product model should be independent of Amazon/Flipkart page structures.

External retailer data can later be imported or synchronized into the internal model.

---

# 64. Scalability

The system should be designed so that:

- Thousands of products can be stored.
- Thousands of reviews can be stored.
- Media can grow independently.
- Search can scale independently.
- Public pages can be cached.
- Backend services can be separated later if necessary.

Do not prematurely split the application into microservices.

Start with a **modular monolith** unless scale later proves a service separation necessary.

---

# 65. Recommended Technical Architecture

A practical initial architecture:

```text
Frontend
    ↓
Backend API
    ↓
PostgreSQL
    ↓
Object Storage

Optional:
Redis → caching / rate limiting / future queues
CDN → images/videos/static assets
```

Frontend can be implemented using a modern React-based framework.

Backend can be implemented using a modern API framework such as FastAPI or Node.js/TypeScript.

The exact choice should be finalized before implementation.

---

# 66. Environment Separation

Maintain:

```text
Development
Staging
Production
```

Never use production credentials in development.

Use environment variables for:

- Database.
- Authentication secrets.
- Storage credentials.
- Retailer configuration.
- Email.
- Analytics.
- External APIs.

Never commit secrets to Git.

---

# 67. Deployment Architecture

Initial deployment can remain simple:

```text
GitHub
   ↓
CI/CD
   ↓
Frontend deployment
   ↓
Backend deployment
   ↓
Managed PostgreSQL
   ↓
Object storage/CDN
```

Domain:

```text
sortedchoice.com
```

should point to the production frontend.

API can use a subdomain such as:

```text
api.sortedchoice.com
```

The exact infrastructure provider can be selected later.

---

# 68. Development Order

Do not build everything simultaneously.

Recommended order:

## Phase 1 — Foundation

- Repository.
- Project structure.
- Database.
- Authentication.
- Base API.
- Base UI system.

## Phase 2 — Admin CMS

- Admin login.
- Categories.
- Brands.
- Badges.
- Products.
- Product media.
- Top Picks.

## Phase 3 — Public Website

- Homepage.
- Navbar.
- Search.
- Categories.
- Product cards.
- Product pages.

## Phase 4 — Reviews

- User authentication.
- Review creation.
- Ratings.
- Image uploads.
- Video uploads.
- Moderation.

## Phase 5 — Polish

- SEO.
- Performance.
- Responsive design.
- Analytics.
- Security hardening.
- Deployment.

---

# 69. MVP Success Criteria

The MVP is successful when:

1. Admin can create a category.
2. Admin can create a brand.
3. Admin can create a badge.
4. Admin can create a product.
5. Admin can upload and reorder product images.
6. Admin can upload product video.
7. Admin can set minimum/current/maximum price.
8. Admin can assign badges.
9. Admin can pin a brand.
10. Admin can select Top Picks.
11. Product becomes visible when published.
12. Users can browse categories.
13. Users can search products.
14. Users can view product details.
15. Users can see PickD Score and verdict.
16. Users can open Amazon/Flipkart links.
17. Users can register/login.
18. Authenticated users can review.
19. Authenticated users can upload images.
20. Authenticated users can upload videos under 30 seconds.
21. Admin can moderate reviews/media.
22. Public users cannot access admin functionality.
23. Draft products never appear publicly.

---

# 70. Core Product Statement

SortedChoice should always be understood as:

> **A research-first product discovery platform that helps people decide what to buy without spending hours researching across multiple websites.**

It is not:

> An Amazon clone.

It is not:

> A Flipkart clone.

It is not:

> A traditional product catalog.

It is:

> **The decision layer between the user and the marketplace.**

---

# 71. Core User Journey

```text
Discover
   ↓
Search / Browse
   ↓
Shortlist
   ↓
Understand
   ↓
Compare
   ↓
Read PickD Verdict
   ↓
Read Community Reviews
   ↓
Choose
   ↓
Go to Amazon / Flipkart
   ↓
Purchase
```

---

# 72. Core Admin Journey

```text
Admin Login
    ↓
Dashboard
    ↓
Create/Manage Category
    ↓
Create/Manage Brand
    ↓
Create Product
    ↓
Upload Images/Videos
    ↓
Set Price
    ↓
Write Description
    ↓
Set PickD Score
    ↓
Write Verdict
    ↓
Assign Badges
    ↓
Add Retailer Links
    ↓
Publish
    ↓
Product appears publicly
```

---

# 73. Final Architecture Principle

The system must be **content-driven and admin-controlled**.

The frontend should render structured data.

The admin should control the content.

The backend should enforce business rules and security.

The database should maintain the source of truth.

Media should live in scalable object storage.

External marketplaces should remain external.

Users should provide the community layer.

SortedChoice should own the **research, recommendation, organization, discovery and decision experience**.

---

# 74. Final Vision

The long-term vision is:

> **A user should be able to come to SortedChoice, tell us what they need, understand the best available options in minutes, and confidently choose where to buy.**

Instead of:

> "Here are 500 products. Good luck."

SortedChoice should say:

> **"We researched these. Here are the ones worth your attention — and here's why."**

That is the core of the product.
