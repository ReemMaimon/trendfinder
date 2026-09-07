import type { ScoringWeights } from "@/config/defaults";
import type { ResearchCandidate, ScoreResult } from "@/services/types";
import { scoreSchema } from "@/services/types";
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

/**
 * Overall = weighted positives − saturation penalty, renormalised to 0..100.
 * Weights are configurable from Admin Settings.
 */
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
  const positiveWeight =
    w.viralPotential + w.affiliatePotential + w.trendMomentum + w.novelty;
  const positive =
    parts.viralPotentialScore * w.viralPotential +
    parts.affiliatePotentialScore * w.affiliatePotential +
    parts.trendMomentumScore * w.trendMomentum +
    parts.noveltyScore * w.novelty;
  const penalty = parts.saturationScore * w.saturationPenalty;
  // Scale so a "perfect" product (100s, 0 saturation) => 100.
  const raw = (positive - penalty) / positiveWeight;
  return clamp0100(raw);
}

export const ProductScoringService = {
  async score(
    candidate: ResearchCandidate,
    weights: ScoringWeights,
    runId?: string,
  ): Promise<ScoredCandidate> {
    const ai = await getAIProvider();

    const user = JSON.stringify({
      trend: candidate.trend,
      product: candidate.product
        ? {
            title: candidate.product.aeTitle,
            rating: candidate.product.aeRating,
            orders: candidate.product.aeOrders,
            price: candidate.product.priceOriginal,
            currency: candidate.product.currencyOriginal,
            store: candidate.product.aeStoreName,
          }
        : null,
      socialSignals: candidate.socialSignals,
      selfAssessment: candidate.selfAssessment,
    });

    let scores: ScoreResult;
    try {
      const res = await ai.generate({
        system: scoringSystemPrompt(),
        user,
        light: true,
        webSearch: false,
        operation: "scoring.candidate",
        runId,
        maxOutputTokens: 600,
      });
      scores = scoreSchema.parse(extractJson(res.text));
    } catch (err) {
      logger.warn({ err }, "scoring call failed, falling back to self-assessment");
      const sa = candidate.selfAssessment ?? {};
      scores = scoreSchema.parse({
        viralPotentialScore: sa.viralPotential ?? 50,
        affiliatePotentialScore: sa.affiliatePotential ?? 50,
        noveltyScore: sa.novelty ?? 50,
        trendMomentumScore: sa.trendMomentum ?? 50,
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

    return {
      ...parts,
      overallScore: computeOverall(parts, weights),
      reasoning: scores.reasoning ?? "",
    };
  },
};
