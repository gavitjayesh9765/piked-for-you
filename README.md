# SortedChoice

> **The decision layer between the user and the marketplace.**

A product research, comparison and recommendation platform. We research
products so people can choose with confidence — then hand them off to Amazon,ss
Flipkart, or the brand's own store to buy.

SortedChoice is **not** a marketplace. There is no cart, no checkout, no
inventory. The value is the research and decision layerddddd

---

## Quick start

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_USE_MOCKS=1 by default
npm run dev
```

| Route | What |
|---|---|
| `/` | Homepage — section-driven, full-bleed |
| `/c/electronics/audio` | Category — fluid grid, faceted filters |
| `/p/audio/sony-wh-1000xm5` | Product — score, verdict, pros/cons, specs, reviews |
| `/search?q=sony` | Search — grouped by products / brands / categories |
| `/contact` | Ask the desk — topic-driven request form |
| `/admin` | CMS dashboard |
| `/admin/pricing` | Price runs — scope, retailer selectors, settings, history |
| **`/styleguide`** | **Living design system — start here** |

Everything renders from `src/lib/mock/` until you set
`NEXT_PUBLIC_USE_MOCKS=0`. Every page imports from `src/lib/api.ts` and nothing
else, so that flag is the only change needed to go live.

### Backend

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate    # or source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env                              # set SECRET_KEY and DATABASE_URL
uvicorn app.main:app --reload
```

API docs at `http://localhost:8000/docs` (disabled in production).

```bash
# Once Postgres is running:
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## Documentation

| Document | What it covers |
|---|---|
| [Design brainstorm](docs/01-design-brainstorm.md) | The design direction, what changed from the Stitch output and why |
| [Design system](docs/02-design-system.md) | Tokens, colour grammar, layout scale, component reference |
| [Architecture](docs/03-architecture.md) | Stack, topology, data model, API design, security, performance |
| [Roadmap](docs/04-roadmap.md) | Build order and current status |
| [Price scraping](docs/06-price-scraping.md) | How retailer prices are checked, judged and recorded |
| [Newsletter email](docs/10-newsletter-email.md) | Mail transport, why Brevo, and how double opt-in completes |
| [Master spec](SortedChoice_Master_Product_Architecture_Specification.md) | The original product specification |

---

## Design in one screen

Three ideas carry the whole visual system.

**1. Colour is grammar.** Users learn it without being told.

```text
PURPLE   deciding    our intelligence — scores, verdicts, internal actions
ORANGE   getting     leaving for a retailer — RetailButton only, nothing else
GREEN    value       worth-it signals
OBSIDIAN editorial   curatorial authority — badges, structure
```

**2. The width is used.** The shell is fluid with a gutter that grows
`16 → 80px`. Product grids are `auto-fill` — 4 cards at 1280px, 8 at 2560px, no
breakpoint table. But prose stays at 72ch: a full-bleed grid is good, a
full-bleed paragraph is not.

**3. Every card carries a reason.** The tagline on `ProductCard` is
load-bearing. A card without it is a listing; a card with it is a
recommendation. That single line is the difference between this and a
marketplace.

Both themes are tuned independently — dark is not an inversion. See
[the brainstorm](docs/01-design-brainstorm.md#31-it-is-light-only--we-need-a-real-dark-theme)
for the specifics.

---

## Stack

```text
Next.js 16 (App Router, TS)  →  FastAPI (Python 3.11+)  →  PostgreSQL
Tailwind → CSS custom props                              →  S3 / MinIO → CDN
                                                         →  Redis
```

A **modular monolith** (spec §64), not microservices. Hard internal module
boundaries, one deployable API.

---

## Project layout

```text
├── docs/                    architecture and design documentation
├── frontend/
│   └── src/
│       ├── app/             routes — home, /c, /p, /search, /admin, /styleguide
│       ├── components/      ui · layout · product · category · home
│       ├── lib/             api.ts (the seam) · types.ts · format.ts · mock/
│       └── styles/          tokens.css  ← source of truth for the visual system
└── backend/
    ├── app/
    │   ├── api/v1/          public/admin split, role gates
    │   ├── core/            config · security · deps
    │   ├── models/          17 SQLAlchemy tables
    │   ├── schemas/         Pydantic wire types (camelCase out)
    │   └── modules/         one package per domain
    └── alembic/             migrations
```

---

## Non-negotiables

These are enforced in code, not just documented:

- **Never imply we sell anything** (§4.5). No cart, no basket glyph, no "Add to".
- **SortedChoice Score ≠ community rating.** Different scales, different components,
  different colours. Merging them is the most damaging trust mistake available (§32).
- **No "Verified Buyer"** until a real verification mechanism exists. The schema
  offers no column to claim one (§31).
- **Affiliate disclosure** on every page carrying a retailer link (§59).
- **Draft products are unreachable publicly** — enforced in the repository
  layer, not per-route (§38, §61).
- **Route protection is not authorization.** The admin layout is chrome; the
  dependency chain in `core/deps.py` is the control (§44).
- **30-second review video cap** enforced in the handler *and* as a database
  CHECK constraint (§29).
- **Prices are never checked automatically.** No cron, no `pg_cron`, no timer.
  A price run exists because an admin pressed the button, and the row records
  who. See [price scraping](docs/06-price-scraping.md).
- **Price history is append-only, and admin-only.** RLS grants `SELECT` and
  `INSERT` to admins and nothing else — no update or delete path exists for
  anyone, and no public or PostgREST read path exists at all. Corrections are
  new rows, not edits.
- **A scraped price is not published on trust.** A reading that disagrees with
  the stored price by more than the configured tolerance is held back for a
  human, with the raw text it came from.

---

## Verification

```bash
cd frontend && npm run build      # builds + typechecks
cd backend  && python -m compileall -q app
```

Current state: frontend builds clean across all 7 routes with TypeScript;
17 tables register; 42 API routes mount and OpenAPI generates.


cd D:\Goal\Pickedforyou\backend
.\run.ps1


Stop-Process -Id 15704
cd D:\Goal\Pickedforyou\backend; .\run.ps1
