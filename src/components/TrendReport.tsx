import type { PublicProduct, SignalDisplay } from "@/services/public/PublicService";
import { SignalRow } from "./SignalBadge";

const PLATFORMS = ["tiktok", "instagram", "youtube", "googleTrends"] as const;

export function TrendReport({ product }: { product: PublicProduct }) {
  const s = product.social;

  // Only show platforms that actually have a signal — hide "לא ידוע" / UNKNOWN rows.
  const rows = s
    ? PLATFORMS.filter((p) => (s[p] as SignalDisplay).level !== "UNKNOWN")
    : [];

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-lg font-extrabold text-ink">🔥 למה זה טרנדי?</h2>

      {rows.length > 0 && (
        <div className="mb-4 rounded-xl bg-brand-50 p-3">
          {rows.map((p) => (
            <SignalRow key={p} platform={p} signal={s![p] as SignalDisplay} />
          ))}
        </div>
      )}

      <p className="rounded-xl bg-ink/5 p-3 text-sm leading-relaxed text-ink-soft">
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
