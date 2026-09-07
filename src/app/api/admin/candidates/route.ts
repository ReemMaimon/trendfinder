import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Cross-run candidate inspector. Filter by ?status=ACCEPTED|REJECTED_* or
 * ?rejected=1 for everything that did not make it, plus ?runId / ?date.
 */
export const GET = adminRoute(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const take = Math.min(Number(sp.get("limit") ?? 100), 500);
  const status = sp.get("status");
  const rejected = sp.get("rejected") === "1";
  const runId = sp.get("runId");
  const date = sp.get("date");

  const candidates = await prisma.generationCandidate.findMany({
    where: {
      ...(runId ? { runId } : {}),
      ...(date ? { run: { targetDate: date } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(rejected && !status ? { NOT: { status: "ACCEPTED" } } : {}),
    },
    orderBy: [{ run: { startedAt: "desc" } }, { order: "asc" }],
    take,
    include: { run: { select: { id: true, targetDate: true, startedAt: true, status: true } } },
  });
  return json({ candidates });
});
