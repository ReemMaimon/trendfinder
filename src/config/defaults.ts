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
  // Jaccard similarity threshold on normalised title+trend tokens — used both
  // between today's picks and against recent history.
  maxTitleSimilarity: z.number().min(0).max(1),
  // Novelty window: a trend/product may not repeat (or closely resemble one)
  // published within the last N days. The AI is also given this window and the
  // list of trends in it, and told the trend must be new.
  historyLookbackDays: z.number().int().min(0).max(60),
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
  // Max displayed product price in ILS. null => no limit. The pipeline passes
  // this budget to the AI and hard-rejects any product above it after currency
  // conversion.
  maxProductPriceIls: z.number().positive().max(100000).nullable(),
  scoringWeights: scoringWeightsSchema,
  diversityRules: diversityRulesSchema,
  // runtime override of APP_MODE; null => use env value
  appModeOverride: z.enum(["TEST", "PRODUCTION"]).nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;
export type DiversityRules = z.infer<typeof diversityRulesSchema>;

export const DEFAULT_SETTINGS: Settings = {
  promptVersion: "2026-09-08.2",
  researchInstructions: [
    "מטרת המחקר: לזהות טרנד אחד של מוצר שנמצא בתחילת עלייה — יש סימנים מוקדמים לעניין גובר בכמה פלטפורמות, אך הוא עדיין לא רווי לחלוטין.",
    "עבוד לפי הכלל: קודם טרנד, אחר כך מוצר. החזר את הטרנד + 3-6 ביטויי חיפוש פשוטים ל-AliExpress. אל תחזיר קישורים, תמונות או מחירים — המערכת מביאה את המוצרים האמיתיים בעצמה.",
    "בדוק חזרתיות בין פלטפורמות: TikTok, Instagram, YouTube, Google Trends ותוצאות רשת כלליות.",
    "כלל חדשנות קשיח: הטרנד חייב להיות חדש לחלוטין ביחס לטרנדים ולמוצרים שפורסמו בימים האחרונים (מופיעים ברשימה שתקבל). לא וריאציה, לא ניסוח מחדש, לא 'אח' של אותו רעיון.",
    "העדף מוצרים עם פוטנציאל וידאו קצר חזק, פוטנציאל שיתוף גבוה ופוטנציאל קנייה אימפולסיבית.",
    "הימנע ממוצרים שכבר נמצאים בכל מקום (רוויים).",
    "אין להמציא נתונים. ציוני האותות החברתיים הם הערכה שלך; מספרים מדויקים רק אם מקור אמיתי מצטט אותם.",
  ].join("\n"),
  // Plain AliExpress search phrases the AI should model its `searchQueries` on.
  aliexpressSearchTemplates: [
    "{keyword}",
    "{keyword} portable",
    "{keyword} rechargeable",
    "{trendKeyword}",
  ],
  maxCandidates: 20,
  minOverallScore: 55,
  maxSaturationScore: 80,
  fallbackLookbackDays: 3,
  maxProductPriceIls: null,
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
    historyLookbackDays: 7,
    maxHistorySimilarity: 0.5,
  },
  appModeOverride: null,
};
