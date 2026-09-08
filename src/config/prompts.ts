import type { Settings } from "./defaults";
import { CATEGORIES } from "./categories";
import type { AeSearchItem } from "@/services/aliexpress/aeSearch";

/**
 * Prompt builders. Versioned via `settings.promptVersion` and stored on every
 * GenerationRun.
 *
 * Split responsibilities:
 *   - the trend prompt asks ONLY for the emerging trend + AliExpress search
 *     phrases + social signals. It must NOT return product URLs / images /
 *     prices (the model hallucinates those).
 *   - real products come from AliExpress search (code).
 *   - the pick prompt chooses the best REAL candidate.
 */

export interface PreviousProductContext {
  date: string;
  trendTitle: string;
  aeTitle: string;
  category: string;
  aeUrl: string;
  aeProductId: string | null;
  trendDescription: string;
  scores: { overall: number; viral: number; novelty: number; saturation: number };
}

const PLATFORM_LEVELS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

export function trendResearchSystemPrompt(settings: Settings): string {
  return [
    "You are TrendFinder's product-trend research analyst.",
    "Goal: discover ONE product trend that is EMERGING — early signs of rising interest across social platforms, but NOT yet saturated / everywhere.",
    "",
    "HARD RULES:",
    "1. Use web search. Look for repeated / rising signals across TikTok, Instagram, YouTube, Google Trends and general web.",
    "2. TREND FIRST. Identify the trend and why it is rising NOW.",
    `3. Then produce 3-6 SHORT AliExpress search phrases (plain product keywords a shopper would type). Model them on these admin examples: ${settings.aliexpressSearchTemplates.join(" | ")}. Do NOT use "site:" operators. Do NOT include URLs.`,
    "4. NEVER invent statistics. Social signal levels are your judgement; only put numbers in verifiedMetrics if a real cited source states them.",
    "5. Prefer novelty + short-video shareability + impulse-buy potential. Avoid products already everywhere.",
    "6. Every `sources[].url` must be a real URL you actually saw in search results. If you have no real URL, return an empty sources array.",
    "",
    `Allowed categories: ${CATEGORIES.join(", ")}.`,
    `Allowed social signal levels: ${PLATFORM_LEVELS.join(", ")}.`,
    "",
    "ADMIN RESEARCH INSTRUCTIONS (may be Hebrew):",
    settings.researchInstructions,
  ].join("\n");
}

