# 07 — Deployment

Three pieces, three places:

| Piece | Host | Region | Cost |
|---|---|---|---|
| Next.js frontend | Vercel | `bom1` (Mumbai) | $0 Hobby / $20 Pro |
| FastAPI backend | Render | `singapore` | $0 Free (→ $7 Starter at launch) |
| Postgres + Auth + Storage | Supabase | `ap-south-1` (Mumbai) | $0 free tier |

Everything is pinned to Mumbai or as close to it as the vendor offers. That is
not fussiness: every server-rendered page calls the API, which calls Postgres.
`src/app/page.tsx` makes two API calls before it renders a pixel. Host the
backend in Oregon and each of those becomes a ~230ms round trip that no amount
of frontend optimisation recovers.

---

## Why the free tier + keep-alive ping was abandoned

The plan was a Render free instance kept awake by an external cron so it never
hits the 15-minute spin-down. It does not work, and the reason is arithmetic
rather than policy.

A free Render workspace gets **750 instance-hours per month**, and Render's own
documentation states that **"spun-down services don't consume Free instance
hours."** The free tier only adds up *because* services sleep. A calendar month
is roughly **730 hours**. Pinging one service awake around the clock therefore
spends ~730 of your 750 and leaves **~20 hours of headroom for the whole
month** — consumed by redeploys and restarts, after which the service is
suspended until the 1st. Two services (frontend and backend) would need ~1460
hours against a 750-hour budget and would be suspended around the 15th.

Three further things a ping cannot fix:

- **Ephemeral filesystem.** Free instances lose local files on every restart,
  redeploy and spin-down.
- **No India region.** Render offers Oregon, Ohio, Virginia, Frankfurt and
  Singapore. Singapore (~55–75ms to `ap-south-1`) is the closest available.
- **Render states Free is "not for production applications."** This one takes
  affiliate revenue.

Starter at $7/mo is always-on by design, needs no external cron, and removes
the question. Given the frontend is on Vercel, $7/mo is the whole hosting bill.

---

## One-time setup

### 1. Backend → Render

1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → select the repo. It reads
   [`render.yaml`](../render.yaml) and creates `pickdforyou-api`.
3. Render prompts for every `sync: false` variable. Fill in from
   `backend/.env`:

   | Variable | Where to find it |
   |---|---|
   | `SUPABASE_URL` | Project Settings → API |
   | `SUPABASE_ANON_KEY` | Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API ⚠ bypasses RLS |
   | `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Settings |
   | `DATABASE_URL` | see the pooler note below |
   | `CORS_ORIGINS` | `https://your-domain.com` — or a comma-separated list, or a JSON array |

4. Deploy. Confirm `https://<service>.onrender.com/health` returns 200.
   `/docs` is correctly 404 in production — `main.py` disables it there.

#### No Docker

The service uses Render's **native Python runtime**. The only thing that ever
argued for a Dockerfile was `python-magic`, which binds to libmagic — a system
library pip cannot install. It turned out to be declared in `pyproject.toml`
and imported nowhere: media validation is done by decoding the file with
Pillow (`app/modules/admin/media.py`), a stronger check than any header sniff.
The dependency was removed and the Dockerfile with it.

Everything remaining resolves to a prebuilt manylinux wheel — Pillow, asyncpg,
cryptography, uvloop, httptools — so the build has no compiler step and needs
nothing installed at the OS level.

#### The pooler trap

Supabase gives you two connection strings and they are not interchangeable
here:

- **Port 5432 — session pooler. Use this one.**
- Port 6543 — transaction pooler. **Will break.**

`app/db/session.py` builds a SQLAlchemy engine with `pool_pre_ping` and does
not disable prepared statements. asyncpg emits prepared statements; pgbouncer
in transaction mode rejects them. The failure is intermittent and looks like a
database bug rather than a configuration one, so get it right the first time.

If you ever need 6543, add `?prepared_statement_cache_size=0` and pass
`poolclass=NullPool` — but 5432 is correct for a single-worker service.

### 2. Frontend → Vercel

`frontend/vercel.json` is deliberately four lines. Vercel validates it against
a strict schema and **rejects any unknown property**, including the `"//"` key
that works as a comment in `package.json` — there is no way to comment a
`vercel.json`, so the reasoning lives here instead:

- **`regions: ["bom1"]`** — Mumbai. Vercel defaults every new project to
  `iad1` (Washington DC), which would put the SSR layer ~200ms from both
  Supabase `ap-south-1` and the Render backend, paid on every server-rendered
  request and several times per page. Hobby allows exactly ONE region, so this
  array must stay length 1: listing more regions than the plan permits fails
  the deploy before the build step.
- **No robots headers.** `app/layout.tsx` and `app/admin/layout.tsx` already
  declare them through Next metadata. A second source would emit a conflicting
  `X-Robots-Tag` on admin routes.
- **No `services` block.** Vercel's import screen detects the FastAPI backend
  and offers to generate a multi-service config. Do not accept it — the
  backend belongs on Render. Setting Root Directory to `frontend` makes the
  detection go away.

1. Import the repo, set **Root Directory** to `frontend`.
2. [`frontend/vercel.json`](../frontend/vercel.json) pins functions to `bom1`.
   **Verify this in the dashboard after the first deploy** — Vercel defaults to
   US East, and that default silently rebuilds the latency problem this whole
   layout exists to avoid.
3. Environment variables:

   ```
   NEXT_PUBLIC_API_URL=https://<service>.onrender.com/api/v1
   NEXT_PUBLIC_SITE_URL=https://your-domain.com
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   NEXT_PUBLIC_USE_MOCKS=0
   ```

   `NEXT_PUBLIC_USE_MOCKS` **must** be `0`. Left at `1` the site builds and
   serves cleanly from `src/lib/mock` and never contacts your API — it looks
   entirely fine and is entirely fake.

   Never set `SUPABASE_SERVICE_ROLE_KEY` here. Anything `NEXT_PUBLIC_` is
   shipped to the browser, and that key bypasses Row Level Security.

4. Go back to Render and set `CORS_ORIGINS` to the real Vercel domain.

### 3. Supabase

Already in `ap-south-1`; leave it. Two things to know:

- Free projects **pause after ~7 days of no activity**. Live traffic prevents
  this; a quiet pre-launch period does not.
- Free tier is 500MB database and 1GB storage. Product media will reach the
  storage limit before the database limit.

---

## Before you call it launched

Not blockers for a deploy, but each one is real:

- **There is no rate limiting.** `slowapi` is in `pyproject.toml` and
  `REDIS_URL` is in `app/core/config.py`, but nothing imports either — grep
  and confirm. Spec §46 calls for it and the API currently has none. A public
  affiliate site with an open API and no limiter is a bandwidth bill waiting
  to happen. Fixing it needs Redis (Upstash free tier, Singapore region).
- **Ephemeral filesystem applies on Starter too.** Anything written to local
  disk is lost on redeploy. Uploads already go to Supabase Storage, so verify
  nothing else writes locally.
- **`DB_POOL_SIZE` is trimmed to 5+5** in `render.yaml`, down from the 10+20
  default. A Supabase free project does not have 30 spare connections.
- **Health checks and background work.** `healthCheckPath: /health` gives
  zero-downtime deploys, but an in-flight price-scrape `BackgroundTask` on the
  retiring instance is not restartable. Run scrapes deliberately, not during a
  deploy window.

---

## Routine deploys

Both hosts deploy on push to `main`. Backend changes take ~3–5 minutes
(pip install); frontend ~1–2. Roll back from either dashboard — Render keeps
previous images, Vercel keeps previous deployments.
