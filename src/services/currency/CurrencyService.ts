import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

/**
 * Converts AliExpress listing prices to the display currency (ILS by default).
 * Uses the free Frankfurter API (ECB rates, no key). Falls back to a configured
 * fixed rate if the network call fails. Never fabricates a price — if the input
 * price is null, the output is null.
 */

interface Rate {
  from: string;
  to: string;
  rate: number;
  asOf: Date;
}

let rateCache: { key: string; value: Rate; at: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function fetchRate(from: string, to: string): Promise<Rate> {
  const key = `${from}->${to}`;
  if (rateCache && rateCache.key === key && Date.now() - rateCache.at < TTL_MS) {
    return rateCache.value;
  }

  if (from === to) {
    const r = { from, to, rate: 1, asOf: new Date() };
    rateCache = { key, value: r, at: Date.now() };
    return r;
  }

  if (env.CURRENCY_PROVIDER === "frankfurter") {
    const started = Date.now();
    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error(`frankfurter ${res.status}`);
      const json = (await res.json()) as { rates: Record<string, number>; date: string };
      const rate = json.rates?.[to];
      if (!rate) throw new Error("rate missing in response");
      const value: Rate = { from, to, rate, asOf: new Date(json.date) };
      rateCache = { key, value, at: Date.now() };
      await prisma.apiLog
        .create({
          data: {
            provider: "currency",
            operation: `rate ${key}`,
            ok: true,
            durationMs: Date.now() - started,
            meta: { rate, asOf: json.date },
          },
        })
        .catch(() => {});
      return value;
    } catch (err) {
      logger.warn({ err, from, to }, "currency provider failed, using fixed fallback");
      await prisma.apiLog
        .create({
          data: {
            provider: "currency",
            operation: `rate ${key}`,
            ok: false,
            durationMs: Date.now() - started,
            errorText: String(err),
          },
        })
        .catch(() => {});
    }
  }

  // Fixed fallback. CURRENCY_FIXED_USD_ILS is "1 USD = X ILS"; derive the other
  // directions from it (USD<->ILS both ways; anything else falls back to 1:1).
  const usdIls = env.CURRENCY_FIXED_USD_ILS;
  let rate = 1;
  if (from === "USD" && to === "ILS") rate = usdIls;
  else if (from === "ILS" && to === "USD") rate = 1 / usdIls;
  const value: Rate = { from, to, rate, asOf: new Date() };
  rateCache = { key, value, at: Date.now() };
  return value;
}

export interface ConversionResult {
  priceIls: number | null;
  priceIlsTotal: number | null;
  fxRateUsed: number | null;
  fxAsOf: Date | null;
}

export const CurrencyService = {
  async toDisplay(params: {
    priceOriginal: number | null | undefined;
    currencyOriginal: string | null | undefined;
    priceShipping?: number | null;
    shippingVerified?: boolean;
  }): Promise<ConversionResult> {
    const display = env.CURRENCY_DISPLAY;
    const { priceOriginal, priceShipping, shippingVerified } = params;
    if (priceOriginal == null || !isFinite(priceOriginal)) {
      return { priceIls: null, priceIlsTotal: null, fxRateUsed: null, fxAsOf: null };
    }
    const from = (params.currencyOriginal || env.CURRENCY_BASE).toUpperCase();
    const { rate, asOf } = await fetchRate(from, display);
    const round = (n: number) => Math.round(n * 100) / 100;
    const priceIls = round(priceOriginal * rate);
    let priceIlsTotal: number | null = null;
    if (shippingVerified && priceShipping != null && isFinite(priceShipping)) {
      priceIlsTotal = round((priceOriginal + priceShipping) * rate);
    }
    return { priceIls, priceIlsTotal, fxRateUsed: rate, fxAsOf: asOf };
  },

  /** Convert an arbitrary amount between currencies (e.g. an ILS budget to USD
   *  for the AliExpress search, which returns USD prices). */
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (amount == null || !isFinite(amount)) return amount;
    const { rate } = await fetchRate(from.toUpperCase(), to.toUpperCase());
    return Math.round(amount * rate * 100) / 100;
  },

  /** Format a number as an ILS string for the UI. */
  formatIls(amount: number | null | undefined): string {
    if (amount == null || !isFinite(amount)) return "לא זמין";
    return `₪${amount.toFixed(2)}`;
  },
};
