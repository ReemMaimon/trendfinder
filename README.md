# TrendFinder

TrendFinder discovers **emerging** product trends every day, researches them on the
web with AI, finds matching real products on **AliExpress**, collects the real
product data, and publishes **the best 3 products of the day**.

Core philosophy: **don't show what's already everywhere — surface products that
are *starting* to become interesting, before everybody is talking about them.**

- Hebrew, RTL, mobile-first public site — no login, no signup.
- Authenticated admin panel for everything else.
- One automated generation run per day at **00:00 Asia/Jerusalem**. The AI does
  **not** run per visitor or per page view. All users see the same 3 products.

---

## 1. Architecture

```
Browser (public site, Hebrew RTL)
      │
      ▼
Next.js (App Router) ── API routes ── Services ─┬─ OpenAIService ── OpenAI Responses API + web_search
      │                                         ├─ TrendResearchService     (TREND FIRST)
      │                                         ├─ AliExpressResearchService (PRODUCT SECOND — web research, not a private API)
      │                                         ├─ ProductScoringService
      │                                         ├─ DiversityService
      │                                         ├─ DailyGenerationService    (orchestrator, idempotent)
      │                                         ├─ AffiliateService          (TEST ⇄ PRODUCTION link switch)
      │                                         ├─ CurrencyService           (→ ILS)
      │                                         └─ AnalyticsService
      ▼
PostgreSQL (Prisma)  ── full history, never overwritten

Worker process (PM2) ── node-cron @ 00:00 Asia/Jerusalem ── DailyGenerationService
                        (or: POST /api/cron/generate from system crontab / Hostinger cron panel)
```

The daily pipeline:

```
Scheduler → Trend Research AI → Web Search → Trend Candidates → AliExpress Search
→ Product Info Extraction → Validation → Scoring → Diversity Check → Duplicate Check
→ Final 3 Products → Database → Publish
```

If fewer than 3 new products can be found (after `maxCandidates` attempts), the
missing slots are backfilled with **fallback** products from the **previous 3
days only**, least-recently-shown first, marked `REUSED`.

### Tech stack

| Layer      | Choice                                  |
|------------|-----------------------------------------|
| Framework  | Next.js 14 (App Router) + TypeScript     |
| DB         | PostgreSQL + Prisma                      |
| AI         | OpenAI Node SDK — **Responses API** + hosted `web_search` tool |
| Styling    | Tailwind CSS                            |
| Auth       | bcrypt + signed JWT session cookie (jose) |
| Scheduler  | `cron` package (tz-aware) in a PM2 worker |
| Tests      | Vitest                                   |
| Hosting    | Hostinger VPS + PM2 + nginx              |

---

## 2. Local development

```bash
cp .env.example .env
# edit .env — at minimum DATABASE_URL, OPENAI_API_KEY, SESSION_SECRET, ADMIN_PASSWORD_HASH
npm install
npm run prisma:migrate      # create the schema
npm run db:seed             # settings singleton (+ optional admin from SEED_ADMIN_PASSWORD)
npm run dev                 # http://localhost:3000  (admin at /admin)
```

Generate a day's products locally (uses the real AI unless `AI_PROVIDER=mock`):

```bash
npm run generate:now                 # today
npm run generate:now -- 2026-09-07    # a specific date
npm run generate:now -- --force      # replace an existing DRAFT set
```

Run the scheduler worker locally:

```bash
npm run worker
```

### Admin password hash

```bash
npx tsx scripts/hash-password.ts 'your-strong-password'
# it prints a ready-to-paste `ADMIN_PASSWORD_HASH=...` line with every `$`
# escaped as `\$` (required — the env loader interpolates `$`).
```

The env admin (`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`) always works. You can
also create DB admin rows via `SEED_ADMIN_PASSWORD=... npm run db:seed`.

---

## 3. Database

- `npm run prisma:migrate` — dev migrations
- `npm run prisma:deploy` — apply migrations in production
- `npm run prisma:studio` — inspect data

Key entities: `admin_users`, `settings`, `daily_product_sets`,
`daily_product_items`, `products`, `product_trend_reports`, `trend_sources`,
`generation_runs`, `generation_candidates`, `product_views`, `product_clicks`,
`api_logs`. **Historical daily sets are never overwritten.**

---

## 4. OpenAI configuration

