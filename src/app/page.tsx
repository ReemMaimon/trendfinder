import type { Metadata } from "next";
import { PublicService } from "@/services/public/PublicService";
import { ProductCard } from "@/components/ProductCard";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "המוצרים החמים של היום",
  alternates: { canonical: env.SITE_URL },
};

export default async function HomePage() {
  const { date, products } = await PublicService.today();

  return (
    <main className="container-mobile py-6">
      <header className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <BrandLogo variant="hero" />
        </div>
        <h1 className="text-2xl font-extrabold leading-tight text-ink">
          🔥 המוצרים החמים של היום
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          כל יום ב-00:00 אנחנו מגלים טרנדים מתפרצים, חוקרים אותם עם בינה מלאכותית ומאתרים
          מוצרים תואמים ב-AliExpress — לפני שכולם מדברים עליהם.
        </p>
        <div className="mt-2 text-xs text-ink-muted">
          עודכן לתאריך {new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(date))}
        </div>
      </header>

      {products.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="text-4xl">⏳</div>
          <h2 className="mt-2 text-lg font-extrabold text-ink">המוצרים של היום עדיין בהכנה</h2>
          <p className="mt-1 text-sm text-ink-muted">
            תהליך הגילוי היומי רץ אוטומטית ב-00:00 (שעון ישראל). חזרו בקרוב.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} rank={i + 1} />
          ))}
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
