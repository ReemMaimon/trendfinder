import { NextRequest, NextResponse } from "next/server";
import { publicRoute } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { visitorHash } from "@/lib/visitor";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Outbound "Buy on AliExpress" redirect. All affiliate-link construction is
 * server-side and the click is recorded for analytics.
 *
 *   TEST mode        -> 302 to the plain AliExpress product URL
 *   PRODUCTION mode  -> 302 to the cached/generated affiliate link
 *   PRODUCTION + misconfigured or API failure -> 302 to the plain URL + logged
 *     (the visitor is never sent to a dead link; the admin dashboard surfaces
 *     the misconfiguration).
 */
export const GET = publicRoute(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const ip = clientIp(req.headers);
  rateLimit(`go:${ip}`, { limit: 60, windowMs: 60_000 });

  const { id } = ctx.params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, aeUrl: true, affiliateUrl: true, affiliateUrlAt: true },
  });
  if (!product) {
    return NextResponse.redirect(new URL("/", env.SITE_URL), 302);
  }

  let target: { url: string; linkMode: "test" | "production" };
  try {
    target = await AffiliateService.resolveForProduct(product);
  } catch (err) {
    logger.error({ err, productId: id }, "buy redirect failed — using plain URL");
    target = { url: AffiliateService.normalizeAeUrl(product.aeUrl), linkMode: "test" };
  }

  const vh = visitorHash(ip, req.headers.get("user-agent") ?? "");
  await AnalyticsService.recordClick(id, target.linkMode, vh).catch((e) =>
    logger.warn({ err: e }, "failed to record click"),
  );

  return NextResponse.redirect(target.url, 302);
});
