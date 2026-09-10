import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  mode: { value: "TEST" as "TEST" | "PRODUCTION" },
  apiLinks: { value: new Map<string, string>(), ok: true, error: undefined as string | undefined },
  productUpdate: vi.fn(async () => ({})),
}));

vi.mock("@/services/settings/SettingsService", () => ({
  SettingsService: { getAppMode: async () => h.mode.value, get: async () => ({}) },
}));
vi.mock("@/services/affiliate/aliexpressLinkApi", () => ({
  generatePromotionLinks: vi.fn(async () => ({
    links: h.apiLinks.value,
    ok: h.apiLinks.ok,
    error: h.apiLinks.error,
  })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { product: { update: h.productUpdate }, apiLog: { create: vi.fn(async () => ({})) } },
}));

const mode = h.mode;
const apiLinks = h.apiLinks;
const productUpdate = h.productUpdate;

import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { AffiliateConfigError } from "@/lib/errors";

const PLAIN = "https://www.aliexpress.com/item/1005006789012345.html";
const AFF = "https://s.click.aliexpress.com/e/_oABCDEF";

describe("AffiliateService — TEST vs PRODUCTION", () => {
  beforeEach(() => {
    mode.value = "TEST";
    delete process.env.ALIEXPRESS_AFFILIATE_ID;
    delete process.env.ALIEXPRESS_AFFILIATE_KEY;
    delete process.env.ALIEXPRESS_AFFILIATE_SECRET;
    process.env.ALIEXPRESS_AFFILIATE_STRATEGY = "api";
    apiLinks.value = new Map([[PLAIN, AFF]]);
    apiLinks.ok = true;
    apiLinks.error = undefined;
    productUpdate.mockClear();
  });

  const product = (over = {}) => ({ id: "p1", aeUrl: PLAIN + "?spm=x", affiliateUrl: null, affiliateUrlAt: null, ...over });

  it("TEST: plain URL in -> plain URL out, no credentials needed", async () => {
    const r = await AffiliateService.resolveForProduct(product());
    expect(r).toEqual({ url: PLAIN, linkMode: "test" });
  });

  it("PRODUCTION + api strategy: generates & returns the affiliate link, and caches it", async () => {
    mode.value = "PRODUCTION";
    process.env.ALIEXPRESS_AFFILIATE_ID = "trendfinder";
    process.env.ALIEXPRESS_AFFILIATE_KEY = "545984";
    process.env.ALIEXPRESS_AFFILIATE_SECRET = "secret";
    const r = await AffiliateService.resolveForProduct(product());
    expect(r).toEqual({ url: AFF, linkMode: "production" });
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ affiliateUrl: AFF }) }),
    );
  });

  it("PRODUCTION + api strategy: uses the cached link without calling the API", async () => {
    mode.value = "PRODUCTION";
    process.env.ALIEXPRESS_AFFILIATE_ID = "trendfinder";
    process.env.ALIEXPRESS_AFFILIATE_KEY = "545984";
    process.env.ALIEXPRESS_AFFILIATE_SECRET = "secret";
    const r = await AffiliateService.resolveForProduct(
      product({ affiliateUrl: AFF, affiliateUrlAt: new Date() }),
    );
    expect(r).toEqual({ url: AFF, linkMode: "production" });
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("PRODUCTION + api strategy + API fails: falls back to the plain URL (never a dead link)", async () => {
    mode.value = "PRODUCTION";
    process.env.ALIEXPRESS_AFFILIATE_ID = "trendfinder";
    process.env.ALIEXPRESS_AFFILIATE_KEY = "545984";
    process.env.ALIEXPRESS_AFFILIATE_SECRET = "secret";
    apiLinks.value = new Map();
    apiLinks.ok = false;
    apiLinks.error = "resp_code 4001: invalid signature";
    const r = await AffiliateService.resolveForProduct(product());
    expect(r.url).toBe(PLAIN);
    expect(r.linkMode).toBe("test");
  });

  it("PRODUCTION + missing credentials: public path falls back to plain URL (no throw)", async () => {
    mode.value = "PRODUCTION";
    const r = await AffiliateService.resolveForProduct(product());
    expect(r.url).toBe(PLAIN);
  });

  it("PRODUCTION + missing credentials: assertProductionReady throws (blocks the mode switch)", async () => {
    await expect(AffiliateService.assertProductionReady()).rejects.toBeInstanceOf(AffiliateConfigError);
  });

  it("s.click strategy: plain URL -> s.click wrapper", async () => {
    mode.value = "PRODUCTION";
    process.env.ALIEXPRESS_AFFILIATE_STRATEGY = "s.click";
    process.env.ALIEXPRESS_AFFILIATE_ID = "trendfinder";
    const r = await AffiliateService.resolveForProduct(product());
    expect(r.linkMode).toBe("production");
    expect(r.url).toContain("s.click.aliexpress.com");
    expect(r.url).toContain(encodeURIComponent(PLAIN));
  });

  it("normalizeAeUrl strips tracking params and canonicalises the item path", () => {
    expect(
      AffiliateService.normalizeAeUrl("https://he.aliexpress.com/item/1005006789012345.html?spm=abc&aff_platform=x"),
    ).toBe(PLAIN);
  });
});
