import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Historical daily sets (never deleted). Newest first. */
export const GET = adminRoute(async (req: NextRequest) => {
  const take = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 60), 365);
  const sets = await prisma.dailyProductSet.findMany({
    orderBy: { date: "desc" },
    take,
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: {
              id: true,
              aeTitle: true,
              trendTitle: true,
              category: true,
              overallScore: true,
              priceIls: true,
              aeImages: true,
            },
          },
        },
      },
      generationRun: { select: { id: true, status: true, trigger: true } },
    },
  });
  return json({ sets });
});
