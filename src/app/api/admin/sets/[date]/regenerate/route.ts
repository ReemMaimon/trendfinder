import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { DailyGenerationService } from "@/services/generation/DailyGenerationService";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ position: z.number().int().min(1).max(10) });

/**
 * Replace ONE product in a daily set with a freshly AI-discovered product.
 * Blocks until done (~1-2 min). The other products stay and are used as the
 * diversity baseline.
 */
export const POST = adminRoute(async (req: NextRequest, ctx: { params: { date: string } }) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "position must be between 1 and 10" } }, { status: 400 });
  }
  const result = await DailyGenerationService.regenerateSlot({
    targetDate: ctx.params.date,
    position: parsed.data.position,
    trigger: "MANUAL",
  });
  return json(result, { status: result.ok ? 200 : 409 });
});
