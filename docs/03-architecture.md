# PickDForYou — System Architecture

> Implements `PickDForYou_Master_Product_Architecture_Specification.md`.
> Section references (§) point back to that document.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16, App Router, TypeScript | Server rendering matters — product pages must be indexable (§47), and the category grid must paint fast (§48). |
| Styling | Tailwind bridged to CSS custom properties | One token layer, two themes, no class churn on theme switch. |
| Backend | FastAPI, Python 3.11+ | §65 offered FastAPI or Node; Python keeps the door open for the recommendation engine in §57–§58. |
| Auth | **Supabase Auth** | Battle-tested. Owns passwords, sessions, MFA, email verification and reset — none of it is our code, so none of it can be our bug. |
| Database | **Supabase Postgres + RLS** | Relational core with JSONB where the shape is genuinely variable (§41), plus row-level authorization. |
| Schema | `supabase/migrations/` | **Source of truth.** SQLAlchemy models mirror it for querying only — Alembic has been removed to prevent divergence. |
| Media | **Supabase Storage** | Private buckets, signed URLs. Files never live in the database (§45). |
| Cache / limits | Redis | Rate limiting (§46) and, later, queues. |

**Shape: a modular monolith** (§64). One deployable API, hard internal module
boundaries. Not microservices — the spec explicitly warns against splitting
prematurely, and nothing here has independent scaling pressure yet.

---

## 2. Topology

```
                    ┌──────────────────────────┐
   Browser ────────▶│  Next.js  (frontend/)    │
                    │  public site + /admin    │
                    └────────────┬─────────────┘
                                 │  HTTPS, JSON
                                 ▼
                    ┌──────────────────────────┐
                    │  FastAPI  (backend/)     │
                    │  modular monolith        │
                    │                          │
                    │  auth · products         │
                    │  categories · brands     │
                    │  badges · reviews        │
                    │  media · search          │
                    │  homepage · admin        │
                    └───┬──────────┬───────┬───┘
                        │          │       │
              ┌─────────▼──┐  ┌────▼───┐  ┌▼──────────┐
              │ PostgreSQL │  │ Redis  │  │ S3 / MinIO │
              │ source of  │  │ limits │  │ images and │
              │ truth      │  │ cache  │  │ video      │
              └────────────┘  └────────┘  └─────┬──────┘
                                                │
                                             ┌──▼──┐
                                             │ CDN │
                                             └─────┘

   Outbound only, never integrated:   Amazon · Flipkart
```

Retailers stay external (§73). We store a URL and a last-checked price; we never
scrape their markup or model our product around their page structure (§63).

---

## 3. Repository layout

```
pickdforyou/
├── docs/                      architecture and design documentation
├── frontend/
│   └── src/
│       ├── app/               routes (App Router)
│       │   ├── page.tsx           home
│       │   ├── c/[...path]/       category  →  /c/electronics/audio
│       │   ├── p/[category]/[slug]/  product →  /p/audio/sony-wh-1000xm5
│       │   ├── search/
│       │   ├── styleguide/        living design-system preview
│       │   └── admin/             CMS shell + dashboard
│       ├── components/
│       │   ├── ui/            primitives: Button, Badge, SearchField, icons
│       │   ├── layout/        header, footer, section, breadcrumbs, theme
│       │   ├── product/       card, gallery, score ring, verdict, reviews
│       │   ├── category/      filter rail, sort
│       │   └── home/          hero, category tiles
│       ├── lib/
│       │   ├── api.ts         THE seam — mocks or live API, one switch
│       │   ├── types.ts       wire contract, mirrors backend schemas
│       │   ├── format.ts      currency, dates, URL builders
│       │   └── mock/          design-time fixtures
│       └── styles/tokens.css  ← source of truth for the visual system
└── backend/
    ├── app/
    │   ├── main.py            app assembly, middleware
    │   ├── api/v1/router.py   public/admin split, role gates
    │   ├── core/              config, security, dependencies
    │   ├── db/                engine, session factory
    │   ├── models/            SQLAlchemy — 17 tables
    │   ├── schemas/           Pydantic wire types (camelCase out)
    │   └── modules/           one package per domain
    └── alembic/               migrations
```

---

## 4. Data model (§40)

17 tables. Core entities are normalised; JSONB appears only where the shape is
genuinely per-category.

```
users ──────────< reviews >────────── products
admin_users                              │
                                         ├──< product_media
brands ─────────────────────────────────<┤
categories ──┐                           ├──── product_scores  (1:1)
   └─ self-referential (parent_id)       ├──< product_badges >──── badges
                                         └──< product_retailers >── retailers
reviews ──< review_media
       └──< review_reports

top_picks >──── products
homepage_sections
activity_logs >──── admin_users
```

### Where JSONB is used, and why

| Column | Justification |
|---|---|
| `categories.path` | Denormalised ancestor slugs — resolves `/c/electronics/audio/headphones` in one indexed query instead of a recursive walk. |
| `categories.score_criteria` | Scoring criteria differ per category (§24): headphones score on ANC, monitors on refresh rate. |
| `categories.filter_config` | Which facets a category exposes (§17). |
| `products.specifications` | Genuinely category-shaped (§41). |
| `products.pros / cons / best_for / not_ideal_for` | Ordered short strings; never queried individually. |
| `product_scores.criteria` | Per-criterion values, matching the category config. |

Everything queried, filtered or sorted stays a real column: `price_current`,
`status`, `overall`, `rating_average`. The spec is explicit that the application
must not become one giant JSON document (§41).

### Constraints that encode product rules

These are in the schema, not only in application code, because a bug in one
layer should not be able to violate them:

