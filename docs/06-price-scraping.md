# Price tracking

How SortedChoice keeps retailer prices current, and why it is built the way it
is.

---

## 1. The shape of it

Three retailers per product — **Amazon**, **Flipkart**, and the brand's own
**Official** store — each with its own URL, its own price, and its own record
of when we last managed to read it.

Nothing checks those prices on a schedule. There is no cron entry, no
`pg_cron` job, no timer in the API process. A price run exists because an
admin pressed a button on `/admin/pricing`, and every run row records who
pressed it and what scope they chose.

```text
  Admin panel                 API                        Worker
  ───────────                 ───                        ──────
  press "Refresh prices"  →   POST /admin/pricing/runs
                              creates price_scrape_jobs row
                              commits it
                              returns 202 + job id    →   execute_job(job_id)
                                                            │
  poll GET .../runs/{id}  ←   reads the same row            │ per link:
        every 2s                                            │   fetch
                                                            │   extract
                                                            │   judge
                                                            │   write
                                                            ↓
                                                          finish
```

The button returns immediately. A catalogue of four hundred links at a polite
1.5s per host is minutes of work, and no HTTP client should be asked to hold a
connection open for it.

---

## 2. Where things live

| Piece | Path |
|---|---|
| Fetching (engines, robots.txt) | `backend/app/services/scraper/fetch.py` |
| Extraction (HTML → price) | `backend/app/services/scraper/extract.py` |
| The run (orchestration, writes) | `backend/app/services/scraper/runner.py` |
| Dry-run one URL | `backend/app/services/scraper/preview.py` |
| Admin endpoints | `backend/app/modules/admin/pricing.py` |
| Tables | `supabase/migrations/20260821000009_pricing_and_price_history.sql` |
| Admin screens | `frontend/src/app/admin/pricing/` |

`extract.py` is pure — HTML string in, `Reading` out, no network, no database,
no clock. That is what makes it the part of the system that can be tested
honestly; see `backend/tests/test_price_extraction.py`.

---

## 3. Tables

| Table | Holds | Why separate |
|---|---|---|
| `retailers` | engine + selectors per storefront | A retailer changing its markup is a Tuesday; a redeploy is not an acceptable fix, so selectors are a column |
| `product_retailers` | the current price, and the last scrape's state | Read on every product render — "is this stale?" must not cost a subquery |
| `price_scrape_jobs` | one press of the button | Progress counters live here so the panel polls one row |
| `price_scrape_results` | what happened to one link in one run | **Most outcomes are not a price**: blocked, 404, selector missed |
| `price_history` | observed prices, append-only, admin-only | A chart reads this and nothing else, so a blocked request can never dent a line |
| `pricing_settings` | the knobs, one row | Turned by an editor watching a run misbehave, and an editor cannot deploy |

Two properties the database enforces rather than trusting code to:

**One run at a time.** A unique partial index on `price_scrape_jobs` covers
rows whose status is `queued` or `running`. Two admins pressing the button in
the same second is exactly the race it exists for; the pre-check in the
endpoint only turns the resulting constraint violation into a readable message.

**Price history is append-only.** The RLS policies grant `SELECT` and `INSERT`
to admins and nothing else. There is no update path and no delete path
anywhere — not in the API, not in a policy. A past observation is a fact about
a moment, and editing it would make every chart drawn from the table a lie.
Corrections are new rows with `source = 'manual'`.

**Price history is admin-only.** No public endpoint reads it, and no RLS policy
grants `anon` or `authenticated` a path to it — so it is not reachable through
PostgREST either, which matters because the anon key is public by design. The
first version of the policy was looser (readable whenever the product was
published, in anticipation of a public chart); `20260821000010` closed it,
because a permission granted for a feature that does not exist yet is an
unattended door. Building a public chart later means re-opening it on purpose.

---

## 4. Reading a price

Six strategies, tried in order, most trustworthy first:

