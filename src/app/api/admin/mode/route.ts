import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { SettingsService } from "@/services/settings/SettingsService";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { getSession } from "@/lib/session";
import { AffiliateConfigError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const schema = z.object({ mode: z.enum(["TEST", "PRODUCTION"]) });

/** Current mode + affiliate config status. */
export const GET = adminRoute(async () => {
  const status = await AffiliateService.status();
  return json({ ...status });
});

/**
 * Switch APP_MODE at runtime (admin only). Switching to PRODUCTION is refused
 * unless affiliate credentials are fully configured — we never publish
 * fabricated affiliate links.
 */
export const POST = adminRoute(async (req: NextRequest) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "mode must be TEST or PRODUCTION" } }, { status: 400 });
  }

  if (parsed.data.mode === "PRODUCTION") {
    try {
      await AffiliateService.assertProductionReady();
    } catch (err) {
      if (err instanceof AffiliateConfigError) {
        return json(
          {
            error: {
              code: "AFFILIATE_CONFIG_INCOMPLETE",
              message:
                "לא ניתן לעבור למצב PRODUCTION — חסרה תצורת אפיליאייט. הגדר את המשתנים החסרים ונסה שוב.",
              missing: err.missing,
            },
          },
          { status: 409 },
        );
      }
      throw err;
    }
  }

  const session = await getSession();
  await SettingsService.update({ appModeOverride: parsed.data.mode }, session?.username);
  const status = await AffiliateService.status();
  return json({ ok: true, ...status });
});
