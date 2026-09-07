import type { Settings } from "./defaults";
import { CATEGORIES } from "./categories";

/**
 * Prompt builders for the discovery pipeline. All prompts are versioned via
 * `settings.promptVersion` and stored on each GenerationRun so the admin can
 * see exactly which instructions produced a given day's products.
 *
 * To change how the AI researches: edit `researchInstructions` in Admin
 * Settings (no code change), or edit the scaffolding below and bump
 * `DEFAULT_SETTINGS.promptVersion`.
 */

export interface PreviousProductContext {
  date: string;
  trendTitle: string;
  aeTitle: string;
  category: string;
  aeUrl: string;
  aeProductId: string | null;
  trendDescription: string;
  scores: {
    overall: number;
    viral: number;
    novelty: number;
    saturation: number;
  };
}

const PLATFORM_LEVELS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

export function trendResearchSystemPrompt(settings: Settings): string {
  return [
    "You are TrendFinder's product-trend research analyst.",
    "Your job: discover EMERGING product trends that are beginning to rise but are NOT yet saturated, then verify a matching real product exists on AliExpress.",
    "",
    "HARD RULES:",
    "1. TREND FIRST, PRODUCT SECOND. Identify a real emerging trend, understand it, THEN search AliExpress for a matching product.",
    "2. Use web search. Look across TikTok, Instagram, YouTube, Google Trends and general web results for repeated / rising signals.",
    "3. NEVER fabricate facts. Prices, ratings, order counts, image URLs, product URLs and trend statistics must come from real search results or be returned as null.",
    "4. If no suitable, verifiable AliExpress product exists for a trend, REJECT that trend and move on.",
    "5. Prefer novelty and short-video shareability. Avoid products that are already everywhere.",
    "6. The final set must be 3 meaningfully different products (different categories / use-cases).",
    "",
    `Allowed categories: ${CATEGORIES.join(", ")}.`,
    `Allowed social signal levels: ${PLATFORM_LEVELS.join(", ")}.`,
    "",
    "ADMIN RESEARCH INSTRUCTIONS (may be in Hebrew):",
    settings.researchInstructions,
  ].join("\n");
}

export function trendCandidatePrompt(params: {
  settings: Settings;
  targetDate: string;
  previous: PreviousProductContext[];
  attemptsRemaining: number;
  alreadyAcceptedCategories: string[];
  avoidTrendTitles: string[];
}): string {
  const { settings, targetDate, previous, alreadyAcceptedCategories, avoidTrendTitles } =
    params;

  const prevBlock =
    previous.length === 0
      ? "(none)"
      : previous
          .map(
            (p) =>
              `- [${p.date}] "${p.trendTitle}" | product: ${p.aeTitle} | category: ${p.category} | id: ${p.aeProductId ?? "n/a"} | url: ${p.aeUrl} | overall ${p.scores.overall}, saturation ${p.scores.saturation}\n    trend: ${p.trendDescription}`,
          )
          .join("\n");

  const searchTemplates = settings.aliexpressSearchTemplates
    .map((t) => `  ${t}`)
    .join("\n");

  return [
    `Target publish date: ${targetDate} (Asia/Jerusalem).`,
    "",
    "Find ONE emerging product trend + the best matching AliExpress product, following this process:",
    "  a) Discover an emerging trend from social + web signals (rising, repeated across platforms, not saturated).",
    "  b) Explain the trend and why it is rising now.",
    "  c) Search AliExpress via the web using templates like:",
    searchTemplates,
    "  d) Open / inspect several AliExpress result pages. Compare relevance, orders, rating, price, novelty, saturation.",
    "  e) Pick the single best matching product and extract its REAL data.",
    "  f) If nothing suitable is verifiable on AliExpress, set productFound=false and explain why.",
    "",
    "AVOID repeating these recent trends / products (last days):",
    prevBlock,
    "",
    avoidTrendTitles.length
      ? `Also avoid trend angles already tried in THIS run: ${avoidTrendTitles.join("; ")}`
      : "",
    settings.diversityRules.enforceDistinctCategories && alreadyAcceptedCategories.length
      ? `Categories already used today (pick a DIFFERENT one): ${alreadyAcceptedCategories.join(", ")}`
      : "",
    "",
    "Return ONLY a JSON object matching this TypeScript type (no prose, no markdown fence):",
    CANDIDATE_JSON_SHAPE,
  ]
    .filter(Boolean)
    .join("\n");
}

