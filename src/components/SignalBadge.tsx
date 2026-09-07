import type { SignalDisplay } from "@/services/public/PublicService";

const TONE: Record<string, string> = {
  VERY_HIGH: "bg-red-100 text-red-700",
  HIGH: "bg-brand-100 text-brand-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-600",
  UNKNOWN: "bg-gray-100 text-gray-400",
};

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  googleTrends: "Google Trends",
};

export function SignalRow({
  platform,
  signal,
}: {
  platform: keyof typeof PLATFORM_LABEL;
  signal: SignalDisplay;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-brand-50 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-bold text-ink">{PLATFORM_LABEL[platform]}</div>
        {signal.reasoning ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {signal.reasoning}
          </p>
        ) : null}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${TONE[signal.level] ?? TONE.UNKNOWN}`}
      >
        {signal.labelHe}
      </span>
    </div>
  );
}
