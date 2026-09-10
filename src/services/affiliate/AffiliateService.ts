import crypto from "node:crypto";
import { affiliateConfigProblems, affiliateCreds } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { AffiliateConfigError } from "@/lib/errors";
import { SettingsService } from "@/services/settings/SettingsService";
import { generatePromotionLinks } from "./aliexpressLinkApi";

/**
 * Central place for ALL affiliate logic. Nothing else in the codebase should
 * know how a purchase URL is built.
 *
 *   TEST MODE       -> plain AliExpress URL. No credentials required.
 *   PRODUCTION MODE  -> a commission-tracked affiliate link.
 *                       Strategy `api` calls aliexpress.affiliate.link.generate
 *                       and caches the result on the product row. If the API
 *                       fails at click time we fall back to the plain URL and
 *                       log it — the visitor is never sent to a dead link.
 */

export interface AffiliateStatus {
  mode: "TEST" | "PRODUCTION";
  enabled: boolean;
  configured: boolean;
  missing: string[];
  strategy: string;
}

function normalizeAeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const itemMatch = u.pathname.match(/\/item\/(\d+)\.html/);
    if (itemMatch) return `https://www.aliexpress.com/item/${itemMatch[1]}.html`;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function buildSClickLink(cleanUrl: string, pid: string): string {
  const target = encodeURIComponent(cleanUrl);
  return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${encodeURIComponent(pid)}&dl_target_url=${target}`;
}

function buildPortalsLink(cleanUrl: string): string {
  const c = affiliateCreds();
  const params = new URLSearchParams({
    app_key: c.key,
    tracking_id: c.id,
    target_url: cleanUrl,
    ts: String(Date.now()),
  });
  const sign = crypto.createHmac("sha256", c.secret).update(params.toString()).digest("hex").toUpperCase();
  params.set("sign", sign);
  return `https://s.click.aliexpress.com/e/_portals?${params.toString()}`;
}

const AFFILIATE_URL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // regenerate monthly

export const AffiliateService = {
  async isEnabled(): Promise<boolean> {
    return (await SettingsService.getAppMode()) === "PRODUCTION";
  },

  async status(): Promise<AffiliateStatus> {
    const mode = await SettingsService.getAppMode();
    const missing = affiliateConfigProblems();
    return {
      mode,
      enabled: mode === "PRODUCTION",
      configured: missing.length === 0,
      missing,
      strategy: affiliateCreds().strategy,
    };
  },

  async assertProductionReady(): Promise<void> {
    const missing = affiliateConfigProblems();
    if (missing.length > 0) {
      logger.error({ missing }, "PRODUCTION mode but affiliate config incomplete");
      throw new AffiliateConfigError(missing);
    }
  },

  /** Synchronous link builders for the non-API strategies. */
  buildStaticLink(rawUrl: string): string {
    const clean = normalizeAeUrl(rawUrl);
    const c = affiliateCreds();
    return c.strategy === "portals" ? buildPortalsLink(clean) : buildSClickLink(clean, c.id);
  },

  /**
   * Resolve the outbound URL for a product's Buy button.
   * TEST -> plain URL. PRODUCTION -> affiliate link (cached on the product).
   * Never throws for the public path; on any failure it returns the plain URL.
   */
  async resolveForProduct(product: {
    id: string;
    aeUrl: string;
    affiliateUrl?: string | null;
    affiliateUrlAt?: Date | null;
  }): Promise<{ url: string; linkMode: "test" | "production" }> {
    const mode = await SettingsService.getAppMode();
    const clean = normalizeAeUrl(product.aeUrl);
    if (mode === "TEST") return { url: clean, linkMode: "test" };

    const missing = affiliateConfigProblems();
    if (missing.length > 0) {
      logger.error({ missing, productId: product.id }, "PRODUCTION buy click but affiliate misconfigured — using plain URL");
      return { url: clean, linkMode: "test" };
    }

    const c = affiliateCreds();

    // non-API strategies: cheap, synchronous, no caching needed
    if (c.strategy !== "api") {
      return { url: this.buildStaticLink(product.aeUrl), linkMode: "production" };
    }

    // API strategy: use cached link if fresh
    const fresh =
      product.affiliateUrl &&
      product.affiliateUrlAt &&
      Date.now() - new Date(product.affiliateUrlAt).getTime() < AFFILIATE_URL_TTL_MS;
    if (fresh && product.affiliateUrl) {
      return { url: product.affiliateUrl, linkMode: "production" };
    }

    // generate + cache
    const res = await generatePromotionLinks([clean]);
    const link = res.links.get(clean) ?? [...res.links.values()][0];
    if (link) {
      await prisma.product
        .update({ where: { id: product.id }, data: { affiliateUrl: link, affiliateUrlAt: new Date() } })
        .catch((err) => logger.warn({ err }, "failed to cache affiliate url"));
      return { url: link, linkMode: "production" };
    }

    logger.warn({ productId: product.id, error: res.error }, "affiliate link generation failed — using plain URL");
    return { url: clean, linkMode: "test" };
  },

  /** Pre-generate + cache affiliate links for many products (admin / pipeline). */
  async pregenerate(products: { id: string; aeUrl: string }[]): Promise<{ ok: number; failed: number }> {
    if (affiliateConfigProblems().length > 0 || affiliateCreds().strategy !== "api") {
      return { ok: 0, failed: products.length };
    }
    const cleanMap = new Map(products.map((p) => [normalizeAeUrl(p.aeUrl), p.id]));
    const res = await generatePromotionLinks([...cleanMap.keys()]);
    let ok = 0;
    for (const [clean, link] of res.links) {
      const id = cleanMap.get(clean);
      if (!id) continue;
      await prisma.product
        .update({ where: { id }, data: { affiliateUrl: link, affiliateUrlAt: new Date() } })
        .then(() => ok++)
        .catch(() => {});
    }
    return { ok, failed: products.length - ok };
  },

  /** Legacy: used only by tests / the mode-switch guard. */
  async getPurchaseUrl(rawUrl: string): Promise<{ url: string; linkMode: "test" | "production" }> {
    const mode = await SettingsService.getAppMode();
    const clean = normalizeAeUrl(rawUrl);
    if (mode === "TEST") return { url: clean, linkMode: "test" };
    await this.assertProductionReady();
    const c = affiliateCreds();
    if (c.strategy === "api") {
      const res = await generatePromotionLinks([clean]);
      const link = res.links.get(clean) ?? [...res.links.values()][0];
      return link ? { url: link, linkMode: "production" } : { url: clean, linkMode: "test" };
    }
    return { url: this.buildStaticLink(clean), linkMode: "production" };
  },

  normalizeAeUrl,
};
