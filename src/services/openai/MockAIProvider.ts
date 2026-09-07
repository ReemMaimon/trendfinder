import type { AIProvider, AICallOptions, AITextResult } from "./OpenAIService";

/**
 * Deterministic offline AI provider. Used when AI_PROVIDER=mock (CI, offline
 * dev, and the automated test suite). It returns well-formed research /
 * scoring / copy payloads so the ENTIRE pipeline — validation, scoring,
 * diversity, dedup, fallback, persistence, publishing — can be exercised
 * without network access or an API key.
 *
 * NOTE: the URLs/prices here are synthetic and clearly fictional. Real
 * discovery only happens with AI_PROVIDER=openai + web search.
 */

const MOCK_TRENDS = [
  {
    title: "Magnetic modular desk cable organizer",
    category: "Gadgets",
    keyword: "magnetic cable organizer desk",
    desc: "A small magnetic puck system that snaps loose charging cables to the desk edge. Short clips showing the 'before/after' of a messy desk are spreading on productivity TikTok.",
    price: 6.42,
  },
  {
    title: "Silicone collapsible pour-over coffee dripper",
    category: "Kitchen",
    keyword: "collapsible silicone coffee dripper",
    desc: "A flat-packing silicone V60-style dripper aimed at campers and small kitchens. Coffee creators are showing it as a travel upgrade.",
    price: 4.11,
  },
  {
    title: "Grip-strength trainer with app-tracked reps",
    category: "Fitness",
    keyword: "adjustable grip strength trainer counter",
    desc: "An adjustable hand gripper with a built-in rep counter. Climbing and 'longevity' fitness accounts have started featuring grip training.",
    price: 8.9,
  },
  {
    title: "Sunset projection lamp for room videos",
    category: "Home",
    keyword: "sunset projection lamp usb",
    desc: "A compact USB lamp projecting a warm sunset arc on the wall, used as a backdrop in room-tour and 'get ready with me' videos.",
    price: 5.75,
  },
  {
    title: "Mini thermal label printer for home organizing",
    category: "Home",
    keyword: "mini thermal label printer bluetooth",
    desc: "A pocket Bluetooth thermal printer for pantry and cable labels. Home-organizing creators show label-everything routines.",
    price: 13.2,
  },
  {
    title: "Magnetic wrist band for small screws",
    category: "Accessories",
    keyword: "magnetic wristband screws tool",
    desc: "A magnetic wristband holding screws while assembling furniture. DIY and 'oddly satisfying assembly' clips feature it.",
    price: 3.35,
  },
  {
    title: "Compact electric spice grinder rechargeable",
    category: "Kitchen",
    keyword: "rechargeable electric spice grinder usb",
    desc: "A one-hand rechargeable grinder for pepper and salt shown in cooking transitions.",
    price: 7.6,
  },
  {
    title: "Posture-correcting laptop riser foldable",
    category: "Technology",
    keyword: "foldable invisible laptop stand",
    desc: "An ultra-thin adhesive folding laptop stand carried in a bag, appearing in remote-work setup videos.",
    price: 5.2,
  },
];

