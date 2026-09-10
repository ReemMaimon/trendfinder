/**
 * End-to-end pipeline tests against a real PostgreSQL database.
 *
 * These are SKIPPED unless RUN_DB_TESTS=1 and a DATABASE_URL pointing at a
 * disposable test database are set. Run them with:
 *
 *   createdb trendfinder_test
 *   DATABASE_URL=postgres://.../trendfinder_test npm run prisma:deploy
 *   RUN_DB_TESTS=1 DATABASE_URL=postgres://.../trendfinder_test AI_PROVIDER=mock npm test
 *
 * Covers: daily idempotency, TEST-mode publishing, 3 distinct products,
 * fallback + 3-day limit, analytics accumulation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const ENABLED = process.env.RUN_DB_TESTS === "1";
const d = ENABLED ? describe : describe.skip;

d("DailyGenerationService (mock AI, TEST mode)", () => {
  let prisma: import("@prisma/client").PrismaClient;
  let DailyGenerationService: typeof import("@/services/generation/DailyGenerationService").DailyGenerationService;
  let AnalyticsService: typeof import("@/services/analytics/AnalyticsService").AnalyticsService;

  beforeAll(async () => {
    process.env.AI_PROVIDER = "mock";
    process.env.APP_MODE = "TEST";
    ({ prisma } = await import("@/lib/db"));
    ({ DailyGenerationService } = await import("@/services/generation/DailyGenerationService"));
    ({ AnalyticsService } = await import("@/services/analytics/AnalyticsService"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // wipe in FK-safe order
    await prisma.productClick.deleteMany();
    await prisma.productView.deleteMany();
    await prisma.dailyProductItem.deleteMany();
    await prisma.dailyProductSet.deleteMany();
    await prisma.trendSource.deleteMany();
    await prisma.generationCandidate.deleteMany();
    await prisma.productTrendReport.deleteMany();
    await prisma.apiLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.generationRun.deleteMany();
  });

  it("publishes exactly 3 distinct products and is idempotent", async () => {
    const date = "2026-09-07";
    const first = await DailyGenerationService.generate({ targetDate: date, trigger: "MANUAL" });
    expect(first.published).toBe(true);
    expect(first.newProducts + first.fallbackProducts).toBe(3);

    const set = await prisma.dailyProductSet.findUnique({
      where: { date },
      include: { items: { include: { product: true } } },
    });
    expect(set?.status).toBe("PUBLISHED");
    expect(set?.items).toHaveLength(3);
    const categories = new Set(set!.items.map((i) => i.product.category));
    expect(categories.size).toBe(3); // distinct categories enforced

    // second run must not create a new set
    const runsBefore = await prisma.generationRun.count();
    const second = await DailyGenerationService.generate({ targetDate: date, trigger: "SCHEDULER" });
    expect(second.message).toMatch(/idempotent/i);
    const setsForDate = await prisma.dailyProductSet.count({ where: { date } });
    expect(setsForDate).toBe(1);
    expect(await prisma.generationRun.count()).toBe(runsBefore); // no new run row
  });

  it("uses fallback products from the previous 3 days when new discovery is short", async () => {
    // day 1: full set
    await DailyGenerationService.generate({ targetDate: "2026-09-04", trigger: "MANUAL" });

    // force day 2 discovery to fail by setting maxCandidates very low via settings
    const { SettingsService } = await import("@/services/settings/SettingsService");
    await SettingsService.update({ maxCandidates: 0, fallbackLookbackDays: 3 });

    const res = await DailyGenerationService.generate({ targetDate: "2026-09-05", trigger: "MANUAL" });
    expect(res.newProducts).toBe(0);
    expect(res.fallbackProducts).toBeGreaterThan(0);

    const set = await prisma.dailyProductSet.findUnique({
      where: { date: "2026-09-05" },
      include: { items: true },
    });
    expect(set!.items.every((i) => i.reused)).toBe(true);
    expect(set!.items.every((i) => i.reusedFromDate === "2026-09-04")).toBe(true);

    await SettingsService.update({ maxCandidates: 20 });
  });

  it("does not reuse products older than 3 days", async () => {
    await DailyGenerationService.generate({ targetDate: "2026-09-01", trigger: "MANUAL" });
    const { SettingsService } = await import("@/services/settings/SettingsService");
    await SettingsService.update({ maxCandidates: 0 });
    const res = await DailyGenerationService.generate({ targetDate: "2026-09-05", trigger: "MANUAL" });
    // 2026-09-01 is 4 days before 2026-09-05 -> out of the 3-day window
    expect(res.fallbackProducts).toBe(0);
    expect(res.status).toBe("FAILED");
    await SettingsService.update({ maxCandidates: 20 });
  });

  it("accumulates anonymous analytics separately from AI scores", async () => {
    const date = "2026-09-07";
    await DailyGenerationService.generate({ targetDate: date, trigger: "MANUAL" });
    const set = await prisma.dailyProductSet.findUnique({ where: { date }, include: { items: true } });
    const pid = set!.items[0].productId;

    await AnalyticsService.recordView(pid, "CARD", { visitorHash: "visitor-a", sessionId: "sa", source: "whatsapp" });
    await AnalyticsService.recordView(pid, "CARD", { visitorHash: "visitor-a", sessionId: "sa" }); // de-duped
    await AnalyticsService.recordView(pid, "DETAIL", { visitorHash: "visitor-b", sessionId: "sb", source: "google" });
    await AnalyticsService.recordClick(pid, "test", { visitorHash: "visitor-b", sessionId: "sb", source: "whatsapp" });

    const report = await AnalyticsService.dayReport(date);
    const row = report!.rows.find((r) => r.productId === pid)!;
    expect(row.views).toBe(2);
    expect(row.clicks).toBe(1);
    expect(row.ctr).toBe(50);

    // range-based bundle uses the same real rows
    const range = AnalyticsService.resolveRange("all");
    const bundle = await AnalyticsService.bundle(range);
    expect(bundle.overview.totalViews).toBeGreaterThanOrEqual(2);
    expect(bundle.overview.buyClicks).toBeGreaterThanOrEqual(1);
    expect(bundle.sources.some((s) => s.source === "whatsapp")).toBe(true);
    const prod = bundle.products.find((p) => p.productId === pid)!;
    expect(prod.views).toBe(2);
    expect(prod.clicks).toBe(1);
  });
});
