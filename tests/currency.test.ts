import { describe, it, expect } from "vitest";
import { CurrencyService } from "@/services/currency/CurrencyService";

describe("CurrencyService (fixed provider)", () => {
  it("converts USD to ILS using the fixed fallback rate", async () => {
    const r = await CurrencyService.toDisplay({
      priceOriginal: 10,
      currencyOriginal: "USD",
    });
    expect(r.priceIls).toBeCloseTo(37, 1);
    expect(r.fxRateUsed).toBeGreaterThan(0);
  });

  it("returns null price when the input price is null (never fabricates)", async () => {
    const r = await CurrencyService.toDisplay({ priceOriginal: null, currencyOriginal: "USD" });
    expect(r.priceIls).toBeNull();
    expect(r.priceIlsTotal).toBeNull();
  });

  it("only computes a with-shipping total when shipping is verified", async () => {
    const unverified = await CurrencyService.toDisplay({
      priceOriginal: 10,
      currencyOriginal: "USD",
      priceShipping: 3,
      shippingVerified: false,
    });
    expect(unverified.priceIlsTotal).toBeNull();

    const verified = await CurrencyService.toDisplay({
      priceOriginal: 10,
      currencyOriginal: "USD",
      priceShipping: 3,
      shippingVerified: true,
    });
    expect(verified.priceIlsTotal).toBeCloseTo(48.1, 1);
  });

  it("formats ILS and falls back to 'לא זמין'", () => {
    expect(CurrencyService.formatIls(49.9)).toBe("₪49.90");
    expect(CurrencyService.formatIls(null)).toBe("לא זמין");
  });
});
