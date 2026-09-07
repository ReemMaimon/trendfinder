import type { ScoringWeights } from "@/config/defaults";
import type { ScoreResult, TrendResearch } from "@/services/types";
import { scoreSchema } from "@/services/types";
import type { RealProduct } from "@/services/aliexpress/AliExpressResearchService";
import { scoringSystemPrompt } from "@/config/prompts";
import { getAIProvider, extractJson } from "@/services/openai/OpenAIService";
import { logger } from "@/lib/logger";

export interface ScoredCandidate {
  viralPotentialScore: number;
  affiliatePotentialScore: number;
  noveltyScore: number;
  trendMomentumScore: number;
  saturationScore: number;
  overallScore: number;
  reasoning: string;
}

function clamp0100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Overall = weighted positives − saturation penalty, renormalised to 0..100. */
export function computeOverall(
  parts: {
    viralPotentialScore: number;
    affiliatePotentialScore: number;
    noveltyScore: number;
    trendMomentumScore: number;
    saturationScore: number;
  },
  w: ScoringWeights,
): number {
  const positiveWeight = w.viralPotential + w.affiliatePotential + w.trendMomentum + w.novelty;
  const positive =
    parts.viralPotentialScore * w.viralPotential +
    parts.affiliatePotentialScore * w.affiliatePotential +
    parts.trendMomentumScore * w.trendMomentum +
    parts.noveltyScore * w.novelty;
  const penalty = parts.saturationScore * w.saturationPenalty;
  return clamp0100((positive - penalty) / positiveWeight);
}

export const ProductScoringService = {
  async score(
    input: {
      trend: TrendResearch["trend"];
      product: RealProduct;
      socialSignals: TrendResearch["socialSignals"];
      selfAssessment: TrendResearch["selfAssessment"];
    },
    weights: ScoringWeights,
    runId?: string,
  ): Promise<ScoredCandidate> {
    const ai = await getAIProvider();
    const user = JSON.stringify({
      trend: input.trend,
      product: {
        title: input.product.aeTitle,
        rating: input.product.aeRating,
        orders: input.product.aeOrders,
        price: input.product.priceOriginal,
        currency: input.product.currencyOriginal,
        store: input.product.aeStoreName,
      },
      socialSignals: input.socialSignals,
      selfAssessment: input.selfAssessment,
    });

    let scores: ScoreResult;
    try {
      const res = await ai.generate({
        system: scoringSystemPrompt(),
        user,
        light: true,
        operation: "scoring.candidate",
        runId,
        maxOutputTokens: 600,
      });
      scores = scoreSchema.parse(extractJson(res.text));
    } catch (err) {
      logger.warn({ err }, "scoring call failed, falling back to self-assessment");
      const sa = input.selfAssessment ?? {};
      scores = scoreSchema.parse({
        viralPotentialScore: sa.viralPotential ?? 55,
        affiliatePotentialScore: sa.affiliatePotential ?? 55,
        noveltyScore: sa.novelty ?? 55,
        trendMomentumScore: sa.trendMomentum ?? 55,
        saturationScore: sa.saturation ?? 50,
        reasoning: "Fallback: AI self-assessment (scoring model unavailable).",
      });
    }

    const parts = {
      viralPotentialScore: clamp0100(scores.viralPotentialScore),
      affiliatePotentialScore: clamp0100(scores.affiliatePotentialScore),
      noveltyScore: clamp0100(scores.noveltyScore),
      trendMomentumScore: clamp0100(scores.trendMomentumScore),
      saturationScore: clamp0100(scores.saturationScore),
    };
    return { ...parts, overallScore: computeOverall(parts, weights), reasoning: scores.reasoning ?? "" };
  },
};
