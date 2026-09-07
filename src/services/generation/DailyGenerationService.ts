import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { jerusalemDateString, previousDates } from "@/lib/time";
import { makeSlug } from "@/lib/slug";
import { GenerationError } from "@/lib/errors";
import { SettingsService } from "@/services/settings/SettingsService";
import { TrendResearchService } from "@/services/trends/TrendResearchService";
import { AliExpressResearchService } from "@/services/aliexpress/AliExpressResearchService";
import { ProductScoringService } from "@/services/scoring/ProductScoringService";
import { DiversityService, type DiversityItem } from "@/services/diversity/DiversityService";
import { CurrencyService } from "@/services/currency/CurrencyService";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { getAIProvider, extractJson } from "@/services/openai/OpenAIService";
import { hebrewCopySchema } from "@/services/types";
import { hebrewExplanationPrompt, type PreviousProductContext } from "@/config/prompts";
import { normalizeCategory } from "@/config/categories";
import type { RunTrigger } from "@prisma/client";
import { env } from "@/lib/env";

const ADVISORY_LOCK_KEY = 918273645; // arbitrary constant for generation lock

export interface ProgressEvent {
  step: string;
  detail?: string;
  at: string;
}

export interface GenerationResult {
  runId: string;
  targetDate: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  newProducts: number;
  fallbackProducts: number;
  published: boolean;
  setId: string | null;
  message: string;
}

type ProgressFn = (e: ProgressEvent) => void;

async function withAdvisoryLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
  if (!rows[0]?.locked) {
    logger.warn("generation advisory lock is held — another run is in progress");
    return null;
  }
  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}

async function loadPreviousContext(
  targetDate: string,
  days: number,
): Promise<PreviousProductContext[]> {
  const dates = previousDates(targetDate, Math.max(3, days));
  const items = await prisma.dailyProductItem.findMany({
    where: { set: { date: { in: dates } } },
    include: { set: true, product: true },
    orderBy: [{ set: { date: "desc" } }, { position: "asc" }],
  });
  return items.map((it) => ({
    date: it.set.date,
    trendTitle: it.product.trendTitle,
    aeTitle: it.product.aeTitle,
    category: it.product.category,
    aeUrl: it.product.aeUrl,
    aeProductId: it.product.aeProductId,
    trendDescription: it.product.trendDescription,
    scores: {
      overall: it.product.overallScore,
      viral: it.product.viralPotentialScore,
      novelty: it.product.noveltyScore,
      saturation: it.product.saturationScore,
    },
  }));
}

async function loadDiversityHistory(
  targetDate: string,
  lookbackDays: number,
): Promise<DiversityItem[]> {
  const dates = previousDates(targetDate, lookbackDays);
  const items = await prisma.dailyProductItem.findMany({
    where: { set: { date: { in: dates } } },
    include: { product: true },
  });
  return items.map((it) => ({
    title: it.product.aeTitle,
    trendTitle: it.product.trendTitle,
    trendDescription: it.product.trendDescription,
    category: it.product.category,
    aeProductId: it.product.aeProductId,
  }));
}

async function hebrewCopyFor(
  research: any,
  product: { aeTitle: string },
  scores: any,
  runId: string,
): Promise<{ explanationHe: string; overallReasoningHe: string }> {
  const ai = await getAIProvider();
  try {
    const res = await ai.generate({
      system: hebrewExplanationPrompt(),
      user: JSON.stringify({ trend: research.trend, product: { title: product.aeTitle }, scores, socialSignals: research.socialSignals }),
      light: true,
      operation: "copy.hebrew",
      runId,
      maxOutputTokens: 700,
    });
    return hebrewCopySchema.parse(extractJson(res.text));
  } catch (err) {
    logger.warn({ err }, "hebrew copy generation failed, using template");
    return {
      explanationHe:
        "מוצר שמתחיל לצבור עניין במקורות שונים ובסרטוני וידאו קצרים, אך עדיין אינו נפוץ בכל מקום — ולכן קיבל ציון גבוה בפוטנציאל הוויראלי.",
      overallReasoningHe: "האותות החברתיים מצביעים על מגמת עלייה מוקדמת בכמה פלטפורמות.",
    };
  }
}

