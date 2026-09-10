import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jerusalemDateString, addDays, jerusalemDayStartUtc } from "@/lib/time";
import { env } from "@/lib/env";

/**
 * Anonymous on-site analytics — every number here comes from real
 * product_views / product_clicks rows. Nothing is fabricated; empty ranges
 * return zeros.
 *
 * Two distinct concepts, kept separate:
 *   - AI Trend Score  = predicted external potential (stored on Product)
 *   - User behaviour  = this service (views / clicks / CTR / sources)
 */

export type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "all"
  | "custom";

export interface ResolvedRange {
  preset: RangePreset;
  label: string;
  fromDate: string; // YYYY-MM-DD (Jerusalem), inclusive
  toDate: string; // inclusive
  fromTs: Date; // UTC instant, inclusive
  toTs: Date; // UTC instant, exclusive
  granularity: "hour" | "day";
}

export interface RecordCtx {
  visitorHash: string;
  sessionId?: string | null;
  referrer?: string | null;
  source?: string | null;
  deviceType?: string | null;
}

const TZ = env.TIMEZONE;
const uniqExpr = Prisma.raw(`COUNT(DISTINCT COALESCE("sessionId", "visitorHash"))`);

function pct(clicks: number, views: number): number {
  return views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0;
}

export const AnalyticsService = {
  // ── recording ─────────────────────────────────────────────────────────────
  async recordView(productId: string, kind: "CARD" | "DETAIL", ctx: RecordCtx) {
    const date = jerusalemDateString();
    const existing = await prisma.productView.findFirst({
      where: { productId, kind, visitorHash: ctx.visitorHash, date },
      select: { id: true },
    });
    if (existing) return;
    await prisma.productView.create({
      data: {
        productId,
        kind,
        date,
        visitorHash: ctx.visitorHash,
        sessionId: ctx.sessionId ?? null,
        referrer: ctx.referrer?.slice(0, 500) ?? null,
        source: ctx.source ?? null,
        deviceType: ctx.deviceType ?? null,
      },
    });
  },

  async recordClick(productId: string, linkMode: string, ctx: RecordCtx) {
    await prisma.productClick.create({
      data: {
        productId,
        linkMode,
        date: jerusalemDateString(),
        visitorHash: ctx.visitorHash,
        sessionId: ctx.sessionId ?? null,
        referrer: ctx.referrer?.slice(0, 500) ?? null,
        source: ctx.source ?? null,
        deviceType: ctx.deviceType ?? null,
      },
    });
  },

  // ── range resolution ──────────────────────────────────────────────────────
  resolveRange(preset: RangePreset, from?: string, to?: string): ResolvedRange {
    const today = jerusalemDateString();
    const mk = (fromDate: string, toDate: string, granularity: "hour" | "day", label: string): ResolvedRange => ({
      preset,
      label,
      fromDate,
      toDate,
      fromTs: jerusalemDayStartUtc(fromDate),
      toTs: jerusalemDayStartUtc(addDays(toDate, 1)),
      granularity,
    });

    switch (preset) {
      case "today":
        return mk(today, today, "hour", "היום");
      case "yesterday": {
        const y = addDays(today, -1);
        return mk(y, y, "hour", "אתמול");
      }
      case "7d":
        return mk(addDays(today, -6), today, "day", "7 ימים אחרונים");
      case "30d":
        return mk(addDays(today, -29), today, "day", "30 ימים אחרונים");
      case "90d":
        return mk(addDays(today, -89), today, "day", "90 ימים אחרונים");
      case "all":
        return mk("2020-01-01", today, "day", "כל הזמן");
      case "custom": {
        const f = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : addDays(today, -6);
        const t = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : today;
        const [lo, hi] = f <= t ? [f, t] : [t, f];
        return mk(lo, hi, lo === hi ? "hour" : "day", `${lo} – ${hi}`);
      }
    }
  },

  // ── top dashboard ─────────────────────────────────────────────────────────
  async overview(r: ResolvedRange) {
    const today = jerusalemDateString();
    const [viewAgg, clickAgg, todayViews, todayClicks, topViewed, perfRows] = await Promise.all([
      prisma.$queryRaw<{ views: bigint; uniques: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS views, ${uniqExpr} AS uniques
                   FROM "product_views" WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate}`,
      ),
      prisma.productClick.count({ where: { date: { gte: r.fromDate, lte: r.toDate } } }),
      prisma.productView.count({ where: { date: today } }),
      prisma.productClick.count({ where: { date: today } }),
      prisma.$queryRaw<{ productId: string; views: bigint }[]>(
        Prisma.sql`SELECT "productId", COUNT(*) AS views FROM "product_views"
                   WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate}
                   GROUP BY "productId" ORDER BY views DESC LIMIT 1`,
      ),
      this.productRows(r),
    ]);

    const views = Number(viewAgg[0]?.views ?? 0);
    const uniqueVisitors = Number(viewAgg[0]?.uniques ?? 0);
    const buyClicks = clickAgg;

    let mostViewedProduct: { id: string; title: string; views: number } | null = null;
    if (topViewed[0]) {
      const p = await prisma.product.findUnique({ where: { id: topViewed[0].productId }, select: { trendTitle: true } });
      mostViewedProduct = { id: topViewed[0].productId, title: p?.trendTitle ?? "—", views: Number(topViewed[0].views) };
    }

    const best = [...perfRows].sort((a, b) => b.performanceScore - a.performanceScore)[0] ?? null;

    return {
      totalViews: views,
      uniqueVisitors,
      buyClicks,
      ctr: pct(buyClicks, views),
      mostViewedProduct,
      bestProduct: best
        ? { id: best.productId, title: best.trendTitle, views: best.views, clicks: best.clicks, ctr: best.ctr }
        : null,
      todayViews,
      todayClicks,
    };
  },

  // ── per-product rows for the whole range (single aggregated query) ─────────
  async productRows(r: ResolvedRange) {
    const rows = await prisma.$queryRaw<
      {
        productId: string;
        views: bigint;
        uniqueviews: bigint;
        clicks: bigint;
      }[]
    >(
      Prisma.sql`
        SELECT p.id AS "productId",
               COALESCE(v.views, 0)        AS views,
               COALESCE(v.uniqueviews, 0)  AS uniqueviews,
               COALESCE(c.clicks, 0)       AS clicks
        FROM "products" p
        LEFT JOIN (
          SELECT "productId", COUNT(*) AS views, ${uniqExpr} AS uniqueviews
          FROM "product_views" WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate}
          GROUP BY "productId"
        ) v ON v."productId" = p.id
        LEFT JOIN (
          SELECT "productId", COUNT(*) AS clicks
          FROM "product_clicks" WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate}
          GROUP BY "productId"
        ) c ON c."productId" = p.id
        WHERE COALESCE(v.views,0) > 0 OR COALESCE(c.clicks,0) > 0
      `,
    );

    const ids = rows.map((x) => x.productId);
    const products = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            trendTitle: true,
            aeTitle: true,
            category: true,
            aeImages: true,
            overallScore: true,
            viralPotentialScore: true,
            noveltyScore: true,
            trendMomentumScore: true,
            saturationScore: true,
            affiliatePotentialScore: true,
            createdAt: true,
          },
        })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p]));

    return rows.map((x) => {
      const p = pmap.get(x.productId);
      const views = Number(x.views);
      const uniqueViews = Number(x.uniqueviews);
      const clicks = Number(x.clicks);
      const ctr = pct(clicks, views);
      return {
        productId: x.productId,
        trendTitle: p?.trendTitle ?? "—",
        aeTitle: p?.aeTitle ?? "",
        category: p?.category ?? "Other",
        image: (p?.aeImages as string[] | undefined)?.[0] ?? null,
        views,
        uniqueViews,
        clicks,
        ctr,
        trendScore: p?.overallScore ?? 0,
        viralPotential: p?.viralPotentialScore ?? 0,
        noveltyScore: p?.noveltyScore ?? 0,
        trendMomentum: p?.trendMomentumScore ?? 0,
        saturationScore: p?.saturationScore ?? 0,
        affiliatePotential: p?.affiliatePotentialScore ?? 0,
        createdAt: p?.createdAt ?? null,
        // transparent internal ranking (real numbers are still shown separately).
        // CTR capped at 100 so a low-traffic outlier (e.g. 4 clicks / 2 views)
        // doesn't dominate the score.
        performanceScore: Math.round(views * 0.3 + clicks * 3 + Math.min(ctr, 100) * 2),
      };
    });
  },

  // ── time series ───────────────────────────────────────────────────────────
  async viewsSeries(r: ResolvedRange) {
    return this.series(r, "product_views", true);
  },
  async clicksSeries(r: ResolvedRange) {
    const clicks = await this.series(r, "product_clicks", false);
    const views = await this.series(r, "product_views", false);
    const vmap = new Map(views.map((v) => [v.bucket, v.count]));
    return clicks.map((c) => ({
      bucket: c.bucket,
      clicks: c.count,
      views: vmap.get(c.bucket) ?? 0,
      ctr: pct(c.count, vmap.get(c.bucket) ?? 0),
    }));
  },

  async series(r: ResolvedRange, table: "product_views" | "product_clicks", withUniques: boolean) {
    const t = Prisma.raw(`"${table}"`);
    const keyExpr =
      r.granularity === "hour"
        ? Prisma.sql`EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${TZ})::int::text`
        : Prisma.sql`to_char("createdAt" AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
    const rows = await prisma.$queryRaw<{ k: string; count: bigint; uniques: bigint | null }[]>(
      Prisma.sql`
        SELECT ${keyExpr} AS k, COUNT(*) AS count,
               ${withUniques ? uniqExpr : Prisma.raw("NULL")} AS uniques
        FROM ${t}
        WHERE "createdAt" >= ${r.fromTs} AND "createdAt" < ${r.toTs}
        GROUP BY 1
      `,
    );
    const map = new Map(
      rows.map((x) => [x.k, { count: Number(x.count), uniques: x.uniques == null ? 0 : Number(x.uniques) }]),
    );
    const out: { bucket: string; count: number; uniques: number }[] = [];
    if (r.granularity === "hour") {
      for (let h = 0; h < 24; h++) {
        const v = map.get(String(h)) ?? { count: 0, uniques: 0 };
        out.push({ bucket: `${String(h).padStart(2, "0")}:00`, ...v });
      }
    } else {
      let d = r.preset === "all" && map.size ? [...map.keys()].sort()[0] : r.fromDate;
      if (daysBetween(d, r.toDate) > 120) d = addDays(r.toDate, -120);
      while (d <= r.toDate) {
        const v = map.get(d) ?? { count: 0, uniques: 0 };
        out.push({ bucket: d, ...v });
        d = addDays(d, 1);
      }
    }
    return out;
  },

  // ── categories ────────────────────────────────────────────────────────────
  async categoryPerformance(r: ResolvedRange) {
    const rows = await this.productRows(r);
    const byCat = new Map<
      string,
      { views: number; clicks: number; products: number; trendSum: number; viralSum: number }
    >();
    for (const x of rows) {
      const c = byCat.get(x.category) ?? { views: 0, clicks: 0, products: 0, trendSum: 0, viralSum: 0 };
      c.views += x.views;
      c.clicks += x.clicks;
      c.products += 1;
      c.trendSum += x.trendScore;
      c.viralSum += x.viralPotential;
      byCat.set(x.category, c);
    }
    return [...byCat.entries()]
      .map(([category, v]) => ({
        category,
        views: v.views,
        clicks: v.clicks,
        ctr: pct(v.clicks, v.views),
        products: v.products,
        avgTrendScore: v.products ? Math.round(v.trendSum / v.products) : 0,
        avgViralPotential: v.products ? Math.round(v.viralSum / v.products) : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks || b.views - a.views);
  },

  // ── daily table ───────────────────────────────────────────────────────────
  async dailyPerformance(r: ResolvedRange) {
    const [views, clicks, sets] = await Promise.all([
      prisma.$queryRaw<{ date: string; c: bigint }[]>(
        Prisma.sql`SELECT "date", COUNT(*) AS c FROM "product_views"
                   WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate} GROUP BY "date"`,
      ),
      prisma.$queryRaw<{ date: string; c: bigint }[]>(
        Prisma.sql`SELECT "date", COUNT(*) AS c FROM "product_clicks"
                   WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate} GROUP BY "date"`,
      ),
      prisma.dailyProductSet.findMany({
        where: { date: { gte: r.fromDate, lte: r.toDate } },
        select: { date: true, _count: { select: { items: true } } },
      }),
    ]);
    const vmap = new Map(views.map((x) => [x.date, Number(x.c)]));
    const cmap = new Map(clicks.map((x) => [x.date, Number(x.c)]));
    const smap = new Map(sets.map((x) => [x.date, x._count.items]));

    const out: { date: string; products: number; views: number; clicks: number; ctr: number }[] = [];
    let d = r.toDate;
    const stop = r.preset === "all" ? (vmap.size ? [...vmap.keys()].sort()[0] : r.toDate) : r.fromDate;
    while (d >= stop) {
      const v = vmap.get(d) ?? 0;
      const c = cmap.get(d) ?? 0;
      if (r.preset === "all" && v === 0 && c === 0 && !smap.has(d)) {
        d = addDays(d, -1);
        continue;
      }
      out.push({ date: d, products: smap.get(d) ?? 0, views: v, clicks: c, ctr: pct(c, v) });
      d = addDays(d, -1);
    }
    return out;
  },

  // ── traffic sources ───────────────────────────────────────────────────────
  async trafficSources(r: ResolvedRange) {
    const rows = await prisma.$queryRaw<
      { source: string | null; views: bigint; visitors: bigint }[]
    >(
      Prisma.sql`SELECT COALESCE("source", 'direct') AS source, COUNT(*) AS views, ${uniqExpr} AS visitors
                 FROM "product_views" WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate}
                 GROUP BY 1`,
    );
    const clickRows = await prisma.$queryRaw<{ source: string | null; clicks: bigint }[]>(
      Prisma.sql`SELECT COALESCE("source", 'direct') AS source, COUNT(*) AS clicks
                 FROM "product_clicks" WHERE "date" >= ${r.fromDate} AND "date" <= ${r.toDate} GROUP BY 1`,
    );
    const cmap = new Map(clickRows.map((x) => [x.source ?? "direct", Number(x.clicks)]));
    return rows
      .map((x) => {
        const source = x.source ?? "direct";
        const views = Number(x.views);
        const clicks = cmap.get(source) ?? 0;
        return { source, views, visitors: Number(x.visitors), clicks, ctr: pct(clicks, views) };
      })
      .sort((a, b) => b.views - a.views);
  },

  // ── WhatsApp (traffic-based; there is no per-product WhatsApp publish system) ──
  async whatsappStats(r: ResolvedRange) {
    const sources = await this.trafficSources(r);
    const wa = sources.find((s) => s.source === "whatsapp") ?? { source: "whatsapp", views: 0, visitors: 0, clicks: 0, ctr: 0 };
    const rows = await prisma.$queryRaw<{ productId: string; views: bigint; clicks: bigint }[]>(
      Prisma.sql`
        SELECT p.id AS "productId", COALESCE(v.c,0) AS views, COALESCE(c.c,0) AS clicks
        FROM "products" p
        LEFT JOIN (SELECT "productId", COUNT(*) c FROM "product_views"
                   WHERE "source"='whatsapp' AND "date" >= ${r.fromDate} AND "date" <= ${r.toDate} GROUP BY 1) v ON v."productId"=p.id
        LEFT JOIN (SELECT "productId", COUNT(*) c FROM "product_clicks"
                   WHERE "source"='whatsapp' AND "date" >= ${r.fromDate} AND "date" <= ${r.toDate} GROUP BY 1) c ON c."productId"=p.id
        WHERE COALESCE(v.c,0) > 0 OR COALESCE(c.c,0) > 0
        ORDER BY views DESC`,
    );
    const ids = rows.map((x) => x.productId);
    const products = ids.length
      ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, trendTitle: true } })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p.trendTitle]));
    return {
      totals: wa,
      products: rows.map((x) => {
        const views = Number(x.views);
        const clicks = Number(x.clicks);
        return { productId: x.productId, title: pmap.get(x.productId) ?? "—", views, clicks, ctr: pct(clicks, views) };
      }),
    };
  },

  // ── full bundle for the stats page ────────────────────────────────────────
  async bundle(r: ResolvedRange) {
    const [overview, viewsSeries, clicksSeries, products, categories, daily, sources, whatsapp] =
      await Promise.all([
        this.overview(r),
        this.viewsSeries(r),
        this.clicksSeries(r),
        this.productRows(r),
        this.categoryPerformance(r),
        this.dailyPerformance(r),
        this.trafficSources(r),
        this.whatsappStats(r),
      ]);
    return {
      range: { preset: r.preset, label: r.label, fromDate: r.fromDate, toDate: r.toDate, granularity: r.granularity },
      overview,
      viewsSeries,
      clicksSeries,
      products: products.sort((a, b) => b.views - a.views),
      categories,
      daily,
      sources,
      whatsapp,
    };
  },

  // ── single-product detail ─────────────────────────────────────────────────
  async productStats(productId: string, r: ResolvedRange) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { dailyItems: { include: { set: true } } },
    });
    if (!product) return null;

    const keyExpr =
      r.granularity === "hour"
        ? Prisma.sql`EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${TZ})::int::text`
        : Prisma.sql`to_char("createdAt" AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
    const [agg, clicks, viewSeries, clickSeries] = await Promise.all([
      prisma.$queryRaw<{ views: bigint; uniques: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS views, ${uniqExpr} AS uniques FROM "product_views"
                   WHERE "productId" = ${productId} AND "date" >= ${r.fromDate} AND "date" <= ${r.toDate}`,
      ),
      prisma.productClick.count({ where: { productId, date: { gte: r.fromDate, lte: r.toDate } } }),
      prisma.$queryRaw<{ k: string; views: bigint }[]>(
        Prisma.sql`SELECT ${keyExpr} AS k, COUNT(*) AS views FROM "product_views"
                   WHERE "productId" = ${productId} AND "createdAt" >= ${r.fromTs} AND "createdAt" < ${r.toTs} GROUP BY 1`,
      ),
      prisma.$queryRaw<{ k: string; clicks: bigint }[]>(
        Prisma.sql`SELECT ${keyExpr} AS k, COUNT(*) AS clicks FROM "product_clicks"
                   WHERE "productId" = ${productId} AND "createdAt" >= ${r.fromTs} AND "createdAt" < ${r.toTs} GROUP BY 1`,
      ),
    ]);

    const views = Number(agg[0]?.views ?? 0);
    const uniqueViews = Number(agg[0]?.uniques ?? 0);

    const shownDates = product.dailyItems
      .filter((di) => di.set.status === "PUBLISHED")
      .map((di) => di.set.date)
      .sort();
    const firstShown = shownDates[0] ?? null;
    const lastShown = shownDates[shownDates.length - 1] ?? null;
    const activeDays = firstShown
      ? daysBetween(firstShown, lastShown ?? jerusalemDateString()) + 1
      : 0;

    const vmap = new Map(viewSeries.map((x) => [x.k, Number(x.views)]));
    const cmap = new Map(clickSeries.map((x) => [x.k, Number(x.clicks)]));
    const combined: { bucket: string; views: number; clicks: number }[] = [];
    if (r.granularity === "hour") {
      for (let h = 0; h < 24; h++) {
        combined.push({
          bucket: `${String(h).padStart(2, "0")}:00`,
          views: vmap.get(String(h)) ?? 0,
          clicks: cmap.get(String(h)) ?? 0,
        });
      }
    } else {
      const keys = [...new Set([...vmap.keys(), ...cmap.keys()])].sort();
      let d = r.preset === "all" && keys.length ? keys[0] : r.fromDate;
      // cap the number of daily points so "all" stays reasonable
      if (daysBetween(d, r.toDate) > 120) d = addDays(r.toDate, -120);
      while (d <= r.toDate) {
        combined.push({ bucket: d, views: vmap.get(d) ?? 0, clicks: cmap.get(d) ?? 0 });
        d = addDays(d, 1);
      }
    }

    return {
      product: {
        id: product.id,
        trendTitle: product.trendTitle,
        aeTitle: product.aeTitle,
        slug: product.slug,
        image: (product.aeImages as string[])?.[0] ?? null,
        category: product.category,
        trendScore: product.overallScore,
        viralPotential: product.viralPotentialScore,
        noveltyScore: product.noveltyScore,
        trendMomentum: product.trendMomentumScore,
        saturationScore: product.saturationScore,
        affiliatePotential: product.affiliatePotentialScore,
        createdAt: product.createdAt,
      },
      views,
      uniqueViews,
      clicks,
      ctr: pct(clicks, views),
      avgTimeOnPage: null as number | null, // not collected — shown as "לא נאסף"
      firstShown,
      lastShown,
      activeDays,
      shownDates,
      series: combined,
    };
  },

  // ── CSV export ────────────────────────────────────────────────────────────
  async exportCsv(r: ResolvedRange): Promise<string> {
    const rows = (await this.productRows(r)).sort((a, b) => b.views - a.views);
    const head = [
      "Product",
      "Category",
      "Views",
      "Unique Views",
      "Buy Clicks",
      "CTR %",
      "Trend Score",
      "Viral Potential",
      "Novelty",
      "Momentum",
      "Saturation",
      "Created",
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((x) =>
      [
        x.trendTitle,
        x.category,
        x.views,
        x.uniqueViews,
        x.clicks,
        x.ctr,
        x.trendScore,
        x.viralPotential,
        x.noveltyScore,
        x.trendMomentum,
        x.saturationScore,
        x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : "",
      ]
        .map(esc)
        .join(","),
    );
    return [`# TrendFinder statistics ${r.fromDate} .. ${r.toDate}`, head.join(","), ...lines].join("\n");
  },

  // ── kept for the admin dashboard ("today's products" widget) ──────────────
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
        const [views, clicks] = await Promise.all([
          prisma.productView.count({ where: { productId: it.productId, date } }),
          prisma.productClick.count({ where: { productId: it.productId, date } }),
        ]);
        return {
          productId: it.productId,
          position: it.position,
          reused: it.reused,
          title: it.product.aeTitle,
          trendTitle: it.product.trendTitle,
          category: it.product.category,
          aiOverallScore: it.product.overallScore,
          views,
          clicks,
          ctr: pct(clicks, views),
        };
      }),
    );
    const ranked = [...rows].sort((a, b) => b.clicks - a.clicks || b.views - a.views);
    ranked.forEach((x, i) => ((x as any).popularityRank = i + 1));
    return { date, status: set.status, rows: ranked };
  },
};

// ── helpers ─────────────────────────────────────────────────────────────────
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