| # | Strategy | Confidence |
|---|---|---|
| 1 | Selectors configured for this retailer | high |
| 2 | JSON-LD `Product`/`Offer` | high |
| 3 | Microdata `itemprop="price"` | medium |
| 4 | `og:price:amount` and friends | medium |
| 5 | Generic class names half the web uses | low |
| 6 | Regex over the page's visible text | low |

Confidence is not decoration — see §5.

Two details worth knowing about, because both were bugs first:

**Separators.** `1,234.56`, `1.234,56` and `1,23,456` are all real and all mean
different things. Rather than assume a locale, `parse_price` reads the *last*
separator: if one or two digits follow it, it is a decimal point; otherwise
every separator is grouping. That gets Indian, European and US formats right
without knowing which one is on screen.

**The text scan walks elements, not flattened text.** On a real product page,
"EMI from ₹2,499/month" and "Delivery ₹99" are their own nodes, so each number
can be judged against the words that actually label it. Flattening the page
first puts those words within a few characters of the real price — either every
candidate gets rejected, or, with a narrower window, the EMI figure gets
accepted. Neither is recoverable by tuning a character count.

---

## 5. The guard rail

A scraped number reaching the live site is a decision, not a default.

When a reading disagrees with the stored price by more than the configured
tolerance, it is recorded with status `rejected`, the live price is left alone,
and the reading waits for a human. The admin panel shows it in amber with the
raw text it came from, and an "Apply this price anyway" button.

The tolerance is scaled by how much the reading is trusted:

| Confidence | Effective tolerance (at the 60% default) |
|---|---|
| high | 60% |
| medium | 30% |
| low | ~20% |

A JSON-LD price that halved is plausibly a sale. The same drop from a regex
over page text is almost always a selector that has wandered onto an EMI
instalment, a delivery fee, or a crossed-out figure from a different variant.

This is deliberately conservative, so it will sometimes stop a genuine 70%-off
sale. The "apply anyway" button is the other half of that trade.

---

## 6. Politeness

Defaults, all editable at `/admin/pricing?tab=settings`:

| Setting | Default |
|---|---|
| Parallel requests | 4 |
| Gap between requests, **per host** | 1500 ms |
| Timeout | 20 s |
| Retries | 2 |
| Honour `robots.txt` | yes |

Some specifics:

- **The delay is per host, not global.** Concurrency alone is not politeness:
  four workers that all happen to be on Amazon are four simultaneous requests
  to Amazon. `HostThrottle` spaces requests to the same host while letting
  different hosts proceed in parallel.
- **Retries cover only what retrying helps** — timeouts, resets, 5xx. A 403 is
  never retried: the answer will not change in two seconds, and hammering it is
  how a soft block becomes a hard one.
- **`robots.txt` is honoured by default**, cached per host for the run. A
  failure to *read* it is treated as permission, not refusal. The switch to
  ignore it lives in the admin panel rather than a config file, because it is a
  decision someone should own.
- **The User-Agent identifies us and carries a contact address.** A site
  operator who can tell what is hitting them can ask us to stop, which is
  better for everyone than being quietly blocked.
- **Responses are capped at 8 MB** and streamed, so a retailer sending 200 MB
  is a recorded error rather than a memory incident.

---

## 7. Engines

**`http`** — one `httpx` request. Fast, cheap, and enough for any storefront
that renders its price server-side, which is most of them, because they want
Google to see it.

**`browser`** — a headless render via Crawl4AI, for the ones that build the
price in JavaScript. Optional: the dependency is not installed by default, and
asking for this engine without it produces a clear message rather than an
`ImportError` halfway through a run.

```bash
cd backend
pip install -e ".[scraping]"
crawl4ai-setup
```

Chosen per retailer, with a default in settings for retailers that have not
picked one.

---

## 8. Fixing a retailer that has stopped working

The loop this system is designed around. It takes about a minute.

1. `/admin/pricing` — the **Failing** count at the top, or the per-retailer
   count under **Retailers**, says which one has drifted.
2. Open that retailer, paste a real product URL into **Test**, press it. The
   result names the strategy that answered and shows the raw text the number
   came out of — so a selector that was skipped and a generic fallback that
   answered instead are visibly different outcomes.
