import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const take = Math.min(Number(sp.get("limit") ?? 200), 1000);
  const sources = await prisma.trendSource.findMany({
    where: {
      ...(sp.get("productId") ? { productId: sp.get("productId")! } : {}),
      ...(sp.get("runId") ? { runId: sp.get("runId")! } : {}),
      ...(sp.get("type") ? { sourceType: sp.get("type")! } : {}),
    },
    orderBy: { foundAt: "desc" },
    take,
    include: {
      product: { select: { id: true, aeTitle: true, slug: true } },
      run: { select: { id: true, targetDate: true } },
    },
  });
  return json({ sources });
});
