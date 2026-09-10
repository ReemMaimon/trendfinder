"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi, Card, Stat, ErrorText } from "@/components/admin/ui";
import { LineChart } from "@/components/admin/Charts";

const RANGES = [
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
  { key: "90d", label: "90 ימים" },
  { key: "all", label: "הכל" },
];
const fmtNum = (n: number) => n.toLocaleString("he-IL");
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function ProductStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState("30d");
  const { data, error, loading } = useApi<any>(`/api/admin/stats/product/${id}?range=${range}`, [id, range]);

  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;

  const p = data.product;

  return (
    <div className="space-y-5">
      <Link href="/admin/stats" className="text-sm font-bold text-brand-700">→ חזרה לסטטיסטיקות</Link>

      <Card
        title={p.trendTitle}
        actions={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded px-2 py-0.5 text-xs font-semibold ${range === r.key ? "bg-brand-600 text-white" : "bg-gray-100"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex items-start gap-3">
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <div className="text-sm text-gray-500">
            <div>{p.aeTitle}</div>
            <div className="mt-0.5">קטגוריה {p.category}</div>
            <Link href={`/product/${p.slug}`} target="_blank" className="text-brand-600">
              עמוד המוצר באתר ↗
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="סך צפיות" value={fmtNum(data.views)} />
        <Stat label="צפיות ייחודיות" value={fmtNum(data.uniqueViews)} />
        <Stat label="קליקים לקנייה" value={fmtNum(data.clicks)} />
        <Stat label="CTR" value={fmtPct(data.ctr)} />
        <Stat label="זמן ממוצע בעמוד" value={data.avgTimeOnPage == null ? "לא נאסף" : `${data.avgTimeOnPage}s`} />
        <Stat label="ימי פעילות" value={data.activeDays} />
        <Stat label="פורסם לראשונה" value={data.firstShown ?? "—"} />
        <Stat label="פורסם לאחרונה" value={data.lastShown ?? "—"} />
      </div>

      <Card title="ציוני AI">
        <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          <Stat label="Trend Score" value={p.trendScore} />
          <Stat label="Viral Potential" value={p.viralPotential} />
          <Stat label="Novelty" value={p.noveltyScore} />
          <Stat label="Trend Momentum" value={p.trendMomentum} />
          <Stat label="Saturation" value={p.saturationScore} />
          <Stat label="Affiliate Potential" value={p.affiliatePotential} />
        </div>
      </Card>

      <Card title="צפיות וקליקים לאורך זמן">
        <LineChart
          labels={data.series.map((x: any) => x.bucket)}
          series={[
            { label: "צפיות", color: "#ea580c", values: data.series.map((x: any) => x.views) },
            { label: "קליקים", color: "#2563eb", values: data.series.map((x: any) => x.clicks) },
          ]}
        />
      </Card>

      {data.shownDates?.length > 0 && (
        <Card title="ימים שבהם המוצר הוצג">
          <div className="flex flex-wrap gap-1 text-xs">
            {data.shownDates.map((d: string) => (
              <span key={d} className="rounded bg-gray-100 px-2 py-0.5">{d}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
