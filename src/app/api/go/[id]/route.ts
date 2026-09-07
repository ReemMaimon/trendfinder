import { NextRequest, NextResponse } from "next/server";
import { publicRoute } from "@/lib/apiHelpers";
import { PublicService } from "@/services/public/PublicService";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { visitorHash } from "@/lib/visitor";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { AffiliateConfigError } from "@/lib/errors";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Outbound "Buy on AliExpress" redirect. Keeps affiliate-link construction
 * entirely server-side and records the click for analytics.
 *
 *   TEST mode       -> 302 to the plain AliExpress product URL
 *   PRODUCTION mode  -> 302 to the affiliate deep link
 *   PRODUCTION mode + missing affiliate config -> 302 to the plain URL + logged
 *     error (we never emit a fabricated affiliate link; the admin dashboard
 *     surfaces the misconfiguration).
 */
export const GET = publicRoute(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const ip = clientIp(req.headers);
  rateLimit(`go:${ip}`, { limit: 60, windowMs: 60_000 });

  const { id } = ctx.params;
  let target: { url: string; linkMode: "test" | "production" } | null = null;
  try {
    target = await PublicService.purchaseUrl(id);
  } catch (err) {
    if (err instanceof AffiliateConfigError) {
      logger.error({ missing: err.missing, productId: id }, "buy redirect: affiliate misconfigured, falling back to plain URL");
      const { prisma } = await import("@/lib/db");
      const p = await prisma.product.findUnique({ where: { id }, select: { aeUrl: true } });
      if (p) target = { url: p.aeUrl, linkMode: "test" };
    } else {
      throw err;
    }
  }

  if (!target) {
    return NextResponse.redirect(new URL("/", env.SITE_URL), 302);
  }

  const vh = visitorHash(ip, req.headers.get("user-agent") ?? "");
  await AnalyticsService.recordClick(id, target.linkMode, vh).catch((err) =>
    logger.warn({ err }, "failed to record click"),
  );

  return NextResponse.redirect(target.url, 302);
});
