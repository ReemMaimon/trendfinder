import { z } from "zod";

/**
 * Default runtime configuration. Persisted into the `settings` table on first
 * boot and thereafter editable from the Admin panel. `SettingsService` merges
 * the stored row over these defaults and validates with `settingsSchema`.
 */

export const scoringWeightsSchema = z.object({
  viralPotential: z.number().min(0).max(5),
  affiliatePotential: z.number().min(0).max(5),
  trendMomentum: z.number().min(0).max(5),
  novelty: z.number().min(0).max(5),
  // saturation is subtracted
  saturationPenalty: z.number().min(0).max(5),
});

export const diversityRulesSchema = z.object({
  // reject a candidate if its category already appears in today's accepted set
  enforceDistinctCategories: z.boolean(),
  // cosine/Jaccard similarity threshold on normalised title+trend tokens
  maxTitleSimilarity: z.number().min(0).max(1),
  // reject if similar to any product shown within the last N days
  historyLookbackDays: z.number().int().min(0).max(30),
  maxHistorySimilarity: z.number().min(0).max(1),
});

export const settingsSchema = z.object({
  promptVersion: z.string(),
  researchInstructions: z.string(),
  aliexpressSearchTemplates: z.array(z.string()).min(1),
  maxCandidates: z.number().int().min(3).max(60),
  minOverallScore: z.number().int().min(0).max(100),
  maxSaturationScore: z.number().int().min(0).max(100),
  fallbackLookbackDays: z.number().int().min(0).max(3),
  scoringWeights: scoringWeightsSchema,
  diversityRules: diversityRulesSchema,
  // runtime override of APP_MODE; null => use env value
  appModeOverride: z.enum(["TEST", "PRODUCTION"]).nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;
export type DiversityRules = z.infer<typeof diversityRulesSchema>;

export const DEFAULT_SETTINGS: Settings = {
  promptVersion: "2026-09-07.1",
  researchInstructions: [
    "מטרת המחקר: לזהות טרנדים של מוצרים שנמצאים בתחילת עלייה — יש סימנים מוקדמים לעניין גובר, אך הם עדיין לא רוויים לחלוטין.",
    "עבוד לפי הכלל: קודם טרנד, אחר כך מוצר. אל תחפש מוצרים אקראיים ב-AliExpress ואז תכריז עליהם כטרנדיים.",
    "בדוק חזרתיות בין פלטפורמות: TikTok, Instagram, YouTube, Google Trends, ותוצאות רשת כלליות.",
    "העדף מוצרים עם פוטנציאל וידאו קצר חזק, פוטנציאל שיתוף גבוה ופוטנציאל קנייה אימפולסיבית.",
    "הימנע ממוצרים שכבר נמצאים בכל מקום (רוויים).",
    "לכל טרנד שנבחר, חפש ב-AliExpress מוצרים רלוונטיים, השווה מספר מודעות, ובחר את הטובה ביותר.",
    "אם לא נמצא מוצר מתאים ואמין ב-AliExpress — דחה את הטרנד ועבור לטרנד אחר.",
    "אין להמציא מידע. אם ערך אינו ניתן לאימות — החזר null.",
  ].join("\n"),
  aliexpressSearchTemplates: [
    'site:aliexpress.com "{keyword}"',
    'site:aliexpress.com/item "{keyword}"',
    'site:aliexpress.com "{trendKeyword}"',
    'site:aliexpress.com {keyword} review',
  ],
  maxCandidates: 20,
  minOverallScore: 55,
  maxSaturationScore: 80,
  fallbackLookbackDays: 3,
  scoringWeights: {
    viralPotential: 1.3,
    affiliatePotential: 1.0,
    trendMomentum: 1.1,
    novelty: 0.9,
    saturationPenalty: 1.2,
  },
  diversityRules: {
    enforceDistinctCategories: true,
    maxTitleSimilarity: 0.55,
    historyLookbackDays: 10,
    maxHistorySimilarity: 0.6,
  },
  appModeOverride: null,
};