3. Edit the selectors (one CSS selector per line, tried in order). Test again.
4. **Save configuration.**
5. Back on **Run**, tick *Only links that failed last time* and start a run.
   That re-checks exactly what broke and nothing else.

Without the Test button, step 3 means editing a config, starting a real run
over the whole catalogue, and reading a results table to find out whether the
guess was right — a loop slow enough that people stop tuning selectors and
start living with broken ones.

---

## 9. Scoping a run

Every filter is optional and they compose, so "every Flipkart link in
Headphones that has not been checked in three days" is one run:

- specific products, or a category, or a brand
- specific retailers
- product status (published / drafts / everything)
- only stale, past a chosen number of hours
- only links that failed last time
- a hard limit on how many links to touch
- **dry run** — read everything, write nothing

The estimate under the button says how many links the current scope covers and
roughly how long it will take, *before* anything is pressed. "Refresh prices"
with no idea whether that means nine requests or nine hundred is not a control,
it is a dare.

---

## 10. Two things that will bite the next person

**Background tasks run before dependency teardown.** Starlette runs
`BackgroundTasks` *before* FastAPI unwinds `yield` dependencies, so `get_db`'s
commit has not happened yet when the task starts. The worker opens its own
session on its own connection and would not see a row still inside the
request's transaction — the button would appear to work and do nothing. That is
why `_create_run` commits explicitly before queueing.

**The session has `autoflush=False`.** `_roll_up_product_price` SELECTs every
link's price to find the cheapest; the price just assigned to the ORM instance
is not visible to that query until it is flushed. Without the explicit
`db.flush()`, the product's headline price lags a full run behind its own
links.

**A run can be orphaned by a restart.** Background work lives in the API
process, so a deploy mid-run leaves a job stranded as `running` — and the
one-active-run index then blocks every future run. `POST
/admin/pricing/runs/{id}/reap` is the way out; it refuses to touch a run that
has reported progress in the last ten minutes, so it cannot be used on a
healthy one.

---

## 11. Endpoints

```text
GET    /admin/pricing/overview             counts + active/last run
GET    /admin/pricing/filters              categories, brands, retailers
GET    /admin/pricing/settings
PUT    /admin/pricing/settings
GET    /admin/pricing/retailers            engine + selectors + failing counts
PUT    /admin/pricing/retailers/{id}
POST   /admin/pricing/preview              try one URL, write nothing
POST   /admin/pricing/runs/estimate        how big is this scope?
POST   /admin/pricing/runs                 ← the button
GET    /admin/pricing/runs                 run history
GET    /admin/pricing/runs/{id}            one run + its results
POST   /admin/pricing/runs/{id}/cancel     asks the worker to stop
POST   /admin/pricing/runs/{id}/reap       force-close a stalled run
POST   /admin/pricing/results/{id}/apply   publish a held-back reading
GET    /admin/products/{id}/price-history
POST   /admin/products/{id}/refresh-price  same machinery, one product
```

All mounted behind `get_current_admin`: signed JWT, `app_metadata.role ==
"admin"`, and completed MFA (`aal2`).

`POST /admin/pricing/preview` is worth calling out — it makes the *server*
fetch a URL the caller chose, which is the SSRF shape. It is acceptable here
for specific reasons: the caller is an MFA-verified admin, the URL is parsed as
a Pydantic `HttpUrl` so only `http`/`https` survive, and the fetched body never
reaches the browser. Only the extracted price, the strategy that found it, and
the status code come back.

---

## 12. Tests

```bash
cd backend && python -m pytest tests/ -q
```

- `test_price_extraction.py` — parsing and the strategy ladder against fixed
  HTML, including the EMI/delivery trap and the guard rail's tiers.
- `test_scraper_fetch.py` — the fetch layer against a **real** local HTTP
  server: 403 and 429 as blocks, 404 as a missing page, `robots.txt` honoured
  and overridable, an oversized body abandoned, a dead host as a recorded
  error. Not mocked, because every one of those is a property of an actual
  socket conversation and a stubbed transport would let them all pass while the
  real thing broke.
