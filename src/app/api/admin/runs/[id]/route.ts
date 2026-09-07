import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Full detail of one generation run: candidates, sources, api logs. */
export const GET = adminRoute(async (_req: Request, ctx: { params: { id: string } }) => {
  const run = await prisma.generationRun.findUnique({
    where: { id: ctx.params.id },
    include: {
      candidates: { orderBy: { order: "asc" } },
      products: {
        include: { trendReport: true, sources: true },
      },
      sources: { orderBy: { foundAt: "asc" } },
      apiLogs: { orderBy: { createdAt: "asc" } },
      dailySets: true,
    },
  });
  if (!run) throw new NotFoundError("Generation run");
  return json({ run });
});
