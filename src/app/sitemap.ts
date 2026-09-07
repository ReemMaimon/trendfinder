import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.SITE_URL.replace(/\/$/, "");
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { dailyItems: { some: { set: { status: "PUBLISHED" } } } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    productEntries = products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch {
    /* DB not reachable at build time — return just the homepage */
  }

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...productEntries,
  ];
}
