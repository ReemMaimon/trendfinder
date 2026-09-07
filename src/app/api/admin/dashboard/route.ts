import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { jerusalemDateString } from "@/lib/time";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { SettingsService } from "@/services/settings/SettingsService";
import { canUseOpenAI, env } from "@/lib/env";
import { msUntilNextMidnight } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  const date = jerusalemDateString();
  const [todaySet, lastRuns, affiliate, settings, todayReport, counts] = await Promise.all([
    prisma.dailyProductSet.findUnique({
      where: { date },
      include: { items: { orderBy: { position: "asc" }, include: { product: true } } },
    }),
    prisma.generationRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    AffiliateService.status(),
    SettingsService.get(true),
    AnalyticsService.dayReport(date),
    prisma.$transaction([
      prisma.product.count(),
      prisma.dailyProductSet.count(),
      prisma.generationRun.count(),
      prisma.generationRun.count({ where: { status: "FAILED" } }),
    ]),
  ]);

  const [products, sets, runs, failedRuns] = counts;

  return json({
    today: { date, set: todaySet, report: todayReport },
    scheduler: {
      timezone: env.TIMEZONE,
      inProcessCron: env.ENABLE_INPROCESS_CRON,
      msUntilMidnight: msUntilNextMidnight(),
    },
    mode: {
      effective: affiliate.mode,
      envDefault: env.APP_MODE,
      override: settings.appModeOverride,
      affiliateConfigured: affiliate.configured,
      affiliateMissing: affiliate.missing,
    },
    ai: { provider: env.AI_PROVIDER, model: env.OPENAI_MODEL, ready: canUseOpenAI },
    lastRuns,
    counts: { products, sets, runs, failedRuns },
  });
});
