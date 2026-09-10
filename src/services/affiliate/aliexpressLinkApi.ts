import crypto from "node:crypto";
import { affiliateCreds } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

/**
 * Official AliExpress affiliate link generation:
 *   method = aliexpress.affiliate.link.generate
 *   gateway = https://api-sg.aliexpress.com/sync  (TOP-style signing)
 *
 * Turns a plain product URL into a commission-tracked
 * https://s.click.aliexpress.com/e/_xxx link tied to your tracking id.
 *
 * Requires ALIEXPRESS_AFFILIATE_KEY + _SECRET + _ID.
 */

export interface LinkApiResult {
  links: Map<string, string>; // source url -> promotion link
  ok: boolean;
  error?: string;
}

/** TOP signature: sorted key+value concat, HMAC-SHA256(secret), uppercase hex. */
function sign(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

function deepFind(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = deepFind(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

export async function generatePromotionLinks(
  sourceUrls: string[],
  opts: { promotionLinkType?: "0" | "2" } = {},
): Promise<LinkApiResult> {
  const c = affiliateCreds();
  const urls = [...new Set(sourceUrls.filter(Boolean))].slice(0, 50);
  if (urls.length === 0) return { links: new Map(), ok: true };
  if (!c.key || !c.secret || !c.id) {
    return { links: new Map(), ok: false, error: "affiliate key/secret/id not configured" };
  }

  const params: Record<string, string> = {
    method: "aliexpress.affiliate.link.generate",
    app_key: c.key,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    promotion_link_type: opts.promotionLinkType ?? "0",
    source_values: urls.join(","),
    tracking_id: c.id,
  };
  params.sign = sign(params, c.secret);

  const started = Date.now();
  const body = new URLSearchParams(params).toString();
  try {
    const res = await fetch(c.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(12000),
    });
    const json = await res.json().catch(() => ({}));

    const errResp = (json as any).error_response;
    if (errResp) {
      const msg = `${errResp.code}: ${errResp.sub_msg || errResp.msg}`;
      await logApi(false, Date.now() - started, res.status, msg, urls.length);
      return { links: new Map(), ok: false, error: msg };
    }

    const respResult = deepFind(json, "resp_result");
    if (respResult && respResult.resp_code && respResult.resp_code !== 200) {
      const msg = `resp_code ${respResult.resp_code}: ${respResult.resp_msg}`;
      await logApi(false, Date.now() - started, res.status, msg, urls.length);
      return { links: new Map(), ok: false, error: msg };
    }

    const arr = deepFind(json, "promotion_link");
    const list: any[] = Array.isArray(arr) ? arr : arr ? [arr] : [];
    const links = new Map<string, string>();
    for (const item of list) {
      if (item?.source_value && item?.promotion_link) {
        links.set(item.source_value, item.promotion_link);
      }
    }

    await logApi(links.size > 0, Date.now() - started, res.status, undefined, urls.length, links.size);
    if (links.size === 0) {
      return { links, ok: false, error: "API returned no promotion links" };
    }
    return { links, ok: true };
  } catch (err) {
    logger.warn({ err }, "AliExpress affiliate link API call failed");
    await logApi(false, Date.now() - started, undefined, String(err), urls.length);
    return { links: new Map(), ok: false, error: String(err) };
  }
}

async function logApi(
  ok: boolean,
  durationMs: number,
  httpStatus: number | undefined,
  errorText: string | undefined,
  requested: number,
  generated?: number,
) {
  await prisma.apiLog
    .create({
      data: {
        provider: "aliexpress-affiliate",
        operation: "link.generate",
        ok,
        httpStatus: httpStatus ?? null,
        durationMs,
        errorText: errorText ?? null,
        meta: { requested, generated: generated ?? 0 },
      },
    })
    .catch(() => {});
}
