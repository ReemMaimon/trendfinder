import { describe, it, expect, vi, beforeEach } from "vitest";

// Control the effective app mode without a DB.
const mode = { value: "TEST" as "TEST" | "PRODUCTION" };
vi.mock("@/services/settings/SettingsService", () => ({
  SettingsService: {
    getAppMode: async () => mode.value,
    get: async () => ({}),
  },
}));

import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { AffiliateConfigError } from "@/lib/errors";

const PLAIN = "https://www.aliexpress.com/item/1005006789012345.html";

describe("AffiliateService — TEST vs PRODUCTION link switching", () => {
  beforeEach(() => {
    mode.value = "TEST";
    delete process.env.ALIEXPRESS_AFFILIATE_ID;
    delete process.env.ALIEXPRESS_AFFILIATE_KEY;
    delete process.env.ALIEXPRESS_AFFILIATE_SECRET;
  });

  it("TEST MODE: normal AliExpress URL in -> normal AliExpress URL out", async () => {
    const res = await AffiliateService.getPurchaseUrl(
      "https://www.aliexpress.com/item/1005006789012345.html?spm=a2g0o.tracking&aff_fcid=xxx",
    );
    expect(res.url).toBe(PLAIN);
    expect(res.linkMode).toBe("test");
  });

  it("TEST MODE works with no affiliate credentials", async () => {
    await expect(AffiliateService.getPurchaseUrl(PLAIN)).resolves.toBeTruthy();
  });

  it("PRODUCTION MODE without credentials fails safely (throws, never a fake link)", async () => {
    mode.value = "PRODUCTION";
    await expect(AffiliateService.getPurchaseUrl(PLAIN)).rejects.toBeInstanceOf(AffiliateConfigError);
  });

  it("PRODUCTION MODE with s.click credentials: normal URL in -> affiliate deep link out", async () => {
    mode.value = "PRODUCTION";
    process.env.ALIEXPRESS_AFFILIATE_ID = "portals123";
    process.env.ALIEXPRESS_AFFILIATE_STRATEGY = "s.click";
    const res = await AffiliateService.getPurchaseUrl(PLAIN);
    expect(res.linkMode).toBe("production");
    expect(res.url).toContain("s.click.aliexpress.com");
    expect(res.url).toContain(encodeURIComponent(PLAIN));
  });

  it("normalizeAeUrl strips tracking params and canonicalises the item path", () => {
    expect(
      AffiliateService.normalizeAeUrl(
        "https://he.aliexpress.com/item/1005006789012345.html?spm=abc&aff_platform=x",
      ),
    ).toBe(PLAIN);
  });
});
