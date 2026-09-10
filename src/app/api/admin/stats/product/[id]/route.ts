import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { NotFoundError } from "@/lib/errors";
import { AnalyticsService, type RangePreset } from "@/services/analytics/AnalyticsService";

export const dynamic = "force-dynamic";

const PRESETS: RangePreset[] = ["today", "yesterday", "7d", "30d", "90d", "all", "custom"];

export const GET = adminRoute(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const sp = req.nextUrl.searchParams;
  const presetRaw = sp.get("range") ?? "30d";
  const preset = (PRESETS.includes(presetRaw as RangePreset) ? presetRaw : "30d") as RangePreset;
  const range = AnalyticsService.resolveRange(preset, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const stats = await AnalyticsService.productStats(ctx.params.id, range);
  if (!stats) throw new NotFoundError("Product");
  return json({ range: { preset: range.preset, label: range.label }, ...stats });
});
