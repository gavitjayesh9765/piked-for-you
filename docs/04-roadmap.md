# SortedChoice — Build Roadmap

> Ordered per spec §68. Nothing here is built simultaneously — each phase
> depends on the one before it.

---

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation — structure, tokens, UI system, data model | **Done** |
| 2 | Admin CMS — auth, product CRUD, moderation | **Done** (taxonomy CRUD + media upload pending) |
| 3 | Public site — wired to live data | **Done — live on Supabase** |
| 4 | Reviews — auth, submission, media, moderation | Moderation done; submission UI pending |
| 5 | Polish — SEO, performance, security, deploy | Security done; deploy pending |

## Live status

Supabase project `qokjrsciihybnznbgqjn` (ap-south-1).
21 tables, RLS on all, 63 policies, seed loaded. Frontend runs on real data
(`NEXT_PUBLIC_USE_MOCKS=0`).

**Connection note:** the direct host `db.<ref>.supabase.co` is IPv6-only.
Use the **session pooler** (`aws-0-ap-south-1.pooler.supabase.com:5432`,
user `postgres.<ref>`) on IPv4 networks. The password must be URL-encoded.

### Bugs found by running against a real database
1. `SELECT DISTINCT` + `ORDER BY` on a joined column — invalid in Postgres. Filters now use IN/EXISTS, no DISTINCT.
2. `MissingGreenlet` — `link.retailer` lazy-loaded outside async context. Nested `selectinload` added.
3. Pydantic serialised `Decimal` as a JSON **string**, so `.toFixed()` threw. Wire type is now float, plus coercion at the frontend boundary.
4. Reviews client path did not match the route (`/products/{id}/reviews` vs `/reviews/product/{id}`).

None of these were visible against mock data.

---

## Phase 1 — Foundation ✅

- [x] Repository structure (`frontend/` · `backend/` · `docs/`)
- [x] Design token layer, light + dark (`frontend/src/styles/tokens.css`)
- [x] Tailwind bridged to tokens — no literal colours in components
- [x] Full-bleed layout primitives (`.shell` family, fluid product grid)
- [x] UI component library + `/styleguide` preview
- [x] Data model — 17 SQLAlchemy tables, verified to register
- [x] FastAPI app assembly, 42 routes, role dependency chain
- [x] Wire contract shared between `lib/types.ts` and `app/schemas/`
- [x] Alembic configured (env reads from settings)

**Verified:** `next build` passes with TypeScript; all 17 tables register;
all 42 routes mount and OpenAPI generates.

---

## Phase 2 — Admin CMS

The CMS has to work before the public site has anything real to show. This is
the phase that unblocks everything else.

- [ ] Generate the initial Alembic migration, apply to a live Postgres
- [ ] Seed script — categories, brands, badges, retailers, one full product
- [ ] Admin auth: login, refresh rotation, lockout, role gates
- [ ] Category CRUD — including reparenting and `path` rewrite on move
- [ ] Brand CRUD + pinning
- [ ] Badge CRUD
- [ ] Product CRUD (§37 form sections)
- [ ] Media upload to object storage + drag-and-drop ordering (§19)
- [ ] SortedChoice Score editor, validated against the category's criteria (§24)
- [ ] Retailer link management (§26)
- [ ] Publish/unpublish with completeness validation (§62)
- [ ] Top Picks curation (§15)
- [ ] Homepage section composer (§39)
- [ ] Activity logging on every mutation (§60)

**Exit criterion:** an admin can create a product end to end and it appears
publicly. That is MVP success criteria 1–11 (§69).

---

## Phase 3 — Public site

Screens are built; this phase replaces the mock transport with the real one.

- [x] Homepage, section-driven (§11)
- [x] Category page, fluid grid + faceted filters (§17)
- [x] Product page, full detail (§18)
- [x] Search page, grouped results (§33)
- [x] Header with dynamic sub-nav (§13), footer with affiliate disclosure (§59)
- [x] Product gallery: cursor-tracked zoom + prev/next (fine-pointer gated)
- [x] Newsletter signup with cadence choice — daily / weekly / deals-only
- [x] Contact / research-request page — topic-driven form, category multi-select, live docket
- [ ] Contact handlers + acknowledgement email + admin queue view
- [ ] Newsletter handlers + transactional email (double opt-in, one-click unsubscribe)
- [ ] Implement the public API handlers (repository layer is written)
- [ ] Flip `NEXT_PUBLIC_USE_MOCKS=0` — this should be the only change needed
- [ ] Brand pages (`/b/[slug]`)
- [ ] Top Picks page (`/top-picks`)
- [ ] Category index (`/c`)
- [ ] `not-found` and `error` boundaries
- [ ] Pagination / infinite scroll on category pages

**Note:** every page already imports from `lib/api.ts` only. No component
touches mock data directly, so the swap is a transport change, not a rewrite.

---

## Phase 4 — Reviews

- [ ] User registration, login, email verification
- [ ] Review submission form (UI shell exists in `ReviewList`)
- [ ] Rating input
- [ ] Image upload — multi-file, EXIF stripped, re-encoded
- [ ] Video upload — the 30-second cap needs a *designed* affordance, not an
      error message (see brainstorm §8)
- [ ] Full validation chain: MIME → magic bytes → size → decoded duration (§46)
- [ ] Moderation queue in admin (§30)
- [ ] Report flow + report resolution
- [ ] Recompute `rating_average` / `rating_count` on moderation
- [ ] "Helpful" voting

**Guardrail:** authentication is enforced in the API. Hiding the review button
is a convenience, never the control (§27).

---

## Phase 5 — Polish

### SEO (§47)
- [x] Per-product metadata, canonical, OpenGraph
- [x] `Product` + `BreadcrumbList` structured data
- [x] Clean URLs (`/p/{category}/{slug}`, `/c/{path}`)
- [ ] `sitemap.xml`, `robots.txt`
- [ ] `ItemList` structured data on category pages

### Performance (§48)
- [x] Server rendering, no client fetch waterfall
- [x] `selectinload` on product queries
- [x] Denormalised community rating
- [x] `next/image` with explicit `sizes`
- [ ] Redis caching on homepage and category responses
- [ ] CDN in front of object storage
- [ ] Postgres full-text + trigram indexes for search

### Security (§46)
- [x] Separate token audiences, separate user tables
- [x] Role dependency chain on every admin route
- [x] Media limits enforced in schema *and* handler
- [ ] Rate limiting wired to Redis
- [ ] Security headers (CSP, HSTS, `X-Content-Type-Options`)
- [ ] Admin MFA (§46 flags this as the next step)
- [ ] Dependency and container scanning in CI

### Deployment (§67)
- [ ] Dockerfiles + compose for local (Postgres, Redis, MinIO)
- [ ] CI: lint, typecheck, test, build
- [ ] Staging environment
- [ ] Managed Postgres with backups
- [ ] `sortedchoice.com` → frontend, `api.sortedchoice.com` → API

---

## Deferred — explicitly out of MVP (§56)

Not built, not stubbed, not disabled. Absent:

cart · checkout · payments · inventory · seller accounts · shipping ·
order management · returns · social network · loyalty

---

## Future (§57–§58)

The long-term differentiator is the **"What should I buy?" engine** — a user
describes a need in prose and gets a ranked answer with reasons.

That is why the backend is Python: the structured attributes it needs
(`score_criteria`, `specifications`, `filter_config`) are already modelled, and
the scoring system is configurable rather than hard-coded.

Also queued: price history and drop alerts · more retailers · advanced
comparison (§53) · community Q&A · wishlist · personalised homepages.