| Env | Meaning |
|-----|---------|
| `OPENAI_API_KEY` | required unless `AI_PROVIDER=mock` |
| `OPENAI_MODEL` | research + AliExpress model; must support Responses API + `web_search` (e.g. `gpt-4.1`) |
| `OPENAI_MODEL_LIGHT` | cheaper model for scoring / Hebrew copy |
| `AI_PROVIDER` | `openai` (default) or `mock` (deterministic, offline, no key) |

The pipeline uses **one combined research call per candidate**: the AI is
instructed to (1) find an emerging trend, (2) explain it, (3) search AliExpress
via the web (`site:aliexpress.com ...`), (4) compare listings, (5) extract real
data, or (6) reject the trend if no suitable product exists. The response is a
strict JSON object validated by `researchCandidateSchema` — malformed or
hallucination-shaped output is rejected before it can reach the DB.

### Web search

We use OpenAI's **hosted `web_search` tool** via the Responses API (no separate
search API key). URLs the tool surfaces are stored as `trend_sources`. If your
account/model does not expose `web_search`, switch `OPENAI_MODEL` to one that
does, or set `AI_PROVIDER=mock` while you sort access.

---

## 5. AliExpress research configuration

TrendFinder does **not** use a private AliExpress product API, and it does **not**
let the LLM produce product URLs/images (LLMs hallucinate plausible item ids that
404). Instead:

1. the AI returns the **trend** + 3–6 plain **search phrases**
2. `src/services/aliexpress/aeSearch.ts` requests the real public search page
   `https://www.aliexpress.com/w/wholesale-<phrase>.html` (forcing `en_US`/`USD`
   via cookie) and parses the `itemList.content[]` JSON AliExpress embeds in the
   page — real product id, canonical URL, image, price, star rating, order count
3. `AliExpressResearchService.gatherCandidates` de-dupes + ranks the real
   listings; `TrendResearchService.pickProduct` has the AI choose the best match
4. a data-quality gate requires a real image **and** a price

Every stored product field is real listing data. `AI_PROVIDER=mock` swaps in
deterministic synthetic search results so the pipeline runs offline. If
AliExpress ever starts blocking the server, `aeSearch.ts` is the one place to add
a proxy / scraper-API fallback.

### No-hallucination policy

The AI may infer viral potential / novelty / saturation. It may **not** invent
price, rating, orders, images, URLs or trend statistics. Unverifiable values are
stored as `null` and shown as `לא זמין`.

---

## 6. TEST MODE

`APP_MODE=TEST` (the default). **Deployable with no affiliate credentials.**
Everything works — trend research, AliExpress research, images, prices, ratings,
orders, analytics, the whole site — **except** affiliate link transformation:

- the "Buy on AliExpress" button (`/api/go/<id>`) 302-redirects to the **plain
  AliExpress product URL**
- no affiliate account, id, key or secret is required
- Admin dashboard shows `MODE: TEST — no affiliate processing is active`

## 7. PRODUCTION MODE

`APP_MODE=PRODUCTION` enables affiliate links:

- `/api/go/<id>` redirects to an **affiliate deep link**
- outbound clicks are recorded (`product_clicks.linkMode = "production"`)
- affiliate config stays server-side; users never see commission %, earnings or
  affiliate id

**Fail-safe:** if `APP_MODE=PRODUCTION` but affiliate config is missing, the
system:

- logs the problem and shows a config error on the Admin dashboard
- **refuses to publish** daily sets (they stay `DRAFT`)
- the public Buy button falls back to the plain URL — **never a fabricated
  affiliate link**

## 8. Mode switching

- Server-side only. `APP_MODE` in `.env` is the default.
- Admin can override at runtime (**Admin → Dashboard → מעבר ל-PRODUCTION**),
  stored in `settings.appModeOverride`. Switching to PRODUCTION is **blocked**
  unless affiliate config is complete.
- Public users cannot change the mode.

### Affiliate setup (when your account is approved)

```
ALIEXPRESS_AFFILIATE_ID=your_portals_tracking_id
ALIEXPRESS_AFFILIATE_STRATEGY=s.click          # or "portals" for signed links
# only needed for strategy=portals:
ALIEXPRESS_AFFILIATE_KEY=...
ALIEXPRESS_AFFILIATE_SECRET=...
```

