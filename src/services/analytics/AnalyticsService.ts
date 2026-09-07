import { prisma } from "@/lib/db";
import { jerusalemDateString, previousDates } from "@/lib/time";

/**
 * Anonymous analytics. Two distinct concepts, stored separately:
 *   - AI Trend Score  = external / predicted trend potential (on Product)
 *   - User Popularity  = actual on-site behaviour (this service)
 */

export const AnalyticsService = {
  async recordView(productId: string, kind: "CARD" | "DETAIL", visitorHash: string) {
    const date = jerusalemDateString();
    // de-dup identical (product, kind, visitor, day) rows
    const existing = await prisma.productView.findFirst({
      where: { productId, kind, visitorHash, date },
      select: { id: true },
    });
    if (existing) return;
    await prisma.productView.create({ data: { productId, kind, visitorHash, date } });
  },

  async recordClick(productId: string, linkMode: string, visitorHash: string) {
    const date = jerusalemDateString();
    await prisma.productClick.create({
      data: { productId, linkMode, visitorHash, date },
    });
  },

  /** Per-product performance for a single day. */
  async dayReport(date: string) {
    const set = await prisma.dailyProductSet.findUnique({
      where: { date },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: { product: { select: { id: true, aeTitle: true, trendTitle: true, category: true, overallScore: true } } },
        },
      },
    });
    if (!set) return null;

    const rows = await Promise.all(
      set.items.map(async (it) => {
        const [cardViews, detailViews, clicks] = await Promise.all([
          prisma.productView.count({ where: { productId: it.productId, date, kind: "CARD" } }),
          prisma.productView.count({ where: { productId: it.productId, date, kind: "DETAIL" } }),
          prisma.productClick.count({ where: { productId: it.productId, date } }),
        ]);
        const views = cardViews + detailViews;
        return {
          productId: it.productId,
          position: it.position,
          reused: it.reused,
          title: it.product.aeTitle,
          trendTitle: it.product.trendTitle,
          category: it.product.category,
          aiOverallScore: it.product.overallScore,
          cardViews,
          detailViews,
          views,
          clicks,
          ctr: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
        };
      }),
    );

    const ranked = [...rows].sort((a, b) => b.clicks - a.clicks || b.views - a.views);
    ranked.forEach((r, i) => ((r as any).popularityRank = i + 1));

    return { date, status: set.status, rows: ranked };
  },

  /** Aggregate performance over the last N days. */
  async historyReport(days = 14) {
    const today = jerusalemDateString();
    const dates = [today, ...previousDates(today, days - 1)];
    const perDay = await Promise.all(dates.map((d) => this.dayReport(d)));
    const daily = perDay.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof this.dayReport>>>[];

    const totals = daily.reduce(
      (acc, d) => {
        for (const r of d.rows) {
          acc.views += r.views;
          acc.clicks += r.clicks;
        }
        return acc;
      },
      { views: 0, clicks: 0 },
    );

    // category performance
    const byCategory = new Map<string, { views: number; clicks: number }>();
    for (const d of daily) {
      for (const r of d.rows) {
        const c = byCategory.get(r.category) ?? { views: 0, clicks: 0 };
        c.views += r.views;
        c.clicks += r.clicks;
        byCategory.set(r.category, c);
      }
    }

    return {
      rangeDays: days,
      totals: {
        ...totals,
        ctr: totals.views > 0 ? Math.round((totals.clicks / totals.views) * 1000) / 10 : 0,
      },
      categoryPerformance: [...byCategory.entries()]
        .map(([category, v]) => ({
          category,
          ...v,
          ctr: v.views > 0 ? Math.round((v.clicks / v.views) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks),
      daily,
    };
  },
};
