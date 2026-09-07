import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { AffiliateService } from "@/services/affiliate/AffiliateService";
import { SettingsService } from "@/services/settings/SettingsService";
import { AffiliateConfigError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (_req: Request, ctx: { params: { date: string } }) => {
  const set = await prisma.dailyProductSet.findUnique({
    where: { date: ctx.params.date },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { product: { include: { trendReport: true, sources: true } } },
      },
      generationRun: { include: { candidates: { orderBy: { order: "asc" } } } },
    },
  });
  if (!set) throw new NotFoundError("Daily set");
  return json({ set });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("reorder"), positions: z.array(z.object({ productId: z.string(), position: z.number().int().min(1).max(3) })).length(3) }),
  z.object({ action: z.literal("replace"), position: z.number().int().min(1).max(3), newProductId: z.string() }),
  z.object({ action: z.literal("remove"), position: z.number().int().min(1).max(3) }),
  z.object({ action: z.literal("add"), productId: z.string(), position: z.number().int().min(1).max(3) }),
]);

/**
 * Admin edits to a daily set. Historical sets remain editable; publishing in
 * PRODUCTION mode requires valid affiliate config.
 */
export const POST = adminRoute(async (req: NextRequest, ctx: { params: { date: string } }) => {
  const date = ctx.params.date;
  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ValidationError("Invalid action", parsed.error.issues);
  const body = parsed.data;

  const set = await prisma.dailyProductSet.findUnique({
    where: { date },
    include: { items: true },
  });
  if (!set) throw new NotFoundError("Daily set");

  switch (body.action) {
    case "publish": {
      const mode = await SettingsService.getAppMode();
      if (mode === "PRODUCTION") {
        try {
          await AffiliateService.assertProductionReady();
        } catch (err) {
          if (err instanceof AffiliateConfigError) {
            return json(
              { error: { code: "AFFILIATE_CONFIG_INCOMPLETE", message: "תצורת אפיליאייט חסרה — הפרסום נחסם.", missing: err.missing } },
              { status: 409 },
            );
          }
          throw err;
        }
      }
      await prisma.dailyProductSet.update({
        where: { date },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      break;
    }
    case "unpublish":
      await prisma.dailyProductSet.update({ where: { date }, data: { status: "DRAFT" } });
      break;

    case "reorder":
      await prisma.$transaction(
        body.positions.map((p) =>
          prisma.dailyProductItem.updateMany({
            where: { setId: set.id, productId: p.productId },
            data: { position: p.position },
          }),
        ),
      );
      break;

    case "remove":
      await prisma.dailyProductItem.deleteMany({ where: { setId: set.id, position: body.position } });
      break;

    case "replace": {
      const target = await prisma.product.findUnique({ where: { id: body.newProductId } });
      if (!target) throw new NotFoundError("Replacement product");
      await prisma.$transaction([
        prisma.dailyProductItem.deleteMany({ where: { setId: set.id, position: body.position } }),
        prisma.dailyProductItem.deleteMany({ where: { setId: set.id, productId: body.newProductId } }),
        prisma.dailyProductItem.create({
          data: { setId: set.id, productId: body.newProductId, position: body.position, reused: true },
        }),
      ]);
      break;
    }

    case "add": {
      const target = await prisma.product.findUnique({ where: { id: body.productId } });
      if (!target) throw new NotFoundError("Product");
      await prisma.$transaction([
        prisma.dailyProductItem.deleteMany({ where: { setId: set.id, position: body.position } }),
        prisma.dailyProductItem.deleteMany({ where: { setId: set.id, productId: body.productId } }),
        prisma.dailyProductItem.create({
          data: { setId: set.id, productId: body.productId, position: body.position },
        }),
      ]);
      break;
    }
  }

  const updated = await prisma.dailyProductSet.findUnique({
    where: { date },
    include: { items: { orderBy: { position: "asc" }, include: { product: true } } },
  });
  return json({ set: updated });
});