let call = 0;

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function buildCandidate(seed: number): any {
  const t = pick(MOCK_TRENDS, seed);
  const id = 1005000000000 + seed * 137;
  const saturation = 30 + ((seed * 7) % 40);
  return {
    trend: {
      title: t.title,
      description: t.desc,
      category: t.category,
      whyEmergingNotSaturated:
        "Signals are recent and concentrated in a few niches; mainstream retail coverage is still limited.",
      keywordsSearched: [t.keyword, `site:aliexpress.com ${t.keyword}`],
    },
    productFound: true,
    rejectionReason: null,
    product: {
      aeTitle: `${t.title} (AliExpress listing, mock)`,
      aeDescription: `Synthetic description for offline testing of "${t.title}".`,
      aeUrl: `https://www.aliexpress.com/item/${id}.html`,
      aeProductId: String(id),
      aeStoreName: `Mock Store ${((seed % 5) + 1)}`,
      aeImages: [
        `https://ae01.alicdn.com/kf/mock_${id}_1.jpg`,
        `https://ae01.alicdn.com/kf/mock_${id}_2.jpg`,
      ],
      aeRating: 4.3 + ((seed % 6) * 0.1),
      aeOrders: 200 + seed * 173,
      priceOriginal: t.price,
      currencyOriginal: "USD",
      priceShipping: seed % 3 === 0 ? 0 : null,
      shippingVerified: seed % 3 === 0,
      aeVariants:
        seed % 2 === 0
          ? [{ name: "Color", options: ["Black", "White", "Blue"] }]
          : null,
      dataConfidence: {
        title: "VERIFIED",
        price: "VERIFIED",
        rating: "ESTIMATED",
        orders: "ESTIMATED",
        images: "VERIFIED",
        shipping: seed % 3 === 0 ? "VERIFIED" : "UNAVAILABLE",
        url: "VERIFIED",
      },
      candidateListingsCompared: [
        { url: `https://www.aliexpress.com/item/${id + 1}.html`, note: "fewer orders" },
        { url: `https://www.aliexpress.com/item/${id + 2}.html`, note: "higher price" },
      ],
    },
    socialSignals: {
      tiktok: { level: seed % 2 ? "HIGH" : "MEDIUM", reasoning: "Several recent videos in the category." },
      instagram: { level: "MEDIUM", reasoning: "Reels appearing from mid-size accounts." },
      youtube: { level: seed % 3 ? "MEDIUM" : "HIGH", reasoning: "Short-form and a few review videos." },
      googleTrends: { level: seed % 2 ? "MEDIUM" : "LOW", reasoning: "Breakout-ish but low absolute volume." },
      verifiedMetrics: null,
    },
    sources: [
      {
        url: `https://www.tiktok.com/tag/${encodeURIComponent(t.keyword.replace(/\s+/g, ""))}`,
        title: "TikTok hashtag",
        sourceType: "tiktok",
        supports: "trend",
        relevance: "Recent uploads in the niche",
      },
      {
        url: `https://www.aliexpress.com/item/${id}.html`,
        title: "AliExpress product",
        sourceType: "aliexpress",
        supports: "product",
        relevance: "Best matching listing",
      },
    ],
    selfAssessment: {
      viralPotential: 70 + ((seed * 3) % 20),
      affiliatePotential: 65 + ((seed * 5) % 25),
      novelty: 60 + ((seed * 7) % 30),
      trendMomentum: 62 + ((seed * 11) % 28),
      saturation,
      notes: "Mock self-assessment.",
    },
  };
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generate(opts: AICallOptions): Promise<AITextResult> {
    call += 1;
    const seed = call;
    let payload: unknown;

    if (opts.operation.startsWith("trend.research")) {
      // occasionally simulate "no product" to exercise rejection + retry
      const c = buildCandidate(seed);
      if (seed % 11 === 0) {
        c.productFound = false;
        c.rejectionReason = "No verifiable AliExpress listing with sufficient data (mock).";
        (c as any).product = null;
      }
      payload = c;
    } else if (opts.operation.startsWith("scoring")) {
      const s = 55 + (seed % 35);
      payload = {
        viralPotentialScore: Math.min(100, s + 10),
        affiliatePotentialScore: Math.min(100, s + 5),
        noveltyScore: Math.min(100, s + 8),
        trendMomentumScore: Math.min(100, s + 3),
        saturationScore: 25 + (seed % 40),
        reasoning: "Mock scoring: emerging niche with limited saturation.",
      };
    } else if (opts.operation.startsWith("copy")) {
      payload = {
        explanationHe:
          "זהו מוצר חדש יחסית שמתחיל להופיע במספר מקורות ברשת ובסרטוני וידאו קצרים, אך עדיין לא נראה רווי לחלוטין. השילוב של שימוש יומיומי ומחיר נמוך נותן לו סיכוי טוב להפוך לפופולרי.",
        overallReasoningHe:
          "האותות החברתיים מצביעים על עניין גובר בעיקר ב-TikTok וב-YouTube, עם נוכחות בינונית בשאר הפלטפורמות.",
      };
    } else {
      payload = {};
    }

    return {
      text: JSON.stringify(payload),
      model: "mock-1",
      webSources:
        opts.webSearch && (payload as any)?.sources
          ? (payload as any).sources.map((s: any) => ({ url: s.url, title: s.title }))
          : [],
      usage: { input: 100, output: 200 },
      raw: { mock: true },
    };
  }
}
