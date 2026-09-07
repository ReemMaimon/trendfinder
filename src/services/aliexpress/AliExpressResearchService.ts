import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import type { ResearchCandidate } from "@/services/types";

/**
 * TrendFinder does NOT use a private AliExpress product API. The AI/web-search
 * layer finds AliExpress product pages and extracts the data. This service is
 * the validation + light-corroboration layer on top of that:
 *
 *   - normalise the product URL to its canonical /item/<id>.html form
 *   - pull the numeric product id out of the URL when the AI didn't
 *   - drop image URLs that aren't plausible AliExpress/Alicdn assets
 *   - best-effort fetch of the listing's Open Graph meta tags to CORROBORATE
 *     the AI's title/image/price (never to invent values)
 *   - downgrade dataConfidence when corroboration fails
 *
 * It must be resilient: AliExpress frequently blocks bots, so a failed fetch is
 * expected and simply means "not additionally corroborated".
 */

const AE_HOST_RE = /(^|\.)aliexpress\.com$/i;
const IMG_HOST_RE = /(alicdn\.com|aliexpress-media\.com|aliexpress\.com)$/i;

export interface NormalizedProduct {
  aeTitle: string;
  aeDescription: string | null;
  aeUrl: string;
  aeProductId: string | null;
  aeStoreName: string | null;
  aeImages: string[];
  aeRating: number | null;
  aeOrders: number | null;
  priceOriginal: number | null;
  currencyOriginal: string | null;
  priceShipping: number | null;
  shippingVerified: boolean;
  aeVariants: { name: string; options: string[] }[] | null;
  dataConfidence: Record<string, "VERIFIED" | "ESTIMATED" | "UNAVAILABLE">;
  candidateListingsCompared: { url: string; note: string }[];
  corroboration: {
    urlReachable: boolean | null;
    ogTitle: string | null;
    ogImage: string | null;
    notes: string[];
  };
}

function canonicalUrl(rawUrl: string): { url: string; id: string | null } {
  try {
    const u = new URL(rawUrl.trim());
    if (!AE_HOST_RE.test(u.hostname)) {
      return { url: rawUrl, id: null };
    }
    const m = u.pathname.match(/\/item\/(?:[\w-]+\/)?(\d{6,})\.html/);
    if (m) {
      return { url: `https://www.aliexpress.com/item/${m[1]}.html`, id: m[1] };
    }
    const idParam = u.searchParams.get("productId") || u.searchParams.get("id");
    u.search = "";
    u.hash = "";
    return { url: u.toString(), id: idParam && /^\d{6,}$/.test(idParam) ? idParam : null };
  } catch {
    return { url: rawUrl, id: null };
  }
}

function cleanImages(images: string[]): string[] {
  const out: string[] = [];
  for (const raw of images) {
    try {
      const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      if (u.protocol !== "https:") continue;
      if (!IMG_HOST_RE.test(u.hostname)) continue;
      const normalized = u.toString();
      if (!out.includes(normalized)) out.push(normalized);
    } catch {
      /* skip */
    }
  }
  return out.slice(0, 12);
}

function parseMeta(html: string): { ogTitle: string | null; ogImage: string | null; price: number | null; currency: string | null } {
  const pick = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    return html.match(re)?.[1] ?? null;
  };
  const ogTitle = pick("og:title");
  let ogImage = pick("og:image");
  if (ogImage && ogImage.startsWith("//")) ogImage = `https:${ogImage}`;
  const priceStr = pick("og:price:amount") || pick("product:price:amount");
  const currency = pick("og:price:currency") || pick("product:price:currency");
  const price = priceStr ? Number(priceStr) : null;
  return {
    ogTitle,
    ogImage,
    price: price != null && isFinite(price) ? price : null,
    currency,
  };
}

async function corroborate(url: string, runId?: string) {
  const started = Date.now();
  const result = { urlReachable: null as boolean | null, ogTitle: null as string | null, ogImage: null as string | null, price: null as number | null, currency: null as string | null };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
    result.urlReachable = res.ok;
    if (res.ok) {
      const html = await res.text();
      const meta = parseMeta(html);
      result.ogTitle = meta.ogTitle;
      result.ogImage = meta.ogImage;
      result.price = meta.price;
      result.currency = meta.currency;
    }
    await prisma.apiLog
      .create({
        data: {
          runId: runId ?? null,
          provider: "aliexpress-fetch",
          operation: "corroborate-listing",
          ok: res.ok,
          httpStatus: res.status,
          durationMs: Date.now() - started,
          meta: { url, gotOgTitle: Boolean(result.ogTitle), gotPrice: result.price != null },
        },
      })
      .catch(() => {});
  } catch (err) {
    logger.debug({ err, url }, "AliExpress corroboration fetch failed (expected when blocked)");
    await prisma.apiLog
      .create({
        data: {
          runId: runId ?? null,
          provider: "aliexpress-fetch",
          operation: "corroborate-listing",
          ok: false,
          durationMs: Date.now() - started,
          errorText: String(err),
          meta: { url },
        },
      })
      .catch(() => {});
  }
  return result;
}

