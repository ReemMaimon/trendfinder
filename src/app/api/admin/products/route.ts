import { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, json } from "@/lib/apiHelpers";
import { prisma } from "@/lib/db";
import { makeSlug } from "@/lib/slug";
import { normalizeCategory, CATEGORIES } from "@/config/categories";
import { CurrencyService } from "@/services/currency/CurrencyService";
import { AliExpressResearchService } from "@/services/aliexpress/AliExpressResearchService";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const take = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { aeTitle: { contains: q, mode: "insensitive" } },
            { trendTitle: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: { dailyItems: { include: { set: true } }, trendReport: true },
  });
  return json({ products });
});

const manualSchema = z.object({
  trendTitle: z.string().min(2),
  trendDescription: z.string().min(5),
  category: z.enum(CATEGORIES),
  aeTitle: z.string().min(2),
  aeDescription: z.string().optional().nullable(),
  aeUrl: z.string().url(),
  aeImages: z.array(z.string().url()).default([]),
  aeRating: z.number().min(0).max(5).nullable().optional(),
  aeOrders: z.number().int().min(0).nullable().optional(),
  aeStoreName: z.string().nullable().optional(),
  priceOriginal: z.number().min(0).nullable().optional(),
  currencyOriginal: z.string().max(8).nullable().optional(),
  priceShipping: z.number().min(0).nullable().optional(),
  shippingVerified: z.boolean().default(false),
  explanationHe: z.string().min(5),
  viralPotentialScore: z.number().int().min(0).max(100).default(60),
  affiliatePotentialScore: z.number().int().min(0).max(100).default(60),
  noveltyScore: z.number().int().min(0).max(100).default(60),
  trendMomentumScore: z.number().int().min(0).max(100).default(60),
  saturationScore: z.number().int().min(0).max(100).default(40),
  overallScore: z.number().int().min(0).max(100).default(60),
});

/** Manually add a product (admin). Price is converted; URL is normalised. */
export const POST = adminRoute(async (req: NextRequest) => {
  const parsed = manualSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new ValidationError("Invalid product", parsed.error.issues);
  const d = parsed.data;

  const { url, id } = AliExpressResearchService.canonicalUrl(d.aeUrl);
  const fx = await CurrencyService.toDisplay({
    priceOriginal: d.priceOriginal ?? null,
    currencyOriginal: d.currencyOriginal ?? null,
    priceShipping: d.priceShipping ?? null,
    shippingVerified: d.shippingVerified,
  });

  const product = await prisma.product.create({
    data: {
      trendTitle: d.trendTitle,
      trendDescription: d.trendDescription,
      category: normalizeCategory(d.category),
      slug: makeSlug(d.trendTitle, `manual-${Date.now()}`),
      aeTitle: d.aeTitle,
      aeDescription: d.aeDescription ?? null,
      aeUrl: url,
      aeProductId: id,
      aeStoreName: d.aeStoreName ?? null,
      aeImages: d.aeImages as any,
      aeRating: d.aeRating ?? null,
      aeOrders: d.aeOrders ?? null,
      priceOriginal: d.priceOriginal ?? null,
      currencyOriginal: d.currencyOriginal ?? null,
      priceShipping: d.priceShipping ?? null,
      shippingVerified: d.shippingVerified,
      priceIls: fx.priceIls,
      priceIlsTotal: fx.priceIlsTotal,
      fxRateUsed: fx.fxRateUsed,
      fxAsOf: fx.fxAsOf,
      dataConfidence: { source: "MANUAL_ADMIN" } as any,
      viralPotentialScore: d.viralPotentialScore,
      affiliatePotentialScore: d.affiliatePotentialScore,
      noveltyScore: d.noveltyScore,
      trendMomentumScore: d.trendMomentumScore,
      saturationScore: d.saturationScore,
      overallScore: d.overallScore,
      explanationHe: d.explanationHe,
      origin: "MANUAL",
      trendReport: {
        create: { overallReasoningHe: "נוסף ידנית על ידי מנהל." },
      },
    },
  });

  return json({ product });
});
