import { NextRequest } from "next/server";
import { z } from "zod";
import { publicRoute, json } from "@/lib/apiHelpers";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { visitorHash, getOrCreateSessionId, deriveSource, deriveDevice } from "@/lib/visitor";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().min(1),
  type: z.enum(["view-card", "view-detail"]),
  referrer: z.string().max(600).optional(),
  utmSource: z.string().max(60).optional(),
});

/** Anonymous view tracking (clicks are tracked by /api/go/[id]). */
export const POST = publicRoute(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  rateLimit(`track:${ip}`, { limit: 120, windowMs: 60_000 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "bad body" } }, { status: 400 });
  }
  const ua = req.headers.get("user-agent") ?? "";
  const referrer = parsed.data.referrer || req.headers.get("referer") || null;
  await AnalyticsService.recordView(
    parsed.data.productId,
    parsed.data.type === "view-card" ? "CARD" : "DETAIL",
    {
      visitorHash: visitorHash(ip, ua),
      sessionId: getOrCreateSessionId(),
      referrer,
      source: deriveSource(referrer, parsed.data.utmSource),
      deviceType: deriveDevice(ua),
    },
  );
  return json({ ok: true });
});
