import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicService } from "@/services/public/PublicService";
import { ImageGallery } from "@/components/ImageGallery";
import { TrendReport } from "@/components/TrendReport";
import { BuyButton } from "@/components/BuyButton";
import { BrandLogo } from "@/components/BrandLogo";
import { TrackView } from "@/components/Analytics";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await PublicService.productBySlug(params.slug);
  if (!product) return { title: "מוצר לא נמצא" };
  return {
    title: product.trendTitle,
    description: product.explanationHe.slice(0, 160),
    alternates: { canonical: `${env.SITE_URL}/product/${product.slug}` },
    openGraph: {
      title: product.trendTitle,
      description: product.explanationHe.slice(0, 200),
      images: product.images.slice(0, 1),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await PublicService.productBySlug(params.slug);
  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? product.explanationHe,
    image: product.images,
    category: product.categoryHe,
    ...(product.rating != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            ratingCount: product.orders ?? 1,
          },
        }
      : {}),
    ...(product.price.ils != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "ILS",
            price: product.price.ils,
            availability: "https://schema.org/InStock",
            url: `${env.SITE_URL}/product/${product.slug}`,
          },
        }
      : {}),
  };

  return (
    <main className="container-mobile py-5">
      <TrackView productId={product.id} type="view-detail" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700">
          → חזרה למוצרים של היום
        </Link>
        <Link href="/" aria-label="TrendFinder">
          <BrandLogo variant="compact" />
        </Link>
      </div>

      <div className="space-y-4">
        <ImageGallery images={product.images} alt={product.title} />

        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="chip">{product.categoryHe}</span>
            <span className="score-pill">🔥 ציון טרנד {product.scores.overall}/100</span>
            {product.reused && (
              <span className="rounded-full bg-ink/80 px-2 py-1 text-[11px] font-bold text-white">
                מוצר חוזר
              </span>
            )}
          </div>

          <h1 className="text-xl font-extrabold leading-snug text-ink">{product.trendTitle}</h1>
          <p className="mt-1 text-sm text-ink-muted">{product.title}</p>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold text-ink">{product.price.ilsText}</div>
              <div className="text-xs text-ink-muted">
                {product.price.withShipping
                  ? "כולל משלוח (מאומת)"
                  : product.price.ils != null
                    ? "מחיר מוצר (ללא משלוח מאומת)"
                    : "המחיר אינו זמין כרגע"}
                {product.price.originalText ? ` · מקור: ${product.price.originalText}` : ""}
              </div>
            </div>
            <div className="text-left text-sm">
              {product.rating != null && (
                <div className="font-bold text-amber-500">★ {product.rating.toFixed(1)}</div>
              )}
              {product.orders != null && (
                <div className="text-xs text-ink-muted">
                  {product.orders.toLocaleString("he-IL")} הזמנות
                </div>
              )}
              {product.storeName && (
                <div className="text-xs text-ink-muted">חנות: {product.storeName}</div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <BuyButton productId={product.id} />
          </div>
        </div>

        <TrendReport product={product} />

        {product.description && (
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold text-ink">תיאור המוצר</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {product.description}
            </p>
          </section>
        )}

        {product.variants && product.variants.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold text-ink">וריאציות</h2>
            <ul className="space-y-1 text-sm text-ink-soft">
              {product.variants.map((v) => (
                <li key={v.name}>
                  <span className="font-bold">{v.name}:</span> {v.options.join(", ")}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="px-2 pb-8 pt-2 text-center text-xs leading-relaxed text-ink-muted">
          המידע נאסף ממקורות ציבוריים ומ-AliExpress. שדות שלא ניתן היה לאמת מסומנים כ&quot;לא זמין&quot;
          ואינם מומצאים. הרכישה, המשלוח והתשלום מתבצעים ישירות מול AliExpress.
        </p>
      </div>
    </main>
  );
}
