import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Real AliExpress product search — no official API, no LLM guessing.
 *
 * We request the public search-results page
 *   https://www.aliexpress.com/w/wholesale-<keywords>.html
 * (forcing an en_US / USD locale via cookie) and parse the `itemList.content[]`
 * JSON that AliExpress embeds in the page. Every field returned here is real
 * data straight from that listing: product id, canonical URL, title, image,
 * price, star rating and order count.
 *
 * This is what makes "the AI searches AliExpress itself" actually work: the AI
 * only picks the trend + the search phrases; the products are real.
 */

export interface AeSearchItem {
  productId: string;
  url: string;
  title: string;
  image: string | null;
  images: string[];
  priceOriginal: number | null;
  currencyOriginal: string | null;
  rating: number | null;
  orders: number | null;
  storeName: string | null;
  /** internal ranking helper */
  _score: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const LOCALE_COOKIE =
  "aep_usuc_f=site=glo&province=&city=&c_tp=USD&region=US&b_locale=en_US";

function balancedFrom(s: string, openIdx: number): string | null {
  const open = s[openIdx];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = openIdx; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(openIdx, j + 1);
    }
  }
  return null;
}

export function parseOrders(text: string | null | undefined): number | null {
  if (!text) return null;
  // "1,000+ sold", "404 sold", "316 נמכרו", "5000+ sold"
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|K|万)?\+?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === "k" || m[2] === "K") n *= 1000;
  if (m[2] === "万") n *= 10000;
  return Math.round(n);
}

function normImg(u: string | undefined | null): string | null {
  if (!u) return null;
  let s = u.trim();
  if (s.startsWith("//")) s = "https:" + s;
  if (!s.startsWith("http")) return null;
  return s;
}

function mapItem(it: any): AeSearchItem | null {
  const productId: string | undefined = it?.productId || it?.product_id || it?.redirectedId;
  if (!productId || !/^\d{6,}$/.test(String(productId))) return null;

  const image = normImg(it?.image?.imgUrl);
  const title: string = it?.title?.displayTitle || it?.title?.seoTitle || "";
  const sale = it?.prices?.salePrice ?? it?.prices?.originalPrice;
  const priceOriginal =
    typeof sale?.minPrice === "number"
      ? sale.minPrice
      : typeof sale?.cent === "number"
        ? sale.cent / 100
        : null;
  const currencyOriginal: string | null = sale?.currencyCode ?? null;
  const rating =
    typeof it?.evaluation?.starRating === "number" ? it.evaluation.starRating : null;
  const orders = parseOrders(it?.trade?.tradeDesc);
  const storeName: string | null =
    it?.store?.storeName || it?.storeInfo?.storeName || null;

  if (!title || !image) return null;

  // ranking: real traction first, then rating, small novelty bonus for mid-volume
  const o = orders ?? 0;
  const r = rating ?? 0;
  const _score =
    Math.log10(o + 1) * 10 + r * 4 + (o >= 50 && o <= 5000 ? 3 : 0);

  return {
    productId: String(productId),
    url: `https://www.aliexpress.com/item/${productId}.html`,
    title: title.slice(0, 400),
    image,
    images: image ? [image] : [],
    priceOriginal,
    currencyOriginal,
    rating,
    orders,
    storeName,
    _score,
  };
}

