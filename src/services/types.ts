import { z } from "zod";

/**
 * Runtime-validated shape of a single research candidate returned by the AI.
 * The pipeline rejects anything that does not parse, so malformed / hallucinated
 * structures never reach the database.
 */

export const signalLevelSchema = z
  .enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"])
  .catch("UNKNOWN");

const confidenceSchema = z
  .enum(["VERIFIED", "ESTIMATED", "UNAVAILABLE"])
  .catch("UNAVAILABLE");

export const researchCandidateSchema = z.object({
  trend: z.object({
    title: z.string().min(2).max(200),
    description: z.string().min(10).max(2000),
    category: z.string().min(2).max(50),
    whyEmergingNotSaturated: z.string().max(2000).optional().default(""),
    keywordsSearched: z.array(z.string()).max(40).optional().default([]),
  }),
  productFound: z.boolean(),
  rejectionReason: z.string().max(2000).nullable().optional(),
  product: z
    .object({
      aeTitle: z.string().min(2).max(400),
      aeDescription: z.string().max(8000).nullable().optional(),
      aeUrl: z.string().url(),
      aeProductId: z.string().max(40).nullable().optional(),
      aeStoreName: z.string().max(200).nullable().optional(),
      aeImages: z.array(z.string().url()).max(20).optional().default([]),
      aeRating: z.number().min(0).max(5).nullable().optional(),
      aeOrders: z.number().int().min(0).nullable().optional(),
      priceOriginal: z.number().min(0).nullable().optional(),
      currencyOriginal: z.string().max(8).nullable().optional(),
      priceShipping: z.number().min(0).nullable().optional(),
      shippingVerified: z.boolean().optional().default(false),
      aeVariants: z
        .array(z.object({ name: z.string(), options: z.array(z.string()) }))
        .nullable()
        .optional(),
      dataConfidence: z
        .object({
          title: confidenceSchema,
          price: confidenceSchema,
          rating: confidenceSchema,
          orders: confidenceSchema,
          images: confidenceSchema,
          shipping: confidenceSchema,
          url: confidenceSchema,
        })
        .partial()
        .optional()
        .default({}),
      candidateListingsCompared: z
        .array(z.object({ url: z.string(), note: z.string().optional().default("") }))
        .optional()
        .default([]),
    })
    .nullable()
    .optional(),
  socialSignals: z.object({
    tiktok: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
    instagram: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
    youtube: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
    googleTrends: z.object({ level: signalLevelSchema, reasoning: z.string().max(1200).optional().default("") }),
    verifiedMetrics: z.record(z.any()).nullable().optional(),
  }),
  sources: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        sourceType: z
          .enum(["tiktok", "instagram", "youtube", "google_trends", "aliexpress", "web"])
          .catch("web"),
        supports: z
          .enum(["trend", "product", "price", "rating", "orders", "other"])
          .catch("other"),
        relevance: z.string().max(500).optional().default(""),
      }),
    )
    .max(40)
    .optional()
    .default([]),
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

export type ResearchCandidate = z.infer<typeof researchCandidateSchema>;

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
