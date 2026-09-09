import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

/**
 * Converts AliExpress listing prices to the display currency (ILS by default).
 *
 * Live rate providers (CURRENCY_PROVIDER):
 *   erapi       - open.er-api.com  (free, no key, supports ILS, daily market rate)  [default]
 *   frankfurter - ECB reference rates (NO ILS support -> falls back to fixed)
 *   fixed       - always CURRENCY_FIXED_USD_ILS
 *
 * A configured fixed rate is always the last-resort fallback if the network
 * call fails. Never fabricates a price — a null input price yields a null output.
 */

interface Rate {
  from: string;
  to: string;
  rate: number;
  asOf: Date;
}

const rateCache = new Map<string, { value: Rate; at: number }>();
const TTL_MS = 3 * 60 * 60 * 1000; // 3h — providers refresh ~daily anyway

async function fetchFromErApi(from: string, to: string): Promise<Rate> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`er-api ${res.status}`);
  const json = (await res.json()) as {
    result: string;
    rates: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (json.result !== "success") throw new Error(`er-api result=${json.result}`);
  const rate = json.rates?.[to];
  if (!rate || !isFinite(rate)) throw new Error(`er-api: no rate for ${to}`);
  return { from, to, rate, asOf: json.time_last_update_utc ? new Date(json.time_last_update_utc) : new Date() };
}

async function fetchFromFrankfurter(from: string, to: string): Promise<Rate> {
  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const json = (await res.json()) as { rates: Record<string, number>; date: string };
  const rate = json.rates?.[to];
  if (!rate) throw new Error("frankfurter: rate missing (ILS is not supported by ECB)");
  return { from, to, rate, asOf: new Date(json.date) };
}

function fixedRate(from: string, to: string): Rate {
  // CURRENCY_FIXED_USD_ILS is "1 USD = X ILS"; derive the inverse.
  const usdIls = env.CURRENCY_FIXED_USD_ILS;
  let rate = 1;
  if (from === "USD" && to === "ILS") rate = usdIls;
  else if (from === "ILS" && to === "USD") rate = 1 / usdIls;
  return { from, to, rate, asOf: new Date() };
}

async function fetchRate(from: string, to: string): Promise<Rate> {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return { from, to, rate: 1, asOf: new Date() };

  const key = `${from}->${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const started = Date.now();
  if (env.CURRENCY_PROVIDER !== "fixed") {
    try {
      const value =
        env.CURRENCY_PROVIDER === "erapi"
          ? await fetchFromErApi(from, to)
          : await fetchFromFrankfurter(from, to);
      rateCache.set(key, { value, at: Date.now() });
      await prisma.apiLog
        .create({
          data: {
            provider: "currency",
            operation: `rate ${key}`,
            ok: true,
            durationMs: Date.now() - started,
            meta: { rate: value.rate, asOf: value.asOf.toISOString(), source: env.CURRENCY_PROVIDER },
          },
        })
        .catch(() => {});
      return value;
    } catch (err) {
      logger.warn({ err, from, to }, "live currency provider failed, using fixed fallback");
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

  const value = fixedRate(from, to);
  // cache the fallback briefly so we don't hammer a failing provider
  rateCache.set(key, { value, at: Date.now() - TTL_MS + 5 * 60 * 1000 });
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
