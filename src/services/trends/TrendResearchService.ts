import { getAIProvider, extractJson } from "@/services/openai/OpenAIService";
import { trendResearchSchema, type TrendResearch, productPickSchema, type ProductPick } from "@/services/types";
import {
  trendResearchSystemPrompt,
  trendResearchUserPrompt,
  productPickSystemPrompt,
  productPickUserPrompt,
  type PreviousProductContext,
} from "@/config/prompts";
import type { Settings } from "@/config/defaults";
import type { AeSearchItem } from "@/services/aliexpress/aeSearch";
import { logger } from "@/lib/logger";

export interface TrendAttempt {
  research: TrendResearch | null;
  parseError: string | null;
  webSources: { url: string; title?: string }[];
  rawText: string;
}

export const TrendResearchService = {
  /** AI: discover ONE emerging trend + AliExpress search phrases (no product). */
  async researchTrend(params: {
    settings: Settings;
    targetDate: string;
    previous: PreviousProductContext[];
    avoidTrendTitles: string[];
    alreadyAcceptedCategories: string[];
    maxPriceIls?: number | null;
    maxPriceUsdApprox?: number | null;
    runId?: string;
  }): Promise<TrendAttempt> {
    const ai = await getAIProvider();
    const res = await ai.generate({
      system: trendResearchSystemPrompt(params.settings),
      user: trendResearchUserPrompt({
        targetDate: params.targetDate,
        previous: params.previous,
        avoidTrendTitles: params.avoidTrendTitles,
        alreadyAcceptedCategories: params.alreadyAcceptedCategories,
        enforceDistinctCategories: params.settings.diversityRules.enforceDistinctCategories,
        maxPriceIls: params.maxPriceIls,
        maxPriceUsdApprox: params.maxPriceUsdApprox,
      }),
      webSearch: true,
      operation: "trend.research.trend",
      runId: params.runId,
      maxOutputTokens: 2500,
    });

    try {
      const research = trendResearchSchema.parse(extractJson(res.text));
      return { research, parseError: null, webSources: res.webSources, rawText: res.text };
    } catch (err) {
      logger.warn({ err, sample: res.text.slice(0, 300) }, "trend research failed validation");
      return {
        research: null,
        parseError: err instanceof Error ? err.message : String(err),
        webSources: res.webSources,
        rawText: res.text,
      };
    }
  },

  /** AI: pick the best REAL product for the trend from fetched candidates. */
  async pickProduct(params: {
    trend: { title: string; description: string; category: string };
    candidates: AeSearchItem[];
    maxPriceUsdApprox?: number | null;
    runId?: string;
  }): Promise<ProductPick> {
    if (params.candidates.length === 0) {
      return { chosenProductId: null, relevance: 0, rejectionReason: "no AliExpress candidates", reasoning: "" };
    }
    const ai = await getAIProvider();
    try {
      const res = await ai.generate({
        system: productPickSystemPrompt(),
        user: productPickUserPrompt(params.trend, params.candidates, params.maxPriceUsdApprox),
        light: true,
        operation: "trend.pick.product",
        runId: params.runId,
        maxOutputTokens: 500,
      });
      const pick = productPickSchema.parse(extractJson(res.text));
      // guard: chosen id must be one of the candidates
      if (pick.chosenProductId && !params.candidates.some((c) => c.productId === pick.chosenProductId)) {
        return {
          chosenProductId: params.candidates[0].productId,
          relevance: Math.min(pick.relevance, 60),
          rejectionReason: null,
          reasoning: `AI returned an unknown id; fell back to top-ranked candidate. ${pick.reasoning}`,
        };
      }
      return pick;
    } catch (err) {
      logger.warn({ err }, "product pick failed, using top-ranked candidate");
      return {
        chosenProductId: params.candidates[0].productId,
        relevance: 55,
        rejectionReason: null,
        reasoning: "Fallback: picker unavailable, used highest-ranked real listing.",
      };
    }
  },
};