Restart the app, then switch to PRODUCTION from the admin dashboard.
All affiliate logic lives in **one file**: `src/services/affiliate/AffiliateService.ts`
(`isEnabled()`, `getPurchaseUrl()`, `generateAffiliateLink()`, `assertProductionReady()`).

---

## 9. Hostinger deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step. Summary:

1. Hostinger **VPS**, Ubuntu, Node 20, PostgreSQL 15.
2. `git clone`, `npm ci`, set `.env` (`APP_MODE=TEST` to start).
3. `npm run prisma:deploy && npm run db:seed && npm run build`.
4. `pm2 start ecosystem.config.cjs` (web + worker), `pm2 save`, `pm2 startup`.
5. nginx reverse proxy (`deploy/nginx.conf.example`) + `certbot`.
6. Cron: the PM2 worker runs the 00:00 job. Optionally also add
   `deploy/crontab.example` hitting `POST /api/cron/generate` as a backup.

### Cron / timezone

The worker uses the `cron` package with an **explicit `Asia/Jerusalem`
timezone**, so DST is handled by the OS tz database — not by the server clock.
The HTTP cron backup uses `CRON_TZ=Asia/Jerusalem`. Generation is **idempotent**:
a double fire never creates a second daily set or overwrites a published one.

---

## 10. Admin panel

`/admin` (login required). Sections: Dashboard, Today's products, History, AI
runs, Candidates (accepted + rejected with reasons), Sources, Products,
Analytics, Settings, Mode switch.

Admin can: view/edit/remove/replace/manually-add products, trigger generation
(with live progress), inspect candidates / rejections / scores / social signals /
AI reasoning / sources / errors, switch TEST↔PRODUCTION, and edit scoring
weights, research instructions, diversity rules, search templates and pipeline
limits.

---

## 11. Analytics

Anonymous only (coarse daily-rotating visitor hash — no raw IP/UA stored).
Tracks card views, detail views, Buy clicks, CTR, per-category performance,
per-day popularity ranking.

**AI Trend Score** (predicted external potential) and **User Popularity**
(actual on-site behaviour) are stored and displayed **separately**.

---

## 12. Testing

```bash
npm test                # unit tests (no DB, AI mocked)
RUN_DB_TESTS=1 DATABASE_URL=postgres://.../trendfinder_test AI_PROVIDER=mock npm test
```

Covered: trend generation, AliExpress normalisation, missing AliExpress data,
duplicate/diversity rejection, fallback + 3-day limit, TEST vs PRODUCTION
affiliate URL switching, daily idempotency, price conversion, analytics, admin
auth, `computeOverall` scoring.

---

## 13. Changing things

| Want to change | Where |
|---|---|
| How the AI researches | Admin → Settings → *הוראות מחקר* (`researchInstructions`), bump `promptVersion` |
| Prompt scaffolding | `src/config/prompts.ts` |
| AliExpress search queries | Admin → Settings → `aliexpressSearchTemplates` |
| Scoring weights / overall formula | Admin → Settings → *משקלי ניקוד*; formula in `src/services/scoring/ProductScoringService.ts` |
| Diversity / similarity rules | Admin → Settings → *כללי גיוון* |
| Categories | `src/config/categories.ts` (+ Hebrew labels) |
| Candidate attempts / min score / saturation cap / fallback days | Admin → Settings |
| Currency target / provider | `.env` (`CURRENCY_DISPLAY`, `CURRENCY_PROVIDER`) |

---

## 14. Troubleshooting

| Symptom | Fix |
|---|---|
| Homepage shows "המוצרים של היום עדיין בהכנה" | No published set for today. Run `npm run generate:now` or Admin → Today → Generate. |
| Generation status `FAILED`, 0 products | Check Admin → Runs → *יומן שגיאות* + *יומני API*. Usually OpenAI key / model / `web_search` access, or no product met the data-quality gate. |
| Can't switch to PRODUCTION | Affiliate env vars missing — dashboard lists which. |
| Daily set stuck as `DRAFT` in PRODUCTION | Same — affiliate config incomplete; sets won't publish until fixed. |
| Prices show `לא זמין` | AliExpress price wasn't verifiable for that product (by design — not fabricated). |
| Worker not firing at 00:00 | Confirm `ENABLE_INPROCESS_CRON=true`, `pm2 logs trendfinder-worker`, server tz. Add the HTTP cron backup. |
| `web_search` errors from OpenAI | Use a model that supports it, or set `AI_PROVIDER=mock` temporarily. |
