import { z } from "zod";

/**
 * Runtime-validated shapes for the discovery pipeline. The AI's job is split:
 *   1. researchTrend  -> the emerging trend + AliExpress search phrases + signals
 *   2. (code) real AliExpress search -> real candidate products
 *   3. pickProduct    -> choose the best REAL candidate + relevance
 *   4. score / copy   -> as before
 *
 * The AI never supplies product URLs / images / prices, so it cannot fabricate
 * them.
 */

export const signalLevelSchema = z
  .enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"])
  .catch("UNKNOWN");

export const socialSignalsSchema = z.object({
  tiktok: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
  instagram: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
  youtube: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
  googleTrends: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
  verifiedMetrics: z.record(z.any()).nullable().optional(),
});

// Drop malformed source entries (bad/empty URLs) instead of failing the whole
// research object — a stray source URL should not sink an otherwise-good trend.
export const sourcesSchema = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.filter(
      (s) =>
        s && typeof s === "object" && typeof (s as any).url === "string" &&
        /^https?:\/\/\S+$/i.test((s as any).url),
    );
  },
  z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        sourceType: z
          .enum(["tiktok", "instagram", "youtube", "google_trends", "aliexpress", "web"])
          .catch("web"),
        supports: z.enum(["trend", "product", "price", "rating", "orders", "other"]).catch("other"),
        relevance: z.string().max(500).optional().default(""),
      }),
    )
    .max(40)
    .default([]),
);

export const trendResearchSchema = z.object({
  trend: z.object({
    title: z.string().min(2).max(200),
    description: z.string().min(10).max(2000),
    category: z.string().min(2).max(50),
    whyEmergingNotSaturated: z.string().max(2000).optional().default(""),
  }),
  /** AliExpress search phrases (plain product keywords, NOT "site:" queries). */
  searchQueries: z.array(z.string().min(2).max(80)).min(1).max(8),
  productFound: z.boolean().optional().default(true),
  rejectionReason: z.string().max(2000).nullable().optional(),
  socialSignals: socialSignalsSchema,
  sources: sourcesSchema,
  selfAssessment: z
    .object({
      viralPotential: z.number().min(0).max(100).optional(),
      affiliatePotential: z.number().min(0).max(100).optional(),
      novelty: z.number().min(0).max(100).optional(),
      trendMomentum: z.number().min(0).max(100).optional(),
      saturation: z.number().min(0).max(100).optional(),
      notes: z.string().max(2000).optional().default(""),
    })
    .optional()
    .default({}),
});
export type TrendResearch = z.infer<typeof trendResearchSchema>;

export const productPickSchema = z.object({
  chosenProductId: z.string().min(3).nullable(),
  relevance: z.number().min(0).max(100),
  rejectionReason: z.string().max(1000).nullable().optional(),
  reasoning: z.string().max(1500).optional().default(""),
});
export type ProductPick = z.infer<typeof productPickSchema>;

export const scoreSchema = z.object({
  viralPotentialScore: z.number().min(0).max(100),
  affiliatePotentialScore: z.number().min(0).max(100),
  noveltyScore: z.number().min(0).max(100),
  trendMomentumScore: z.number().min(0).max(100),
  saturationScore: z.number().min(0).max(100),
  reasoning: z.string().max(2000).optional().default(""),
});
export type ScoreResult = z.infer<typeof scoreSchema>;

export const hebrewCopySchema = z.object({
  explanationHe: z.string().min(10).max(1200),
  overallReasoningHe: z.string().min(5).max(1200),
});
export type HebrewCopy = z.infer<typeof hebrewCopySchema>;
