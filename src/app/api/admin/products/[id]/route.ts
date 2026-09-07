import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { CurrencyService } from "@/services/currency/CurrencyService";
import { normalizeCategory, CATEGORIES } from "@/config/categories";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (_req: Request, ctx: { params: { id: string } }) => {
  const product = await prisma.product.findUnique({
    where: { id: ctx.params.id },
    include: {
      trendReport: true,
      sources: true,
      dailyItems: { include: { set: true } },
      generationRun: true,
      _count: { select: { views: true, clicks: true } },
    },
  });
  if (!product) throw new NotFoundError("Product");
  return json({ product });
});

const patchSchema = z.object({
  trendTitle: z.string().min(2).optional(),
  trendDescription: z.string().min(5).optional(),
  category: z.enum(CATEGORIES).optional(),
  aeTitle: z.string().min(2).optional(),
  aeDescription: z.string().nullable().optional(),
  aeUrl: z.string().url().optional(),
  aeImages: z.array(z.string().url()).optional(),
  aeRating: z.number().min(0).max(5).nullable().optional(),
  aeOrders: z.number().int().min(0).nullable().optional(),
  aeStoreName: z.string().nullable().optional(),
  priceOriginal: z.number().min(0).nullable().optional(),
  currencyOriginal: z.string().max(8).nullable().optional(),
  priceShipping: z.number().min(0).nullable().optional(),
  shippingVerified: z.boolean().optional(),
  explanationHe: z.string().min(5).optional(),
  viralPotentialScore: z.number().int().min(0).max(100).optional(),
  affiliatePotentialScore: z.number().int().min(0).max(100).optional(),
  noveltyScore: z.number().int().min(0).max(100).optional(),
  trendMomentumScore: z.number().int().min(0).max(100).optional(),
  saturationScore: z.number().int().min(0).max(100).optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  trendReport: z
    .object({
      tiktokLevel: z.enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]).optional(),
      instagramLevel: z.enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]).optional(),
      youtubeLevel: z.enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]).optional(),
      googleTrendsLevel: z.enum(["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]).optional(),
      overallReasoningHe: z.string().optional(),
    })
    .optional(),
});

export const PATCH = adminRoute(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const existing = await prisma.product.findUnique({ where: { id: ctx.params.id } });
  if (!existing) throw new NotFoundError("Product");

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ValidationError("Invalid patch", parsed.error.issues);
  const d = parsed.data;
  const { trendReport, ...rest } = d;

  const data: Record<string, unknown> = { ...rest };
  if (d.category) data.category = normalizeCategory(d.category);
  if (d.aeImages) data.aeImages = d.aeImages;

  // recompute ILS if a price-affecting field changed
  const priceChanged =
    d.priceOriginal !== undefined ||
    d.currencyOriginal !== undefined ||
    d.priceShipping !== undefined ||
    d.shippingVerified !== undefined;
  if (priceChanged) {
    const fx = await CurrencyService.toDisplay({
      priceOriginal: d.priceOriginal ?? existing.priceOriginal,
      currencyOriginal: d.currencyOriginal ?? existing.currencyOriginal,
      priceShipping: d.priceShipping ?? existing.priceShipping,
      shippingVerified: d.shippingVerified ?? existing.shippingVerified,
    });
    data.priceIls = fx.priceIls;
    data.priceIlsTotal = fx.priceIlsTotal;
    data.fxRateUsed = fx.fxRateUsed;
    data.fxAsOf = fx.fxAsOf;
  }

  const product = await prisma.product.update({
    where: { id: ctx.params.id },
    data: {
      ...data,
      ...(trendReport
        ? { trendReport: { upsert: { create: { overallReasoningHe: "", ...trendReport }, update: trendReport } } }
        : {}),
    },
    include: { trendReport: true },
  });

  return json({ product });
});

/** Remove a product. If it is in a daily set, the item is removed too (leaving
 *  the set with fewer than 3 — admin can replace via the set endpoint). */
export const DELETE = adminRoute(async (_req: Request, ctx: { params: { id: string } }) => {
  const existing = await prisma.product.findUnique({
    where: { id: ctx.params.id },
    include: { dailyItems: true },
  });
  if (!existing) throw new NotFoundError("Product");
  await prisma.$transaction([
    prisma.dailyProductItem.deleteMany({ where: { productId: ctx.params.id } }),
    prisma.product.delete({ where: { id: ctx.params.id } }),
  ]);
  return json({ ok: true, removedFromSets: existing.dailyItems.length });
});
