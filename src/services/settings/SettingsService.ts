import { prisma } from "@/lib/db";
import { env, ENV_APP_MODE } from "@/lib/env";
import { logger } from "@/lib/logger";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@/config/defaults";

let cache: { value: Settings; at: number } | null = null;
const TTL_MS = 15_000;

/** Deep-merge stored partial over defaults, then validate. */
function coerce(stored: unknown): Settings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(typeof stored === "object" && stored ? (stored as Record<string, unknown>) : {}),
    scoringWeights: {
      ...DEFAULT_SETTINGS.scoringWeights,
      ...((stored as any)?.scoringWeights ?? {}),
    },
    diversityRules: {
      ...DEFAULT_SETTINGS.diversityRules,
      ...((stored as any)?.diversityRules ?? {}),
    },
  };
  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, "settings invalid, using defaults");
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

export const SettingsService = {
  async get(force = false): Promise<Settings> {
    if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
    const row = await prisma.setting.findUnique({ where: { id: "singleton" } });
    if (!row) {
      await prisma.setting.create({
        data: { id: "singleton", data: DEFAULT_SETTINGS as any },
      });
      cache = { value: DEFAULT_SETTINGS, at: Date.now() };
      return DEFAULT_SETTINGS;
    }
    const value = coerce(row.data);
    cache = { value, at: Date.now() };
    return value;
  },

  async update(patch: Partial<Settings>, updatedBy?: string): Promise<Settings> {
    const current = await this.get(true);
    const next = coerce({ ...current, ...patch });
    await prisma.setting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", data: next as any, updatedBy },
      update: { data: next as any, updatedBy },
    });
    cache = { value: next, at: Date.now() };
    logger.info({ updatedBy, keys: Object.keys(patch) }, "settings updated");
    return next;
  },

  /**
   * Effective APP_MODE. Admin override (settings.appModeOverride) wins over the
   * env default so mode can be switched without a redeploy.
   */
  async getAppMode(): Promise<"TEST" | "PRODUCTION"> {
    const s = await this.get();
    return s.appModeOverride ?? ENV_APP_MODE;
  },

  invalidate() {
    cache = null;
  },
};
