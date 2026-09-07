export function ScoreBar({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: number;
  tone?: "brand" | "ink" | "red";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const barColor =
    tone === "red" ? "bg-red-500" : tone === "ink" ? "bg-ink" : "bg-brand-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="font-bold tabular-nums text-ink">{pct}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
