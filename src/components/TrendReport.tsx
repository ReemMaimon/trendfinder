import type { PublicProduct } from "@/services/public/PublicService";
import { ScoreBar } from "./ScoreBar";
import { SignalRow } from "./SignalBadge";

export function TrendReport({ product }: { product: PublicProduct }) {
  const s = product.social;
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-lg font-extrabold text-ink">🔥 למה זה טרנדי?</h2>

      {s && (
        <div className="mb-4 rounded-xl bg-brand-50 p-3">
          <SignalRow platform="tiktok" signal={s.tiktok} />
          <SignalRow platform="instagram" signal={s.instagram} />
          <SignalRow platform="youtube" signal={s.youtube} />
          <SignalRow platform="googleTrends" signal={s.googleTrends} />
        </div>
      )}

      <div className="space-y-3">
        <ScoreBar label="פוטנציאל ויראלי" value={product.scores.viral} />
        <ScoreBar label="פוטנציאל שותפים" value={product.scores.affiliate} />
        <ScoreBar label="מומנטום טרנד" value={product.scores.momentum} />
        <ScoreBar label="חדשנות" value={product.scores.novelty} />
        <ScoreBar label="רוויה בשוק" value={product.scores.saturation} tone="red" />
      </div>

      <p className="mt-4 rounded-xl bg-ink/5 p-3 text-sm leading-relaxed text-ink-soft">
        {product.explanationHe}
      </p>
      {s?.reasoningHe && (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">{s.reasoningHe}</p>
      )}

      {s?.verifiedMetrics && Object.keys(s.verifiedMetrics).length > 0 && (
        <div className="mt-3 text-xs text-ink-muted">
          <div className="font-bold text-ink-soft">נתונים מאומתים:</div>
          <ul className="mt-1 list-inside list-disc">
            {Object.entries(s.verifiedMetrics).map(([k, v]) => (
              <li key={k}>
                {k}: {String(v)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
