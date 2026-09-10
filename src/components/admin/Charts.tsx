"use client";

import { useId, useState } from "react";

export interface SeriesDef {
  label: string;
  color: string;
  values: number[];
}

/**
 * Dependency-free responsive SVG line chart. Renders 1-2 series over shared
 * x-labels, with a hover crosshair + tooltip. Matches the admin's light theme.
 */
export function LineChart({
  labels,
  series,
  height = 200,
  format = (n: number) => String(n),
}: {
  labels: string[];
  series: SeriesDef[];
  height?: number;
  format?: (n: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 700;
  const H = height;
  const padL = 40;
  const padB = 22;
  const padT = 10;
  const padR = 10;

  const n = labels.length;
  if (n === 0) return <div className="py-10 text-center text-sm text-gray-400">אין נתונים בטווח הזה</div>;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const gridLines = 4;
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="w-full overflow-x-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((rel - padL) / (W - padL - padR)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: gridLines + 1 }).map((_, g) => {
          const gv = (max / gridLines) * g;
          return (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={y(gv) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
                {format(Math.round(gv))}
              </text>
            </g>
          );
        })}

        {labels.map((lab, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {lab.length > 6 ? lab.slice(5) : lab}
            </text>
          ) : null,
        )}

        {series.map((s, si) => {
          const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
          const area = `${d} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
          return (
            <g key={si}>
              <path d={area} fill={s.color} opacity={0.08} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {n <= 40 &&
                s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={s.color} />)}
            </g>
          );
        })}

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#9ca3af" strokeDasharray="3 3" />
            {series.map((s, si) => (
              <circle key={si} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
            ))}
          </g>
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between text-xs">
        <div className="flex gap-3">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        {hover != null && (
          <span className="text-gray-500">
            {labels[hover]} ·{" "}
            {series.map((s) => `${s.label} ${format(s.values[hover])}`).join("  ·  ")}
          </span>
        )}
      </div>
      <span className="sr-only" id={id} />
    </div>
  );
}

/** Horizontal comparison bars (categories, sources). */
export function CompareBars({
  rows,
  format = (n: number) => String(n),
  color = "#ea580c",
}: {
  rows: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}) {
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-gray-400">אין נתונים</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="text-xs">
          <div className="mb-0.5 flex justify-between">
            <span className="font-semibold text-gray-700">{r.label}</span>
            <span className="tabular-nums text-gray-500">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
