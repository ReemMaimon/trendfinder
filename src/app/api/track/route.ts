import { NextRequest } from "next/server";
import { z } from "zod";
import { publicRoute, json } from "@/lib/apiHelpers";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { visitorHash } from "@/lib/visitor";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().min(1),
  type: z.enum(["view-card", "view-detail"]),
});

/** Anonymous view tracking (clicks are tracked by /api/go/[id]). */
export const POST = publicRoute(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  rateLimit(`track:${ip}`, { limit: 120, windowMs: 60_000 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "bad body" } }, { status: 400 });
  }
  const vh = visitorHash(ip, req.headers.get("user-agent") ?? "");
  await AnalyticsService.recordView(
    parsed.data.productId,
    parsed.data.type === "view-card" ? "CARD" : "DETAIL",
    vh,
  );
  return json({ ok: true });
});
