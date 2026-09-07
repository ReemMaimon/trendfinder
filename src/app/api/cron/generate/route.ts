import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { publicRoute, json } from "@/lib/apiHelpers";
import { runDailyGeneration } from "@/jobs/runGeneration";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * HTTP trigger for the daily generation. Use this from Hostinger's cron-job
 * panel (or system crontab) as the primary or backup scheduler:
 *
 *   0 0 * * *  curl -fsS -X POST https://SITE/api/cron/generate \
 *                -H "x-cron-secret: $CRON_SECRET"
 *
 * Idempotent — safe to call multiple times per day.
 */
export const POST = publicRoute(async (req: NextRequest) => {
  const provided =
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  if (provided !== env.CRON_SECRET) {
    logger.warn({ ip: clientIp(req.headers) }, "cron endpoint: bad secret");
    return json({ error: { code: "UNAUTHORIZED", message: "bad cron secret" } }, { status: 401 });
  }
  rateLimit(`cron:${clientIp(req.headers)}`, { limit: 6, windowMs: 60_000 });

  const body = await req.json().catch(() => ({}));
  const result = await runDailyGeneration({
    trigger: "HTTP_CRON",
    targetDate: typeof body.targetDate === "string" ? body.targetDate : undefined,
    force: body.force === true,
  });
  return json({ ok: true, result });
});

export const GET = POST;