export const DailyGenerationService = {
  /**
   * Run the full discovery pipeline for a target date. Idempotent: if a
   * PUBLISHED set already exists for the date, it is returned untouched.
   */
  async generate(params: {
    targetDate?: string;
    trigger: RunTrigger;
    force?: boolean;
    onProgress?: ProgressFn;
  }): Promise<GenerationResult> {
    const targetDate = params.targetDate ?? jerusalemDateString();
    const progress: ProgressFn = (e) => {
      logger.info({ step: e.step, detail: e.detail }, "generation progress");
      params.onProgress?.(e);
    };
    const emit = (step: string, detail?: string) =>
      progress({ step, detail, at: new Date().toISOString() });

    const locked = await withAdvisoryLock(() =>
      runPipeline(targetDate, params.trigger, Boolean(params.force), emit),
    );

    if (locked === null) {
      return {
        runId: "",
        targetDate,
        status: "FAILED",
        newProducts: 0,
        fallbackProducts: 0,
        published: false,
        setId: null,
        message: "Another generation run is already in progress.",
      };
    }
    return locked;
  },
};

async function runPipeline(
  targetDate: string,
  trigger: RunTrigger,
  force: boolean,
  emit: (step: string, detail?: string) => void,
): Promise<GenerationResult> {
    // ---- idempotency --------------------------------------------------------
    const existing = await prisma.dailyProductSet.findUnique({
      where: { date: targetDate },
      include: { items: true },
    });
    if (existing && existing.status === "PUBLISHED" && !force) {
      emit("idempotent-skip", `A published set for ${targetDate} already exists.`);
      return {
        runId: existing.generationRunId ?? "",
        targetDate,
        status: "SUCCESS",
        newProducts: existing.items.filter((i) => !i.reused).length,
        fallbackProducts: existing.items.filter((i) => i.reused).length,
        published: true,
        setId: existing.id,
        message: "Already published — no action taken (idempotent).",
      };
    }

    const settings = await SettingsService.get(true);
    const mode = await SettingsService.getAppMode();

    const run = await prisma.generationRun.create({
      data: {
        targetDate,
        trigger,
        status: "RUNNING",
        mode,
        aiModel: env.AI_PROVIDER === "mock" ? "mock-1" : env.OPENAI_MODEL,
        promptVersion: settings.promptVersion,
        searchedTopics: [],
      },
    });
    emit("run-started", `run ${run.id} for ${targetDate} in ${mode} mode`);

    const errorLog: { step: string; message: string; at: string }[] = [];
    const searchedTopics: string[] = [];
    const acceptedProductIds: string[] = [];
    const acceptedDiversity: DiversityItem[] = [];
    const avoidTrendTitles: string[] = [];

    try {
      const previous = await loadPreviousContext(
        targetDate,
        settings.diversityRules.historyLookbackDays,
      );
      const history = await loadDiversityHistory(
        targetDate,
        settings.diversityRules.historyLookbackDays,
      );

      let attempt = 0;
      let candidateOrder = 0;

      while (acceptedProductIds.length < 3 && attempt < settings.maxCandidates) {
        attempt++;
        candidateOrder++;
        emit("research", `attempt ${attempt}/${settings.maxCandidates}`);

        // ---- 1. AI: discover the emerging trend + AliExpress search phrases
        const attemptRes = await TrendResearchService.researchTrend({
          settings,
          targetDate,
          previous,
          avoidTrendTitles,
          alreadyAcceptedCategories: acceptedDiversity.map((d) => normalizeCategory(d.category)),
          runId: run.id,
        });

        if (attemptRes.parseError || !attemptRes.research) {
          await prisma.generationCandidate.create({
            data: {
              runId: run.id,
              order: candidateOrder,
              trendTitle: "(unparseable AI response)",
              trendDescription: attemptRes.parseError ?? "no research returned",
              status: "REJECTED_OTHER",
              rejectionReason: attemptRes.parseError ?? "AI returned nothing usable",
              rawResearch: { rawText: attemptRes.rawText.slice(0, 4000) },
            },
          });
          errorLog.push({ step: "research", message: attemptRes.parseError ?? "no research", at: new Date().toISOString() });
          continue;
        }

        const r = attemptRes.research;
        const category = normalizeCategory(r.trend.category);
        avoidTrendTitles.push(r.trend.title);
        searchedTopics.push(...r.searchQueries, r.trend.title);

        await persistSources(run.id, null, [
          ...r.sources,
          ...attemptRes.webSources.map((s) => ({
            url: s.url,
            title: s.title ?? null,
            sourceType: "web" as const,
            supports: "trend" as const,
            relevance: "surfaced by web_search",
          })),
        ]);

        const baseCandidateData: Record<string, unknown> = {
          runId: run.id,
          order: candidateOrder,
          trendTitle: r.trend.title,
          trendDescription: r.trend.description,
          category,
          socialSignals: r.socialSignals as any,
          rawResearch: { research: r, searchQueries: r.searchQueries } as any,
        };

        // ---- 2. REAL AliExpress search (code, not the LLM)
        emit("aliexpress", `searching AliExpress: ${r.searchQueries.slice(0, 3).join(" / ")}`);
        const excludeIds = new Set<string>([
          ...(history.map((h) => h.aeProductId).filter(Boolean) as string[]),
          ...(acceptedDiversity.map((d) => d.aeProductId).filter(Boolean) as string[]),
        ]);
        const { searches, candidates } = await AliExpressResearchService.gatherCandidates(
          r.searchQueries,
          { excludeProductIds: excludeIds },
        );
        (baseCandidateData.rawResearch as any).aeSearches = searches.map((s) => ({
          query: s.query,
          count: s.results.length,
        }));

        if (candidates.length === 0) {
          await prisma.generationCandidate.create({
            data: {
              ...(baseCandidateData as any),
              status: "REJECTED_NO_PRODUCT",
              rejectionReason: `AliExpress search returned no usable products for: ${r.searchQueries.join(", ")}`,
            },
          });
          emit("reject", `no AliExpress products for "${r.trend.title}"`);
          continue;
        }

        // ---- 3. AI: pick the best REAL product for the trend
        const pick = await TrendResearchService.pickProduct({
          trend: r.trend,
          candidates,
          runId: run.id,
        });
        const chosen = pick.chosenProductId
          ? candidates.find((c) => c.productId === pick.chosenProductId)
          : null;
        if (!chosen) {
          await prisma.generationCandidate.create({
            data: {
              ...(baseCandidateData as any),
              status: "REJECTED_NO_PRODUCT",
              rejectionReason: pick.rejectionReason ?? "no candidate matched the trend well enough",
            },
          });
          emit("reject", `no matching product for "${r.trend.title}"`);
          continue;
        }

        const rp = AliExpressResearchService.toRealProduct(chosen);
        Object.assign(baseCandidateData, {
          aeUrl: rp.aeUrl,
          aeProductId: rp.aeProductId,
          aeTitle: rp.aeTitle,
          aeImages: rp.aeImages as any,
          aeRating: rp.aeRating,
          aeOrders: rp.aeOrders,
          priceOriginal: rp.priceOriginal,
          currencyOriginal: rp.currencyOriginal,
        });

        const quality = AliExpressResearchService.qualityCheck(rp);
        if (!quality.ok) {
          await prisma.generationCandidate.create({
            data: { ...(baseCandidateData as any), status: "REJECTED_DATA_QUALITY", rejectionReason: quality.reason },
          });
          emit("reject", `data quality: ${quality.reason}`);
          continue;
        }
        if (pick.relevance < 45) {
          await prisma.generationCandidate.create({
            data: {
              ...(baseCandidateData as any),
              status: "REJECTED_OTHER",
              rejectionReason: `product relevance ${pick.relevance} too low — ${pick.reasoning}`,
            },
          });
          emit("reject", `low relevance (${pick.relevance})`);
          continue;
        }

        // ---- 4. scoring
        emit("scoring", `scoring "${r.trend.title}"`);
        const scored = await ProductScoringService.score(
          { trend: r.trend, product: rp, socialSignals: r.socialSignals, selfAssessment: r.selfAssessment },
          settings.scoringWeights,
          run.id,
        );

        if (scored.saturationScore > settings.maxSaturationScore) {
          await prisma.generationCandidate.create({
            data: { ...(baseCandidateData as any), scores: scored as any, status: "REJECTED_SATURATED", rejectionReason: `saturation ${scored.saturationScore} > max ${settings.maxSaturationScore}` },
          });
          emit("reject", `saturated (${scored.saturationScore})`);
          continue;
        }
        if (scored.overallScore < settings.minOverallScore) {
          await prisma.generationCandidate.create({
            data: { ...(baseCandidateData as any), scores: scored as any, status: "REJECTED_LOW_SCORE", rejectionReason: `overall ${scored.overallScore} < min ${settings.minOverallScore}` },
          });
          emit("reject", `low score (${scored.overallScore})`);
          continue;
        }

        // ---- 5. diversity + duplicate
        const divItem: DiversityItem = {
          title: rp.aeTitle,
          trendTitle: r.trend.title,
          trendDescription: r.trend.description,
          category,
          aeProductId: rp.aeProductId,
        };
        const div = DiversityService.evaluate(divItem, acceptedDiversity, history, settings.diversityRules);
        if (!div.ok) {
          await prisma.generationCandidate.create({
            data: { ...(baseCandidateData as any), scores: scored as any, status: div.status, rejectionReason: div.reason },
          });
          emit("reject", div.reason);
          continue;
        }

        // ---- 6. ACCEPT
        emit("accept", `"${r.trend.title}" -> ${rp.aeTitle} (${acceptedProductIds.length + 1}/3)`);
        const fx = await CurrencyService.toDisplay({
          priceOriginal: rp.priceOriginal,
          currencyOriginal: rp.currencyOriginal,
          priceShipping: null,
          shippingVerified: false,
        });
        const copy = await hebrewCopyFor(r, rp, scored, run.id);

        const product = await prisma.product.create({
          data: {
            trendTitle: r.trend.title,
            trendDescription: r.trend.description,
            category,
            slug: makeSlug(r.trend.title, `${targetDate}-${run.id}-${candidateOrder}`),
            aeTitle: rp.aeTitle,
            aeDescription: null,
            aeUrl: rp.aeUrl,
            aeProductId: rp.aeProductId,
            aeStoreName: rp.aeStoreName,
            aeImages: rp.aeImages as any,
            aeRating: rp.aeRating,
            aeOrders: rp.aeOrders,
            aeVariants: undefined,
            priceOriginal: rp.priceOriginal,
            currencyOriginal: rp.currencyOriginal,
            priceShipping: null,
            shippingVerified: false,
            priceIls: fx.priceIls,
            priceIlsTotal: fx.priceIlsTotal,
            fxRateUsed: fx.fxRateUsed,
            fxAsOf: fx.fxAsOf,
            dataConfidence: {
              ...rp.dataConfidence,
              pickRelevance: pick.relevance,
              pickReasoning: pick.reasoning,
            } as any,
            viralPotentialScore: scored.viralPotentialScore,
            affiliatePotentialScore: scored.affiliatePotentialScore,
            noveltyScore: scored.noveltyScore,
            trendMomentumScore: scored.trendMomentumScore,
            saturationScore: scored.saturationScore,
            overallScore: scored.overallScore,
            explanationHe: copy.explanationHe,
            generationRunId: run.id,
            origin: "AI",
            trendReport: {
              create: {
                tiktokLevel: r.socialSignals.tiktok.level,
                tiktokReasoning: r.socialSignals.tiktok.reasoning,
                instagramLevel: r.socialSignals.instagram.level,
                instagramReasoning: r.socialSignals.instagram.reasoning,
                youtubeLevel: r.socialSignals.youtube.level,
                youtubeReasoning: r.socialSignals.youtube.reasoning,
                googleTrendsLevel: r.socialSignals.googleTrends.level,
                googleTrendsReasoning: r.socialSignals.googleTrends.reasoning,
                verifiedMetrics: (r.socialSignals.verifiedMetrics ?? undefined) as any,
                overallReasoningHe: copy.overallReasoningHe,
              },
            },
          },
        });

        await persistSources(run.id, product.id, r.sources);
        await prisma.generationCandidate.create({
          data: { ...(baseCandidateData as any), scores: scored as any, status: "ACCEPTED", productId: product.id },
        });

        acceptedProductIds.push(product.id);
        acceptedDiversity.push(divItem);
      }

      // ---- fallback ------------------------------------------------------
      let fallbackCount = 0;
      if (acceptedProductIds.length < 3) {
        emit("fallback", `only ${acceptedProductIds.length} new products — attempting fallback`);
        const needed = 3 - acceptedProductIds.length;
        const fallbackProducts = await pickFallbackProducts(
          targetDate,
          settings.fallbackLookbackDays,
          acceptedProductIds,
          needed,
        );
        for (const fp of fallbackProducts) {
          acceptedProductIds.push(fp.id);
          fallbackCount++;
        }
        if (fallbackProducts.length < needed) {
          errorLog.push({
            step: "fallback",
            message: `could only backfill ${fallbackProducts.length}/${needed} from the last ${settings.fallbackLookbackDays} days`,
            at: new Date().toISOString(),
          });
        }
      }

      const total = acceptedProductIds.length;
      const newCount = total - fallbackCount;

      // ---- production safety gate -------------------------------------
      let published = false;
      let setStatus: "PUBLISHED" | "DRAFT" = "DRAFT";
      if (mode === "PRODUCTION") {
        try {
          await AffiliateService.assertProductionReady();
        } catch (err) {
          errorLog.push({
            step: "publish",
            message: `PRODUCTION mode but affiliate config incomplete: ${(err as Error).message}. Set kept as DRAFT.`,
            at: new Date().toISOString(),
          });
          emit("publish-blocked", (err as Error).message);
        }
      }

      const affiliateStatus = await AffiliateService.status();
      const canPublish =
        total >= 1 && (mode === "TEST" || affiliateStatus.configured);

      // ---- create / upsert the daily set (never overwrite a PUBLISHED one)
      const fallbackMeta = await buildItemsMeta(acceptedProductIds, targetDate, fallbackCount);

      let setId: string | null = null;
      if (total >= 1) {
        const set = await prisma.$transaction(async (tx) => {
          const current = await tx.dailyProductSet.findUnique({
            where: { date: targetDate },
            include: { items: true },
          });
          if (current?.status === "PUBLISHED" && !force) {
            return current;
          }
          if (current) {
            await tx.dailyProductItem.deleteMany({ where: { setId: current.id } });
          }
          if (canPublish) {
            published = true;
            setStatus = "PUBLISHED";
          }
          const upserted = await tx.dailyProductSet.upsert({
            where: { date: targetDate },
            create: {
              date: targetDate,
              status: setStatus,
              publishedAt: setStatus === "PUBLISHED" ? new Date() : null,
              generationRunId: run.id,
            },
            update: {
              status: setStatus,
              publishedAt: setStatus === "PUBLISHED" ? new Date() : null,
              generationRunId: run.id,
            },
          });
          await tx.dailyProductItem.createMany({
            data: fallbackMeta.map((m) => ({
              setId: upserted.id,
              productId: m.productId,
              position: m.position,
              reused: m.reused,
              reusedFromDate: m.reusedFromDate,
            })),
          });
          return upserted;
        });
        setId = set.id;
      }

      const status: GenerationResult["status"] =
        newCount >= 3 ? "SUCCESS" : total >= 1 ? "PARTIAL" : "FAILED";

      await prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: status === "SUCCESS" ? "SUCCESS" : status === "PARTIAL" ? "PARTIAL" : "FAILED",
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime(),
          searchedTopics: Array.from(new Set(searchedTopics)).slice(0, 100),
          errorLog: errorLog as any,
          stats: {
            attempts: Math.min(settings.maxCandidates, candidateOrder),
            accepted: newCount,
            fallbackUsed: fallbackCount,
            totalPublished: total,
          } as any,
          summary: `${newCount} new + ${fallbackCount} fallback = ${total} products for ${targetDate}. ${published ? "Published." : "Kept as DRAFT."}`,
        },
      });

      emit("done", `status=${status} published=${published}`);
      return {
        runId: run.id,
        targetDate,
        status,
        newProducts: newCount,
        fallbackProducts: fallbackCount,
        published,
        setId,
        message:
          status === "FAILED"
            ? "No products could be produced or reused."
            : `${newCount} new + ${fallbackCount} fallback product(s).` +
              (published ? " Published." : " Saved as DRAFT (see run errors)."),
      };
    } catch (err) {
      logger.error({ err, runId: run.id }, "generation run crashed");
      await prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime(),
          errorLog: [
            ...errorLog,
            { step: "fatal", message: (err as Error).message, at: new Date().toISOString() },
          ] as any,
        },
      });
      throw err instanceof GenerationError
        ? err
        : new GenerationError((err as Error).message, "pipeline", err);
    }
}

