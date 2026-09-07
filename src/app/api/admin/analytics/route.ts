import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { jerusalemDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req: NextRequest) => {
  const date = req.nextUrl.searchParams.get("date") ?? jerusalemDateString();
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 14), 90);
  const [today, history] = await Promise.all([
    AnalyticsService.dayReport(date),
    AnalyticsService.historyReport(days),
  ]);
  return json({ today, history });
});