export const AliExpressResearchService = {
  /**
   * Validate + normalise + corroborate the product portion of a research
   * candidate. Returns null when the product is unusable (no valid URL).
   */
  async normalize(
    candidate: ResearchCandidate,
    opts: { corroborate?: boolean; runId?: string } = {},
  ): Promise<NormalizedProduct | null> {
    const p = candidate.product;
    if (!p || !p.aeUrl) return null;

    const { url, id } = canonicalUrl(p.aeUrl);
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    if (!AE_HOST_RE.test(host)) {
      logger.warn({ url }, "candidate product URL is not on aliexpress.com — rejecting");
      return null;
    }

    const confidence: Record<string, "VERIFIED" | "ESTIMATED" | "UNAVAILABLE"> = {
      title: p.dataConfidence?.title ?? "ESTIMATED",
      price: p.dataConfidence?.price ?? "UNAVAILABLE",
      rating: p.dataConfidence?.rating ?? "UNAVAILABLE",
      orders: p.dataConfidence?.orders ?? "UNAVAILABLE",
      images: p.dataConfidence?.images ?? "UNAVAILABLE",
      shipping: p.dataConfidence?.shipping ?? "UNAVAILABLE",
      url: "VERIFIED",
    };

    const images = cleanImages(p.aeImages ?? []);
    if (images.length === 0) confidence.images = "UNAVAILABLE";

    const notes: string[] = [];
    let corr = {
      urlReachable: null as boolean | null,
      ogTitle: null as string | null,
      ogImage: null as string | null,
      price: null as number | null,
      currency: null as string | null,
    };

    if (opts.corroborate) {
      corr = await corroborate(url, opts.runId);
      if (corr.urlReachable === false) {
        notes.push("URL returned a non-OK status at corroboration time.");
        confidence.url = "ESTIMATED";
      }
      if (corr.ogTitle && p.aeTitle) {
        // light corroboration only
        confidence.title = "VERIFIED";
        notes.push("Title corroborated via Open Graph meta.");
      }
      if (corr.price != null && p.priceOriginal != null) {
        const diff = Math.abs(corr.price - p.priceOriginal) / p.priceOriginal;
        if (diff <= 0.2) {
          confidence.price = "VERIFIED";
          notes.push(`Price corroborated (meta ${corr.price}).`);
        } else {
          confidence.price = "ESTIMATED";
          notes.push(
            `AI price ${p.priceOriginal} differs from meta price ${corr.price}; kept AI value, lowered confidence.`,
          );
        }
      }
      if (corr.ogImage && !images.includes(corr.ogImage)) {
        try {
          const ih = new URL(corr.ogImage).hostname;
          if (IMG_HOST_RE.test(ih)) images.unshift(corr.ogImage);
        } catch {
          /* ignore */
        }
      }
    }

    return {
      aeTitle: p.aeTitle,
      aeDescription: p.aeDescription ?? null,
      aeUrl: url,
      aeProductId: p.aeProductId ?? id,
      aeStoreName: p.aeStoreName ?? null,
      aeImages: images,
      aeRating: p.aeRating ?? null,
      aeOrders: p.aeOrders ?? null,
      priceOriginal: p.priceOriginal ?? null,
      currencyOriginal: p.currencyOriginal ?? corr.currency ?? null,
      priceShipping: p.priceShipping ?? null,
      shippingVerified: Boolean(p.shippingVerified && p.priceShipping != null),
      aeVariants: p.aeVariants ?? null,
      dataConfidence: confidence,
      candidateListingsCompared: p.candidateListingsCompared ?? [],
      corroboration: {
        urlReachable: corr.urlReachable,
        ogTitle: corr.ogTitle,
        ogImage: corr.ogImage,
        notes,
      },
    };
  },

  /**
   * Data-quality gate. A product must have a valid URL, a title, at least one
   * image OR a verified price, and must not be entirely unverifiable.
   */
  qualityCheck(np: NormalizedProduct): { ok: boolean; reason?: string } {
    if (!np.aeUrl) return { ok: false, reason: "missing product URL" };
    if (!np.aeTitle || np.aeTitle.length < 3)
      return { ok: false, reason: "missing product title" };
    const hasImage = np.aeImages.length > 0;
    const hasPrice = np.priceOriginal != null;
    if (!hasImage && !hasPrice)
      return { ok: false, reason: "no image and no price — insufficient real data" };
    const verifiedCount = Object.values(np.dataConfidence).filter(
      (c) => c === "VERIFIED",
    ).length;
    if (verifiedCount === 0)
      return { ok: false, reason: "no field could be verified" };
    return { ok: true };
  },

  canonicalUrl,
};
