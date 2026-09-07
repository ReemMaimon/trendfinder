import { DailyGenerationService } from "@/services/generation/DailyGenerationService";
import { logger } from "@/lib/logger";
import { jerusalemDateString } from "@/lib/time";
import type { RunTrigger } from "@prisma/client";

/**
 * Shared entrypoint used by the node-cron worker, the HTTP cron endpoint and the
 * admin "generate now" button. All idempotency lives in DailyGenerationService.
 */
export async function runDailyGeneration(opts: {
  trigger: RunTrigger;
  targetDate?: string;
  force?: boolean;
}) {
  const targetDate = opts.targetDate ?? jerusalemDateString();
  logger.info({ targetDate, trigger: opts.trigger }, "daily generation invoked");
  const result = await DailyGenerationService.generate({
    targetDate,
    trigger: opts.trigger,
    force: opts.force,
  });
  logger.info({ result }, "daily generation finished");
  return result;
}
