import { NextRequest } from "next/server";
import { adminRoute } from "@/lib/apiHelpers";
import { AnalyticsService, type RangePreset } from "@/services/analytics/AnalyticsService";

export const dynamic = "force-dynamic";

const PRESETS: RangePreset[] = ["today", "yesterday", "7d", "30d", "90d", "all", "custom"];

export const GET = adminRoute(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const presetRaw = sp.get("range") ?? "7d";
  const preset = (PRESETS.includes(presetRaw as RangePreset) ? presetRaw : "7d") as RangePreset;
  const range = AnalyticsService.resolveRange(preset, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const csv = await AnalyticsService.exportCsv(range);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trendfinder-stats-${range.fromDate}_${range.toDate}.csv"`,
    },
  });
});