export const CANDIDATE_JSON_SHAPE = `
{
  "trend": {
    "title": string,                 // short label, English ok
    "description": string,           // 2-4 sentences: what it is + why rising now
    "category": string,              // one of the allowed categories
    "whyEmergingNotSaturated": string,
    "keywordsSearched": string[]
  },
  "productFound": boolean,
  "rejectionReason": string | null,  // required when productFound=false
  "product": null | {
    "aeTitle": string,
    "aeDescription": string | null,
    "aeUrl": string,                 // canonical aliexpress.com product URL
    "aeProductId": string | null,    // numeric item id if visible in URL/page
    "aeStoreName": string | null,
    "aeImages": string[],            // real image URLs only, [] if none verifiable
    "aeRating": number | null,       // 0..5
    "aeOrders": number | null,       // integer sales/orders count
    "priceOriginal": number | null,
    "currencyOriginal": string | null, // e.g. "USD", "ILS"
    "priceShipping": number | null,  // ONLY if explicitly shown
    "shippingVerified": boolean,
    "aeVariants": [{ "name": string, "options": string[] }] | null,
    "dataConfidence": {              // per field: "VERIFIED" | "ESTIMATED" | "UNAVAILABLE"
      "title": string, "price": string, "rating": string,
      "orders": string, "images": string, "shipping": string, "url": string
    },
    "candidateListingsCompared": [{ "url": string, "note": string }]
  },
  "socialSignals": {
    "tiktok":       { "level": string, "reasoning": string },
    "instagram":    { "level": string, "reasoning": string },
    "youtube":      { "level": string, "reasoning": string },
    "googleTrends": { "level": string, "reasoning": string },
    "verifiedMetrics": object | null  // only real, cited numbers
  },
  "sources": [{
    "url": string, "title": string | null,
    "sourceType": "tiktok"|"instagram"|"youtube"|"google_trends"|"aliexpress"|"web",
    "supports": "trend"|"product"|"price"|"rating"|"orders"|"other",
    "relevance": string
  }],
  "selfAssessment": {
    "viralPotential": number,   // 0..100
    "affiliatePotential": number,
    "novelty": number,
    "trendMomentum": number,
    "saturation": number,
    "notes": string
  }
}
`.trim();

export function scoringSystemPrompt(): string {
  return [
    "You are TrendFinder's scoring analyst. Given a researched trend + AliExpress product, produce calibrated 0-100 sub-scores.",
    "Be conservative: a truly novel, clearly-rising, low-saturation product with a solid AliExpress listing scores high; generic, everywhere-already products score low on novelty and high on saturation.",
    "Return ONLY JSON: { viralPotentialScore, affiliatePotentialScore, noveltyScore, trendMomentumScore, saturationScore, reasoning }.",
    "All *Score fields are integers 0-100. `reasoning` is 1-3 sentences (English).",
  ].join("\n");
}

export function hebrewExplanationPrompt(): string {
  return [
    "You write short, natural Hebrew copy for a product-discovery site (mobile, RTL).",
    "Given the trend, the product and the scores, write:",
    '  1. "explanationHe": 2-3 sentences explaining why this product is trending and why it still has room to grow (no numbers dump, natural tone).',
    '  2. "overallReasoningHe": 1-2 sentences summarising the social signal picture.',
    "Return ONLY JSON: { explanationHe, overallReasoningHe }. Hebrew only. No hype clichés, no fabricated statistics.",
  ].join("\n");
}