- `review_media`: `kind <> 'video' OR duration_seconds <= 30` — the 30-second
  cap from §29, enforced by the database.
- `reviews`: unique `(product_id, user_id)` — one review per user per product,
  so the community average is not trivially gameable.
- `products`: `status IN ('draft','published','archived')` and
  `price_min <= price_max`.
- `product_scores`: `overall BETWEEN 0 AND 10`.

---

## 5. API design (§42)

Versioned under `/api/v1`. Two halves with different rules.

### Public

No auth, or optional auth. **Returns published content only.** That filter lives
in the repository layer (`_published_only()` in
`backend/app/modules/products/repository.py`), not in each route — so a new
public endpoint inherits the guarantee instead of having to remember it.

```
GET  /products                        list + filter + sort + paginate
GET  /products/facets                 filter options with counts
GET  /products/{category}/{slug}      detail
GET  /products/{id}/alternatives      §52
GET  /categories                      §13 sub-nav, §11 tiles
GET  /categories/tree
GET  /categories/{path:path}          resolves any depth
GET  /brands?pinned=true              §22
GET  /badges
GET  /homepage                        fully-resolved sections, one request
GET  /homepage/top-picks
GET  /search?q=                       grouped by entity type
GET  /reviews/product/{id}            approved only
POST /auth/register | /auth/login | /auth/refresh
POST /reviews                         requires auth
POST /media/review                    requires auth
```

### Admin

Everything under `/api/v1/admin`, gated at mount by `require_role("moderator")`,
with individual routes raising the bar (`editor` to publish, `admin` to read the
audit log, `super_admin` for admin accounts).

**Route protection in the frontend is not authorization** (§44). The admin
layout is chrome; the dependency chain in `backend/app/core/deps.py` is the
control.

### Response conventions

- Python is snake_case, JSON is camelCase — Pydantic's `alias_generator` handles
  the translation, so neither side compromises its idiom.
- Lists are always paginated (§48). There is no unpaginated list endpoint.
- Public GETs set `Cache-Control: s-maxage=300, stale-while-revalidate=60`.
- A draft product returns **404**, not 403 — the existence of unpublished
  content is not public information.

---

## 6. Authentication and authorization (§43, §44)

**We implement no authentication.** Supabase Auth owns registration, login,
password reset, email confirmation, session refresh and MFA. There is no
`/login` or `/register` endpoint in this API to attack.

### One role, set manually

An admin is an `auth.users` row with `app_metadata.role = 'admin'`.

- `app_metadata` is writable **only with the service-role key**, which lives in
  the FastAPI environment and never reaches a browser.
- `user_metadata` *is* user-writable, which is exactly why nothing here ever
  reads it for authorization.
- There is no admin signup endpoint. Creation is one SQL statement by a human
  (`docs/05-admin-setup.md`).

**No code path exists by which a shopper becomes an admin.**

### Admin MFA is enforced at the API, not the login screen

`AuthedUser.is_admin` requires `app_metadata.role == "admin"` **and**
`aal == "aal2"` (second factor verified). A login page can be bypassed by
calling the API directly; this property cannot, because every request passes
through it.

### Three walls

1. **Next proxy** (`frontend/src/proxy.ts`) — fast redirect. UX only, never a security boundary.
2. **FastAPI** (`app/core/deps.py`) — verifies signature, audience, role, MFA. *The control.*
3. **Row Level Security** — the database refuses the row. A bug in layer 2 still cannot leak data.

---

## 6a. Mass assignment

Every **write** schema extends `StrictWire` (`extra="forbid"`), so an unknown
field is rejected with 422 rather than silently dropped. A payload carrying
`role`, `status`, or `rating_average` fails loudly.

`ProductCreate.status` is `Literal["draft"]` — a product cannot be created
already published; that is a separate, audited endpoint (§38).

---

## 7. Media pipeline (§45, §46)

All uploads are untrusted. The order is not negotiable:

```
1. authenticate + verify ownership of the target entity
2. declared MIME against the allow-list
3. ACTUAL file signature (magic bytes)   ← the declared type is a claim
4. byte size against the configured cap
5. video: decode, check real duration ≤ 30s
6. strip EXIF, re-encode, write to object storage
7. persist metadata row; original bytes never touch the database
```

Frontend validation is a convenience only (§29). The 30-second cap is enforced
in the handler *and* as a database CHECK constraint.

---

## 8. Performance (§48)

- Server components render product and category pages; no client-side fetch waterfall.
- `selectinload` on every product query — a 48-card grid is one round trip, not ~200.
- Community rating is denormalised onto `products` and recomputed on moderation,
  so no card needs an aggregate query.
- `next/image` with explicit `sizes` for the fluid grid; only above-the-fold
  cards get `priority`.
- Indexes on the hot paths: `(category_id, status)`, `(status, published_at)`,
  `product_scores.overall`, `price_current`.

---

## 9. Environments (§66, §67)

Three environments — development, staging, production — with no shared
credentials. Everything is environment-driven (`backend/.env.example`,
`frontend/.env.example`); nothing secret is committed.

```
GitHub → CI → build → frontend (Vercel/Node)  ·  api.pickdforyou.com (container)
                    → managed PostgreSQL  ·  object storage + CDN
```

`pickdforyou.com` serves the frontend; `api.pickdforyou.com` serves the API.

---

## 10. What is deliberately absent

Per §56, none of the following exist anywhere in this codebase — not as a
disabled feature, not as a stub:

cart · checkout · payments · inventory · sellers · shipping · orders · returns

PickDForYou is not a marketplace. The absence is the architecture.
