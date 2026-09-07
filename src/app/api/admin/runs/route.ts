import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** List generation runs, optionally filtered by target date. */
export const GET = adminRoute(async (req: NextRequest) => {
  const date = req.nextUrl.searchParams.get("date");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100);
  const withCandidates = req.nextUrl.searchParams.get("candidates") === "1";

  const runs = await prisma.generationRun.findMany({
    where: date ? { targetDate: date } : undefined,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: withCandidates
      ? { candidates: { orderBy: { order: "asc" } }, _count: { select: { candidates: true, products: true } } }
      : { _count: { select: { candidates: true, products: true } } },
  });

  return json({ runs });
});