async function fetchSearchHtml(keywords: string, maxPriceUsd?: number): Promise<string | null> {
  const slug = encodeURIComponent(keywords.trim().replace(/\s+/g, "-").slice(0, 120));
  let url = `https://www.aliexpress.com/w/wholesale-${slug}.html`;
  if (maxPriceUsd && maxPriceUsd > 0) {
    // AliExpress search understands minPrice/maxPrice (in the request currency,
    // which our LOCALE_COOKIE pins to USD).
    url += `?minPrice=0&maxPrice=${Math.ceil(maxPriceUsd)}`;
  }
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
        Cookie: LOCALE_COOKIE,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const html = res.ok ? await res.text() : "";
    await prisma.apiLog
      .create({
        data: {
          provider: "aliexpress-fetch",
          operation: "search",
          ok: res.ok,
          httpStatus: res.status,
          durationMs: Date.now() - started,
          meta: { keywords, htmlLen: html.length },
        },
      })
      .catch(() => {});
    return res.ok ? html : null;
  } catch (err) {
    logger.warn({ err, keywords }, "AliExpress search fetch failed");
    await prisma.apiLog
      .create({
        data: {
          provider: "aliexpress-fetch",
          operation: "search",
          ok: false,
          durationMs: Date.now() - started,
          errorText: String(err),
          meta: { keywords },
        },
      })
      .catch(() => {});
    return null;
  }
}

function extractItems(html: string): any[] {
  // The search page embeds ...fields":{"mods":{... "itemList":{"content":[ ... ]}}}
  let idx = html.indexOf('"itemList":');
  while (idx !== -1) {
    const braceIdx = html.indexOf("{", idx);
    if (braceIdx === -1) break;
    const objStr = balancedFrom(html, braceIdx);
    if (objStr) {
      try {
        const obj = JSON.parse(objStr);
        if (Array.isArray(obj?.content) && obj.content.some((x: any) => x?.productId)) {
          return obj.content;
        }
      } catch {
        /* try next occurrence */
      }
    }
    idx = html.indexOf('"itemList":', idx + 1);
  }
  return [];
}

let lastFetchAt = 0;

/**
 * Search AliExpress for `keywords`. Returns real listings, best first.
 * Politely throttled to avoid hammering AliExpress.
 */
/** Deterministic synthetic results for offline / CI runs (AI_PROVIDER=mock). */
function mockResults(keywords: string, limit: number): AeSearchItem[] {
  const seed = [...keywords].reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: Math.min(limit, 6) }, (_, i) => {
    const id = 1005000000000 + seed * 1000 + i;
    const orders = 120 + ((seed + i * 37) % 4000);
    return {
      productId: String(id),
      url: `https://www.aliexpress.com/item/${id}.html`,
      title: `${keywords} — variant ${i + 1} (offline mock)`,
      image: `https://ae01.alicdn.com/kf/mock_${id}.jpg`,
      images: [`https://ae01.alicdn.com/kf/mock_${id}.jpg`],
      priceOriginal: Math.round((3 + ((seed + i) % 20) + 0.99) * 100) / 100,
      currencyOriginal: "USD",
      rating: 4 + ((seed + i) % 10) / 10,
      orders,
      storeName: `Mock Store ${(i % 4) + 1}`,
      _score: Math.log10(orders + 1) * 10 + 4.4 * 4,
    };
  });
}

export async function searchAliExpress(
  keywords: string,
  opts: { limit?: number; maxPriceUsd?: number } = {},
): Promise<AeSearchItem[]> {
  if (env.AI_PROVIDER === "mock") {
    const m = mockResults(keywords, opts.limit ?? 20);
    return opts.maxPriceUsd
      ? m.filter((x) => x.priceOriginal == null || x.priceOriginal <= opts.maxPriceUsd!)
      : m;
  }
  const wait = 1200 - (Date.now() - lastFetchAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();

  const html = await fetchSearchHtml(keywords, opts.maxPriceUsd);
  if (!html) return [];
  const raw = extractItems(html);
  let items = raw
    .map(mapItem)
    .filter((x): x is AeSearchItem => x !== null);
  if (opts.maxPriceUsd && opts.maxPriceUsd > 0) {
    // belt-and-braces: AliExpress sometimes ignores the URL price filter
    items = items.filter((x) => x.priceOriginal != null && x.priceOriginal <= opts.maxPriceUsd!);
  }
  items.sort((a, b) => b._score - a._score);

  logger.info({ keywords, found: items.length, maxPriceUsd: opts.maxPriceUsd }, "AliExpress search");
  return items.slice(0, opts.limit ?? 20);
}
