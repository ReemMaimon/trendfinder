# CLAUDE.md — TrendFinder

Working notes for AI coding agents. See `README.md` for the full picture.

## What this is
Daily AI-driven **emerging** product-trend discovery. Once per day (00:00
Asia/Jerusalem) the pipeline researches trends on the web, finds matching real
AliExpress products, scores them, and publishes **3 diverse products**. The AI
never runs per request. Hebrew RTL, mobile-first public site; authenticated
admin panel.

## Commands
- `npm run dev` — app (public + admin at `/admin`)
- `npm run worker` — node-cron scheduler (separate process)
- `npm run generate:now [-- YYYY-MM-DD] [--force]` — run the pipeline once
- `npm test` — unit tests (no DB, AI mocked). `RUN_DB_TESTS=1` + a test
  `DATABASE_URL` also runs `tests/generation.integration.test.ts`.
- `npm run prisma:migrate` / `prisma:deploy` / `db:seed`
- `npm run typecheck`, `npm run build`

## Architecture rules (don't break these)
1. **TREND FIRST, PRODUCT SECOND.** The AI discovers the trend + AliExpress
   *search phrases*. It NEVER returns product URLs/images/prices (it hallucinates
   fake item ids that 404). Real products come from `aeSearch.ts`, which fetches
   the real `aliexpress.com/w/wholesale-<kw>.html` results page and parses the
   embedded `itemList` JSON. Then `TrendResearchService.pickProduct` has the AI
   choose the best *real* candidate.
2. **No AliExpress private/affiliate API for discovery.** `aeSearch.ts` scrapes
   the public search page. `AI_PROVIDER=mock` → synthetic search results (offline).
3. **No hallucinated facts.** Every stored product field is real data from the
   listing JSON. The AI may only infer viral/novelty/saturation scores.
4. **All affiliate logic lives in `AffiliateService`.** TEST → plain URL,
   PRODUCTION → affiliate link, PRODUCTION+misconfigured → throw (never a fake
   link; sets stay DRAFT).
5. **Generation is idempotent.** Never overwrite a `PUBLISHED` DailyProductSet.
   A Postgres advisory lock serialises runs.
6. **Fallback** uses only the previous 3 days, least-recently-shown first,
   marked `reused`.
7. **History is append-only** — never delete daily sets.
8. `src/lib/env.ts` is server-only. Never import it into a client component.
9. Config that operators change lives in the DB `settings` row
   (`SettingsService`), editable from `/admin/settings` — not hardcoded.

## Layout
- `src/services/*` — one folder per service (openai, trends, aliexpress,
  scoring, diversity, generation, affiliate, analytics, currency, settings,
  public). `DailyGenerationService` is the orchestrator.
- `src/config/*` — prompts, categories, default settings/zod schemas.
- `src/app/api/*` — thin route handlers; wrap with `adminRoute`/`publicRoute`.
- `src/jobs/*` — scheduler + CLI entrypoints.
- `prisma/schema.prisma` — the data model.

## Env gotcha
`ADMIN_PASSWORD_HASH` must have every `$` escaped as `\$` in `.env` (the env
loader interpolates `$`). `scripts/hash-password.ts` prints a ready line.
