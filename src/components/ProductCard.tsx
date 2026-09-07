import Link from "next/link";
import type { PublicProduct } from "@/services/public/PublicService";
import { BuyButton } from "./BuyButton";
import { TrackView } from "./Analytics";

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-xs text-ink-muted">אין דירוג</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-500">
      ★ <span className="tabular-nums text-ink">{rating.toFixed(1)}</span>
    </span>
  );
}

export function ProductCard({ product, rank }: { product: PublicProduct; rank: number }) {
  return (
    <article className="card overflow-hidden">
      <TrackView productId={product.id} type="view-card" />
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative bg-brand-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images[0] ?? ""}
            alt={product.title}
            className="aspect-[4/3] w-full object-cover"
            loading={rank === 1 ? "eager" : "lazy"}
          />
          <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-sm font-extrabold text-brand-700 shadow">
            #{rank}
          </span>
          {product.reused && (
            <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2 py-1 text-[11px] font-bold text-white">
              חוזר מהימים האחרונים
            </span>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="chip">{product.categoryHe}</span>
            <span className="score-pill">🔥 {product.scores.overall}/100</span>
          </div>

          <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-ink">
            {product.trendTitle}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {product.explanationHe}
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="text-lg font-extrabold text-ink">
              {product.price.ilsText}
              {product.price.withShipping && (
                <span className="mr-1 text-xs font-semibold text-emerald-600"> כולל משלוח</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Stars rating={product.rating} />
              {product.orders != null && (
                <span className="text-xs text-ink-muted">{product.orders.toLocaleString("he-IL")} הזמנות</span>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className="px-4 pb-4">
        <BuyButton productId={product.id} />
      </div>
    </article>
  );
}