export function trendResearchUserPrompt(params: {
  targetDate: string;
  previous: PreviousProductContext[];
  avoidTrendTitles: string[];
  alreadyAcceptedCategories: string[];
  enforceDistinctCategories: boolean;
  noveltyDays: number;
  maxPriceIls?: number | null;
  maxPriceUsdApprox?: number | null;
}): string {
  const {
    targetDate,
    previous,
    avoidTrendTitles,
    alreadyAcceptedCategories,
    enforceDistinctCategories,
    noveltyDays,
    maxPriceIls,
    maxPriceUsdApprox,
  } = params;

  const prevBlock =
    previous.length === 0
      ? "(none)"
      : previous
          .map(
            (p) =>
              `- [${p.date}] "${p.trendTitle}" -> ${p.aeTitle} (${p.category}) overall ${p.scores.overall}\n    ${p.trendDescription}`,
          )
          .join("\n");

  return [
    `Target publish date: ${targetDate} (Asia/Jerusalem).`,
    "",
    "Find ONE emerging product trend and return the JSON below (no prose, no markdown fence).",
    maxPriceIls
      ? `\nBUDGET: the final product must sell for at most ₪${maxPriceIls} (≈ $${maxPriceUsdApprox ?? "?"} USD). Choose a trend whose typical product is well within this budget, and make searchQueries target affordable items.`
      : "",
    "",
    `HARD NOVELTY RULE: the trend you return MUST be genuinely new. It must NOT be the same as — or a close variation / re-wording / sibling of — any trend or product published in the last ${noveltyDays} days, listed here:`,
    prevBlock,
    `(A candidate that resembles any of the above will be rejected. Pick a different product category / use-case / angle.)`,
    avoidTrendTitles.length ? `\nAlso avoid trend angles already tried this run: ${avoidTrendTitles.join("; ")}` : "",
    enforceDistinctCategories && alreadyAcceptedCategories.length
      ? `\nCategories already used today (choose a DIFFERENT one): ${alreadyAcceptedCategories.join(", ")}`
      : "",
    "",
    "JSON shape:",
    TREND_JSON_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
}

export const TREND_JSON_SHAPE = `
{
  "trend": {
    "title": string,
    "description": string,          // 2-4 sentences: what it is + why rising now
    "category": string,             // one allowed category
    "whyEmergingNotSaturated": string
  },
  "searchQueries": string[],        // 3-6 plain AliExpress search phrases, NO "site:", NO urls
  "productFound": true,
  "socialSignals": {
    "tiktok":       { "level": string, "reasoning": string },
    "instagram":    { "level": string, "reasoning": string },
    "youtube":      { "level": string, "reasoning": string },
    "googleTrends": { "level": string, "reasoning": string },
    "verifiedMetrics": object | null
  },
  "sources": [{ "url": string, "title": string|null,
    "sourceType": "tiktok"|"instagram"|"youtube"|"google_trends"|"aliexpress"|"web",
    "supports": "trend"|"product"|"other", "relevance": string }],
  "selfAssessment": {
    "viralPotential": number, "affiliatePotential": number,
    "novelty": number, "trendMomentum": number, "saturation": number, "notes": string
  }
}
`.trim();

export function productPickSystemPrompt(): string {
  return [
    "You are TrendFinder's product matcher. You are given an emerging trend and a list of REAL AliExpress products (already fetched — ids, titles, prices, ratings, order counts are real).",
    "Pick the SINGLE product that best represents the trend for a viral short-video / impulse-buy audience.",
    "Prefer: strong relevance to the trend, decent rating (>= 4.0), meaningful but not massive order counts (early-traction, not saturated), clear single-product listings over bulk/accessory lots.",
    "If NONE of the candidates genuinely match the trend, return chosenProductId = null with a rejectionReason.",
    'Return ONLY JSON: { "chosenProductId": string|null, "relevance": 0-100, "rejectionReason": string|null, "reasoning": string }.',
  ].join("\n");
}

export function productPickUserPrompt(
  trend: { title: string; description: string; category: string },
  candidates: AeSearchItem[],
  maxPriceUsdApprox?: number | null,
): string {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. id=${c.productId} | "${c.title}" | ${c.priceOriginal ?? "?"} ${c.currencyOriginal ?? ""} | rating ${c.rating ?? "?"} | orders ${c.orders ?? "?"}`,
    )
    .join("\n");
  return [
    `TREND: ${trend.title} (${trend.category})`,
    trend.description,
    maxPriceUsdApprox
      ? `\nBUDGET: pick a product priced at most ~$${maxPriceUsdApprox} USD. If every candidate is over budget, return chosenProductId = null.`
      : "",
    "",
    "REAL AliExpress candidates:",
    list,
    "",
    "Choose the best `chosenProductId` (must be one of the ids above) or null.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function scoringSystemPrompt(): string {
  return [
    "You are TrendFinder's scoring analyst. Given a researched trend + a real AliExpress product, produce calibrated 0-100 sub-scores.",
    "Be conservative: a truly novel, clearly-rising, low-saturation product with a solid listing scores high; generic everywhere-already products score low on novelty and high on saturation.",
    "Return ONLY JSON: { viralPotentialScore, affiliatePotentialScore, noveltyScore, trendMomentumScore, saturationScore, reasoning }.",
    "All *Score fields are integers 0-100. reasoning is 1-3 sentences (English).",
  ].join("\n");
}

export function hebrewExplanationPrompt(): string {
  return [
    "You write short, natural Hebrew copy for a product-discovery site (mobile, RTL).",
    "Given the trend, the product and the scores, write:",
    '  1. "explanationHe": 2-3 sentences on why this product is trending and why it still has room to grow (natural tone, no numbers dump).',
    '  2. "overallReasoningHe": 1-2 sentences summarising the social signal picture.',
    "Return ONLY JSON: { explanationHe, overallReasoningHe }. Hebrew only. No hype clichés, no fabricated statistics.",
  ].join("\n");
}
