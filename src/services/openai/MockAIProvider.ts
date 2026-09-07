import type { AIProvider, AICallOptions, AITextResult } from "./OpenAIService";

/**
 * Deterministic offline AI provider (AI_PROVIDER=mock). Exercises the whole
 * pipeline — trend research, real-ish AliExpress search (see aeSearch mock),
 * product pick, scoring, diversity, dedup, fallback, publishing — with no
 * network and no API key.
 */

const MOCK_TRENDS = [
  { title: "Magnetic modular desk cable organizer", category: "Gadgets", kw: "magnetic cable organizer desk" },
  { title: "Collapsible silicone pour-over coffee dripper", category: "Kitchen", kw: "collapsible silicone coffee dripper" },
  { title: "Grip-strength trainer with rep counter", category: "Fitness", kw: "adjustable grip strength trainer counter" },
  { title: "Sunset projection lamp for room videos", category: "Home", kw: "sunset projection lamp usb" },
  { title: "Mini thermal label printer for organizing", category: "Home", kw: "mini thermal label printer bluetooth" },
  { title: "Magnetic wristband for small screws", category: "Accessories", kw: "magnetic wristband screws tool" },
  { title: "Rechargeable electric spice grinder", category: "Kitchen", kw: "rechargeable electric spice grinder usb" },
  { title: "Foldable adhesive laptop stand", category: "Technology", kw: "foldable invisible laptop stand" },
];

let call = 0;
const pick = <T,>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generate(opts: AICallOptions): Promise<AITextResult> {
    call += 1;
    const seed = call;
    let payload: unknown;

    if (opts.operation.startsWith("trend.research")) {
      const t = pick(MOCK_TRENDS, seed);
      const saturation = 25 + ((seed * 7) % 45);
      payload = {
        trend: {
          title: t.title,
          description: `${t.title}: early rising interest across short-video niches, limited mainstream retail coverage so far.`,
          category: t.category,
          whyEmergingNotSaturated: "Signals are recent and concentrated; not yet everywhere.",
        },
        searchQueries: [t.kw, `${t.kw} portable`, `${t.kw} rechargeable`],
        productFound: true,
        socialSignals: {
          tiktok: { level: seed % 2 ? "HIGH" : "MEDIUM", reasoning: "Several recent videos in the niche." },
          instagram: { level: "MEDIUM", reasoning: "Reels from mid-size accounts." },
          youtube: { level: seed % 3 ? "MEDIUM" : "HIGH", reasoning: "Short-form + a few reviews." },
          googleTrends: { level: seed % 2 ? "MEDIUM" : "LOW", reasoning: "Breakout-ish, low absolute volume." },
          verifiedMetrics: null,
        },
        sources: [
          { url: `https://www.tiktok.com/tag/${encodeURIComponent(t.kw.replace(/\s+/g, ""))}`, title: "TikTok", sourceType: "tiktok", supports: "trend", relevance: "recent uploads" },
        ],
        selfAssessment: {
          viralPotential: 70 + ((seed * 3) % 20),
          affiliatePotential: 65 + ((seed * 5) % 25),
          novelty: 60 + ((seed * 7) % 30),
          trendMomentum: 62 + ((seed * 11) % 28),
          saturation,
          notes: "mock",
        },
      };
    } else if (opts.operation.startsWith("trend.pick")) {
      const m = opts.user.match(/id=(\d+)/);
      payload = {
        chosenProductId: m ? m[1] : null,
        relevance: 70 + (seed % 20),
        rejectionReason: null,
        reasoning: "Mock pick: top-ranked real listing best matches the trend.",
      };
    } else if (opts.operation.startsWith("scoring")) {
      const s = 55 + (seed % 35);
      payload = {
        viralPotentialScore: Math.min(100, s + 10),
        affiliatePotentialScore: Math.min(100, s + 5),
        noveltyScore: Math.min(100, s + 8),
        trendMomentumScore: Math.min(100, s + 3),
        saturationScore: 25 + (seed % 40),
        reasoning: "Mock scoring: emerging niche, limited saturation.",
      };
    } else if (opts.operation.startsWith("copy")) {
      payload = {
        explanationHe:
          "זהו מוצר חדש יחסית שמתחיל להופיע במספר מקורות ובסרטוני וידאו קצרים, אך עדיין לא נראה רווי לחלוטין. השילוב של שימוש יומיומי ומחיר נמוך נותן לו סיכוי טוב להפוך לפופולרי.",
        overallReasoningHe:
          "האותות החברתיים מצביעים על עניין גובר בעיקר ב-TikTok וב-YouTube, עם נוכחות בינונית בשאר הפלטפורמות.",
      };
    } else {
      payload = {};
    }

    return {
      text: JSON.stringify(payload),
      model: "mock-1",
      webSources: [],
      usage: { input: 100, output: 200 },
      raw: { mock: true },
    };
  }
}
