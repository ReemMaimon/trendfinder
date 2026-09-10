import { prisma } from "@/lib/db";
import { jerusalemDateString } from "@/lib/time";
import { CurrencyService } from "@/services/currency/CurrencyService";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { CATEGORY_LABELS_HE, normalizeCategory } from "@/config/categories";
import type { SignalLevel } from "@prisma/client";

export interface PublicProduct {
  id: string;
  slug: string;
  position: number;
  reused: boolean;
  trendTitle: string;
  trendDescription: string;
  category: string;
  categoryHe: string;
  title: string;
  description: string | null;
  images: string[];
  url: string;
  rating: number | null;
  orders: number | null;
  storeName: string | null;
  variants: { name: string; options: string[] }[] | null;
  price: {
    ils: number | null;
    ilsText: string;
    ilsTotal: number | null;
    withShipping: boolean;
    originalText: string | null;
  };
  scores: {
    overall: number;
    viral: number;
    affiliate: number;
    novelty: number;
    momentum: number;
    saturation: number;
  };
  explanationHe: string;
  social: {
    tiktok: SignalDisplay;
    instagram: SignalDisplay;
    youtube: SignalDisplay;
    googleTrends: SignalDisplay;
    reasoningHe: string;
    verifiedMetrics: Record<string, unknown> | null;
  } | null;
  dataConfidence: Record<string, unknown>;
}

export interface SignalDisplay {
  level: SignalLevel;
  labelHe: string;
  reasoning: string | null;
}

const LEVEL_LABELS_HE: Record<SignalLevel, string> = {
  VERY_HIGH: "גבוה מאוד",
  HIGH: "גבוה",
  MEDIUM: "בינוני",
  LOW: "נמוך",
  UNKNOWN: "לא ידוע",
};

function signal(level: SignalLevel, reasoning: string | null): SignalDisplay {
  return { level, labelHe: LEVEL_LABELS_HE[level], reasoning };
}

type ProductRow = Awaited<ReturnType<typeof loadRows>>[number];

async function loadRows(date: string) {
  const set = await prisma.dailyProductSet.findFirst({
    where: { date, status: "PUBLISHED" },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { product: { include: { trendReport: true } } },
      },
    },
  });
  return set?.items ?? [];
}

async function toPublic(item: ProductRow): Promise<PublicProduct> {
  const p = item.product;
  const tr = p.trendReport;
  const ilsText = p.priceIls != null ? CurrencyService.formatIls(p.priceIls) : "לא זמין";

  const originalText =
    p.priceOriginal != null && p.currencyOriginal
      ? `${p.priceOriginal.toFixed(2)} ${p.currencyOriginal}`
      : null;

  return {
    id: p.id,
    slug: p.slug,
    position: item.position,
    reused: item.reused,
    trendTitle: p.trendTitle,
    trendDescription: p.trendDescription,
    category: p.category,
    categoryHe: CATEGORY_LABELS_HE[normalizeCategory(p.category)],
    title: p.aeTitle,
    description: p.aeDescription,
    images: (p.aeImages as string[]) ?? [],
    url: p.aeUrl,
    rating: p.aeRating,
    orders: p.aeOrders,
    storeName: p.aeStoreName,
    variants: (p.aeVariants as { name: string; options: string[] }[] | null) ?? null,
    price: {
      ils: p.priceIls,
      ilsText,
      ilsTotal: p.priceIlsTotal,
      withShipping: p.shippingVerified && p.priceIlsTotal != null,
      originalText,
    },
    scores: {
      overall: p.overallScore,
      viral: p.viralPotentialScore,
      affiliate: p.affiliatePotentialScore,
      novelty: p.noveltyScore,
      momentum: p.trendMomentumScore,
      saturation: p.saturationScore,
    },
    explanationHe: p.explanationHe,
    social: tr
      ? {
          tiktok: signal(tr.tiktokLevel, tr.tiktokReasoning),
          instagram: signal(tr.instagramLevel, tr.instagramReasoning),
          youtube: signal(tr.youtubeLevel, tr.youtubeReasoning),
          googleTrends: signal(tr.googleTrendsLevel, tr.googleTrendsReasoning),
          reasoningHe: tr.overallReasoningHe,
          verifiedMetrics: (tr.verifiedMetrics as Record<string, unknown> | null) ?? null,
        }
      : null,
    dataConfidence: (p.dataConfidence as Record<string, unknown>) ?? {},
  };
}

export const PublicService = {
  /** Today's published 3 products (Asia/Jerusalem). Empty if not generated yet
   *  (or if the database is temporarily unreachable). */
  async today(date = jerusalemDateString()): Promise<{ date: string; products: PublicProduct[] }> {
    try {
      const rows = await loadRows(date);
      const products = await Promise.all(rows.map(toPublic));
      return { date, products };
    } catch (err) {
      const { logger } = await import("@/lib/logger");
      logger.error({ err }, "PublicService.today failed");
      return { date, products: [] };
    }
  },

  async productBySlug(slug: string): Promise<PublicProduct | null> {
    let p;
    try {
      p = await prisma.product.findUnique({
        where: { slug },
        include: { trendReport: true, dailyItems: { orderBy: { id: "desc" }, take: 1 } },
      });
    } catch (err) {
      const { logger } = await import("@/lib/logger");
      logger.error({ err, slug }, "PublicService.productBySlug failed");
      return null;
    }
    if (!p) return null;
    const fakeItem = {
      position: p.dailyItems[0]?.position ?? 0,
      reused: p.dailyItems[0]?.reused ?? false,
      product: p,
    } as unknown as ProductRow;
    return toPublic(fakeItem);
  },

  /** Resolve the outbound purchase URL for the Buy button (see /api/go/[id]). */
  async purchaseUrl(productId: string): Promise<{ url: string; linkMode: "test" | "production" } | null> {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, aeUrl: true, affiliateUrl: true, affiliateUrlAt: true },
    });
    if (!p) return null;
    return AffiliateService.resolveForProduct(p);
  },
};
