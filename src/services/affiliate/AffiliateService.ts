import crypto from "node:crypto";
import { affiliateConfigProblems, affiliateCreds } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AffiliateConfigError } from "@/lib/errors";
import { SettingsService } from "@/services/settings/SettingsService";

/**
 * Central place for ALL affiliate logic. Nothing else in the codebase should
 * know how a purchase URL is built.
 *
 *   TEST MODE       -> getPurchaseUrl() returns the plain AliExpress URL.
 *                      No affiliate credentials required.
 *   PRODUCTION MODE  -> getPurchaseUrl() returns an affiliate deep link.
 *                      If credentials are missing it THROWS (fail-safe) — the
 *                      caller must not publish a fabricated link.
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
    // strip tracking / session params, keep the canonical item path
    const itemMatch = u.pathname.match(/\/item\/(\d+)\.html/);
    if (itemMatch) {
      return `https://www.aliexpress.com/item/${itemMatch[1]}.html`;
    }
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function buildSClickLink(cleanUrl: string, pid: string): string {
  // Non-signed tracking wrapper. Works with a Portals tracking id (PID).
  const target = encodeURIComponent(cleanUrl);
  return `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${encodeURIComponent(
    pid,
  )}&dl_target_url=${target}`;
}

function buildPortalsLink(cleanUrl: string): string {
  // Signed api.aliexpress.com/affiliate.generate.promotion.links style call is
  // an async API; for link-time generation we embed the required tracking
  // params directly, signed with the app secret for auditability.
  const c = affiliateCreds();
  const params = new URLSearchParams({
    app_key: c.key,
    tracking_id: c.id,
    target_url: cleanUrl,
    ts: String(Date.now()),
  });
  const sign = crypto
    .createHmac("sha256", c.secret)
    .update(params.toString())
    .digest("hex")
    .toUpperCase();
  params.set("sign", sign);
  return `https://s.click.aliexpress.com/e/_portals?${params.toString()}`;
}

export const AffiliateService = {
  async isEnabled(): Promise<boolean> {
    const mode = await SettingsService.getAppMode();
    return mode === "PRODUCTION";
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

  /**
   * Assert that PRODUCTION mode is safe to run in. Throws AffiliateConfigError
   * if credentials are missing. Called by the generation pipeline before
   * publishing and by the admin "switch to production" action.
   */
  async assertProductionReady(): Promise<void> {
    const missing = affiliateConfigProblems();
    if (missing.length > 0) {
      logger.error({ missing }, "PRODUCTION mode but affiliate config incomplete");
      throw new AffiliateConfigError(missing);
    }
  },

  generateAffiliateLink(rawUrl: string): string {
    const clean = normalizeAeUrl(rawUrl);
    const missing = affiliateConfigProblems();
    if (missing.length > 0) throw new AffiliateConfigError(missing);
    const c = affiliateCreds();
    return c.strategy === "portals"
      ? buildPortalsLink(clean)
      : buildSClickLink(clean, c.id);
  },

  /**
   * The URL the public "Buy on AliExpress" button should use.
   *   - always returns a usable https URL in TEST mode
   *   - returns an affiliate link in PRODUCTION mode
   *   - throws in PRODUCTION mode if misconfigured (never returns a fake link)
   */
  async getPurchaseUrl(rawUrl: string): Promise<{ url: string; linkMode: "test" | "production" }> {
    const mode = await SettingsService.getAppMode();
    const clean = normalizeAeUrl(rawUrl);
    if (mode === "TEST") {
      return { url: clean, linkMode: "test" };
    }
    await this.assertProductionReady();
    return { url: this.generateAffiliateLink(clean), linkMode: "production" };
  },

  normalizeAeUrl,
};