async function persistSources(
  runId: string,
  productId: string | null,
  sources: { url: string; title?: string | null; sourceType: string; supports?: string; relevance?: string }[],
) {
  if (!sources.length) return;
  const seen = new Set<string>();
  const rows = sources
    .filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      try {
        new URL(s.url);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 40)
    .map((s) => ({
      runId,
      productId,
      url: s.url,
      title: s.title ?? null,
      sourceType: s.sourceType ?? "web",
      supports: s.supports ?? null,
      relevance: s.relevance ?? null,
    }));
  await prisma.trendSource.createMany({ data: rows }).catch((err) => {
    logger.warn({ err }, "failed to persist sources");
  });
}

async function pickFallbackProducts(
  targetDate: string,
  lookbackDays: number,
  excludeIds: string[],
  needed: number,
) {
  if (lookbackDays <= 0 || needed <= 0) return [];
  const dates = previousDates(targetDate, Math.min(3, lookbackDays));
  const items = await prisma.dailyProductItem.findMany({
    where: {
      set: { date: { in: dates }, status: "PUBLISHED" },
      productId: { notIn: excludeIds.length ? excludeIds : ["__none__"] },
      reused: false,
    },
    include: { set: true, product: true },
  });

  // group by product, track most-recent appearance date
  const byProduct = new Map<
    string,
    { product: (typeof items)[number]["product"]; lastShown: string }
  >();
  for (const it of items) {
    const cur = byProduct.get(it.productId);
    if (!cur || it.set.date > cur.lastShown) {
      byProduct.set(it.productId, { product: it.product, lastShown: it.set.date });
    }
  }

  // least recently shown first
  return [...byProduct.values()]
    .sort((a, b) => a.lastShown.localeCompare(b.lastShown))
    .slice(0, needed)
    .map((v) => ({ id: v.product.id, lastShown: v.lastShown }));
}

async function buildItemsMeta(
  productIds: string[],
  targetDate: string,
  fallbackCount: number,
) {
  const newCount = productIds.length - fallbackCount;
  const fallbackIds = productIds.slice(newCount);
  const lastShownMap = new Map<string, string>();
  if (fallbackIds.length) {
    const rows = await prisma.dailyProductItem.findMany({
      where: { productId: { in: fallbackIds } },
      include: { set: true },
    });
    for (const r of rows) {
      const cur = lastShownMap.get(r.productId);
      if (!cur || r.set.date > cur) lastShownMap.set(r.productId, r.set.date);
    }
  }
  return productIds.map((productId, i) => ({
    productId,
    position: i + 1,
    reused: i >= newCount,
    reusedFromDate: i >= newCount ? lastShownMap.get(productId) ?? null : null,
  }));
}
