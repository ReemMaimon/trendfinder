import { logger } from "@/lib/logger";
import { searchAliExpress, type AeSearchItem } from "./aeSearch";

/**
 * TrendFinder does NOT use a private AliExpress API and does NOT let the LLM
 * invent product URLs / images (it hallucinates fake item ids). Instead:
 *
 *   1. the AI produces the TREND + a set of search phrases
 *   2. THIS service runs those phrases against AliExpress's real public search
 *      results page and parses the embedded product JSON
 *   3. every product returned is a real listing — real id, real canonical URL,
 *      real image, real price, real rating, real order count
 *
 * The AI then only picks the best match from these real candidates.
 */

const AE_HOST_RE = /(^|\.)aliexpress\.com$/i;

export interface RealProduct {
  aeTitle: string;
  aeUrl: string;
  aeProductId: string;
  aeStoreName: string | null;
  aeImages: string[];
  aeRating: number | null;
  aeOrders: number | null;
  priceOriginal: number | null;
  currencyOriginal: string | null;
  priceShipping: number | null;
  shippingVerified: boolean;
  aeVariants: null;
  dataConfidence: Record<string, "VERIFIED" | "ESTIMATED" | "UNAVAILABLE">;
}

export interface TrendProductSearch {
  query: string;
  results: AeSearchItem[];
}

function toRealProduct(item: AeSearchItem): RealProduct {
  return {
    aeTitle: item.title,
    aeUrl: item.url,
    aeProductId: item.productId,
    aeStoreName: item.storeName,
    aeImages: item.images,
    aeRating: item.rating,
    aeOrders: item.orders,
    priceOriginal: item.priceOriginal,
    currencyOriginal: item.currencyOriginal,
    priceShipping: null,
    shippingVerified: false,
    aeVariants: null,
    dataConfidence: {
      title: "VERIFIED",
      url: "VERIFIED",
      images: item.images.length ? "VERIFIED" : "UNAVAILABLE",
      price: item.priceOriginal != null ? "VERIFIED" : "UNAVAILABLE",
      rating: item.rating != null ? "VERIFIED" : "UNAVAILABLE",
      orders: item.orders != null ? "VERIFIED" : "UNAVAILABLE",
      shipping: "UNAVAILABLE",
    },
  };
}

function canonicalUrl(rawUrl: string): { url: string; id: string | null } {
  try {
    const u = new URL(rawUrl.trim());
    if (!AE_HOST_RE.test(u.hostname)) return { url: rawUrl, id: null };
    const m = u.pathname.match(/\/item\/(?:[\w-]+\/)?(\d{6,})\.html/);
    if (m) return { url: `https://www.aliexpress.com/item/${m[1]}.html`, id: m[1] };
    u.search = "";
    u.hash = "";
    return { url: u.toString(), id: null };
  } catch {
    return { url: rawUrl, id: null };
  }
}

export const AliExpressResearchService = {
  /**
   * Run each search phrase against AliExpress and collect real, de-duplicated
   * candidate products for a trend.
   */
  async gatherCandidates(
    queries: string[],
    opts: {
      excludeProductIds?: Set<string>;
      perQuery?: number;
      maxTotal?: number;
      /** hard cap on `priceOriginal` (search currency = USD). */
      maxPriceUsd?: number;
    } = {},
  ): Promise<{ searches: TrendProductSearch[]; candidates: AeSearchItem[] }> {
    const exclude = opts.excludeProductIds ?? new Set<string>();
    const seen = new Set<string>();
    const searches: TrendProductSearch[] = [];
    const candidates: AeSearchItem[] = [];

    for (const query of queries.slice(0, 6)) {
      const results = await searchAliExpress(query, {
        limit: opts.perQuery ?? 12,
        maxPriceUsd: opts.maxPriceUsd,
      });
      searches.push({ query, results });
      for (const r of results) {
        if (exclude.has(r.productId) || seen.has(r.productId)) continue;
        // must have an image and a price to be usable
        if (!r.images.length || r.priceOriginal == null) continue;
        if (opts.maxPriceUsd && r.priceOriginal > opts.maxPriceUsd) continue;
        seen.add(r.productId);
        candidates.push(r);
      }
      if (candidates.length >= (opts.maxTotal ?? 24)) break;
    }

    candidates.sort((a, b) => b._score - a._score);
    logger.info(
      { queries: queries.length, candidates: candidates.length },
      "AliExpress candidate gathering complete",
    );
    return { searches, candidates: candidates.slice(0, opts.maxTotal ?? 24) };
  },

  /** Convert a chosen real search item into the stored product shape. */
  toRealProduct,

  /**
   * Quality gate for a real product. Because the data now comes from the real
   * listing JSON, this mostly guards against thin results.
   */
  qualityCheck(p: RealProduct): { ok: boolean; reason?: string } {
    if (!p.aeUrl || !AE_HOST_RE.test(new URL(p.aeUrl).hostname))
      return { ok: false, reason: "invalid product URL" };
    if (!p.aeTitle || p.aeTitle.length < 5)
      return { ok: false, reason: "missing product title" };
    if (!p.aeImages.length) return { ok: false, reason: "no product image" };
    if (p.priceOriginal == null) return { ok: false, reason: "no price" };
    return { ok: true };
  },

  canonicalUrl,
};
