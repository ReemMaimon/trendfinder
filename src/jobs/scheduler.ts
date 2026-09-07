/**
 * Standalone worker process (run via `npm run worker`, managed by PM2).
 *
 * Uses the `cron` package with an explicit IANA timezone so DST is handled by
 * the tz database rather than by the server's local clock. Runs once per day at
 * 00:00 Asia/Jerusalem. Generation itself is idempotent, so a duplicate fire
 * (clock adjustments, restarts) will not create a second daily set.
 */
import "dotenv/config";
import { CronJob } from "cron";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runDailyGeneration } from "./runGeneration";
import { msUntilNextMidnight } from "@/lib/time";

async function tick(reason: string) {
  try {
    logger.info({ reason }, "scheduler tick");
    await runDailyGeneration({ trigger: "SCHEDULER" });
  } catch (err) {
    logger.error({ err }, "scheduled generation failed");
  }
}

function main() {
  if (!env.ENABLE_INPROCESS_CRON) {
    logger.warn(
      "ENABLE_INPROCESS_CRON=false — worker will idle. Drive generation via POST /api/cron/generate + system crontab.",
    );
  } else {
    const job = new CronJob(
      "0 0 0 * * *", // sec min hour * * *
      () => void tick("cron 00:00"),
      null,
      true,
      env.TIMEZONE,
    );
    logger.info(
      {
        tz: env.TIMEZONE,
        nextRun: job.nextDate().toISO(),
        msUntilLocalMidnight: msUntilNextMidnight(),
      },
      "daily scheduler started",
    );
  }

  // Safety net: on boot, ensure today's set exists (e.g. server was down at 00:00).
  void tick("startup catch-up");

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}

main();
