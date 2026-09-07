import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { runDailyGeneration } from "@/jobs/runGeneration";
import { jerusalemDateString } from "@/lib/time";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().optional(),
  wait: z.boolean().optional(), // when true, block until finished (used by CLI/tests)
});

/**
 * Trigger the generation pipeline manually. By default returns immediately and
 * the admin UI polls GET /api/admin/runs?date=... for live progress
 * (candidates are written as they are evaluated).
 */
export const POST = adminRoute(async (req: NextRequest) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "bad body" } }, { status: 400 });
  }
  const targetDate = parsed.data.targetDate ?? jerusalemDateString();
  const force = parsed.data.force ?? false;

  // guard: is a run already RUNNING for this date?
  const running = await prisma.generationRun.findFirst({
    where: { targetDate, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    return json({ ok: true, alreadyRunning: true, runId: running.id, targetDate });
  }

  if (parsed.data.wait) {
    const result = await runDailyGeneration({ trigger: "MANUAL", targetDate, force });
    return json({ ok: true, result });
  }

  // fire-and-forget
  void runDailyGeneration({ trigger: "MANUAL", targetDate, force }).catch((err) =>
    logger.error({ err }, "manual generation failed"),
  );
  return json({ ok: true, started: true, targetDate });
});
