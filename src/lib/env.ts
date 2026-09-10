import { z } from "zod";

/**
 * Central, validated environment access. Import `env` anywhere on the server.
 * NEVER import this from a client component — it would leak secrets into the
 * bundle. All values here are server-only.
 */

const rawSchema = z.object({
  APP_MODE: z.enum(["TEST", "PRODUCTION"]).default("TEST"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  TIMEZONE: z.string().default("Asia/Jerusalem"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1"),
  OPENAI_MODEL_LIGHT: z.string().default("gpt-4.1-mini"),
  AI_PROVIDER: z.enum(["openai", "mock"]).default("openai"),

  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD_HASH: z.string().min(1, "ADMIN_PASSWORD_HASH is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be >= 16 chars"),

  CRON_SECRET: z.string().min(8).default("dev-cron-secret"),
  ENABLE_INPROCESS_CRON: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  CURRENCY_BASE: z.string().default("USD"),
  CURRENCY_DISPLAY: z.string().default("ILS"),
  // erapi = open.er-api.com (free, no key, supports ILS, daily market rate)
  // frankfurter = ECB rates (NO ILS support — will fall back to fixed)
  // fixed = always use CURRENCY_FIXED_USD_ILS
  CURRENCY_PROVIDER: z.enum(["erapi", "frankfurter", "fixed"]).default("erapi"),
  CURRENCY_FIXED_USD_ILS: z.coerce.number().positive().default(3.7),

  ALIEXPRESS_AFFILIATE_ID: z.string().optional(),
  ALIEXPRESS_AFFILIATE_KEY: z.string().optional(),
  ALIEXPRESS_AFFILIATE_SECRET: z.string().optional(),
  // api     = official aliexpress.affiliate.link.generate call (needs id+key+secret) [recommended]
  // s.click = unsigned tracking wrapper (needs only id; weak attribution)
  // portals = locally-signed param wrap (legacy)
  ALIEXPRESS_AFFILIATE_STRATEGY: z
    .enum(["api", "portals", "s.click"])
    .default("api"),
  ALIEXPRESS_API_ENDPOINT: z
    .string()
    .default("https://api-sg.aliexpress.com/sync"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

const parsed = rawSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.`,
  );
}

export const env = parsed.data;

/**
 * The effective application mode. APP_MODE from env is the source of truth, but
 * an admin can flip it at runtime via Settings without a redeploy. That runtime
 * override is resolved in SettingsService.getAppMode(); this constant is the
 * env-level default / fallback.
 */
export const ENV_APP_MODE = env.APP_MODE;

export function isProductionMode(mode: "TEST" | "PRODUCTION"): boolean {
  return mode === "PRODUCTION";
}

/** True when the process has enough config to call OpenAI for real. */
export const canUseOpenAI =
  env.AI_PROVIDER === "openai" ? Boolean(env.OPENAI_API_KEY) : true;

/** Affiliate credentials are read live from process.env (never required in
 *  TEST mode, and may be added by an operator without touching this file). */
export function affiliateCreds() {
  return {
    id: process.env.ALIEXPRESS_AFFILIATE_ID || "",
    key: process.env.ALIEXPRESS_AFFILIATE_KEY || "",
    secret: process.env.ALIEXPRESS_AFFILIATE_SECRET || "",
    strategy: (process.env.ALIEXPRESS_AFFILIATE_STRATEGY || "api") as
      | "api"
      | "portals"
      | "s.click",
    endpoint: process.env.ALIEXPRESS_API_ENDPOINT || "https://api-sg.aliexpress.com/sync",
  };
}

/**
 * Validate affiliate configuration. Returns a list of missing keys; empty means
 * production affiliate links can be generated safely.
 */
export function affiliateConfigProblems(): string[] {
  const c = affiliateCreds();
  const missing: string[] = [];
  if (!c.id) missing.push("ALIEXPRESS_AFFILIATE_ID");
  if (c.strategy === "api" || c.strategy === "portals") {
    if (!c.key) missing.push("ALIEXPRESS_AFFILIATE_KEY");
    if (!c.secret) missing.push("ALIEXPRESS_AFFILIATE_SECRET");
  }
  return missing;
}
