"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApi, Card, Stat, Badge, ErrorText } from "@/components/admin/ui";
import { LineChart, CompareBars } from "@/components/admin/Charts";

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "היום" },
  { key: "yesterday", label: "אתמול" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
  { key: "90d", label: "90 ימים" },
  { key: "all", label: "הכל" },
  { key: "custom", label: "מותאם" },
];

const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtNum = (n: number) => n.toLocaleString("he-IL");

export default function StatsPage() {
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs =
    range === "custom" && from && to ? `range=custom&from=${from}&to=${to}` : `range=${range}`;
  const { data, error, loading } = useApi<any>(`/api/admin/stats?${qs}`, [qs]);

  const [viewMetric, setViewMetric] = useState<"views" | "uniques">("views");
  const [clickMetric, setClickMetric] = useState<"clicks" | "ctr">("clicks");
  const [popularBy, setPopularBy] = useState<"views" | "clicks" | "ctr">("views");
  const [sortKey, setSortKey] = useState<string>("views");

  const products = useMemo(() => {
    const rows = [...(data?.products ?? [])];
    const key = sortKey;
    rows.sort((a: any, b: any) => {
      if (key === "createdAt") return +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0);
      return (b[key] ?? 0) - (a[key] ?? 0);
    });
    return rows;
  }, [data, sortKey]);

  const popular = useMemo(() => {
    const rows = [...(data?.products ?? [])];
    rows.sort((a: any, b: any) => (b[popularBy] ?? 0) - (a[popularBy] ?? 0));
    return rows.slice(0, 8);
  }, [data, popularBy]);

  return (
    <div className="space-y-5">
      {/* range */}
      <Card title="טווח זמן">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                range === r.key ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1" />
            <span>–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1" />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{data?.range?.label ?? ""}</span>
          <a
            href={`/api/admin/stats/export?${qs}`}
            className="rounded-lg border border-gray-300 px-3 py-1 font-semibold text-gray-700"
          >
            ⬇ ייצוא CSV
          </a>
        </div>
      </Card>

      {loading && !data && <p>טוען…</p>}
      {error && <ErrorText>{error}</ErrorText>}

      {data && (
        <>
          {/* dashboard cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="👀 סך צפיות" value={fmtNum(data.overview.totalViews)} />
            <Stat label="👤 מבקרים ייחודיים" value={fmtNum(data.overview.uniqueVisitors)} />
            <Stat label="🛒 קליקים לקנייה" value={fmtNum(data.overview.buyClicks)} />
            <Stat label="📈 CTR" value={fmtPct(data.overview.ctr)} />
            <Stat
              label="🔥 הכי נצפה"
              value={
                data.overview.mostViewedProduct ? (
                  <Link href={`/admin/stats/${data.overview.mostViewedProduct.id}`} className="text-sm text-brand-700">
                    {data.overview.mostViewedProduct.title}
                  </Link>
                ) : (
                  "אין מספיק נתונים"
                )
              }
            />
            <Stat
              label="⭐ הביצועים הטובים ביותר"
              value={
                data.overview.bestProduct ? (
                  <Link href={`/admin/stats/${data.overview.bestProduct.id}`} className="text-sm text-brand-700">
                    {data.overview.bestProduct.title}
                  </Link>
                ) : (
                  "אין מספיק נתונים"
                )
              }
            />
            <Stat label="📅 צפיות היום" value={fmtNum(data.overview.todayViews)} />
            <Stat label="📅 קליקים היום" value={fmtNum(data.overview.todayClicks)} />
          </div>

          {/* views over time */}
          <Card
            title="צפיות לאורך זמן"
            actions={
              <div className="flex gap-1 text-xs">
                {(["views", "uniques"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMetric(m)}
                    className={`rounded px-2 py-0.5 font-semibold ${viewMetric === m ? "bg-brand-600 text-white" : "bg-gray-100"}`}
                  >
                    {m === "views" ? "צפיות" : "ייחודיים"}
                  </button>
                ))}
              </div>
            }
          >
            <LineChart
              labels={data.viewsSeries.map((x: any) => x.bucket)}
              series={[
                {
                  label: viewMetric === "views" ? "צפיות" : "מבקרים ייחודיים",
                  color: "#ea580c",
                  values: data.viewsSeries.map((x: any) => (viewMetric === "views" ? x.count : x.uniques)),
                },
              ]}
            />
          </Card>

          {/* clicks over time */}
          <Card
            title="קליקים ל-AliExpress לאורך זמן"
            actions={
              <div className="flex gap-1 text-xs">
                {(["clicks", "ctr"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setClickMetric(m)}
                    className={`rounded px-2 py-0.5 font-semibold ${clickMetric === m ? "bg-brand-600 text-white" : "bg-gray-100"}`}
                  >
                    {m === "clicks" ? "קליקים" : "CTR"}
                  </button>
                ))}
              </div>
            }
          >
            <LineChart
              labels={data.clicksSeries.map((x: any) => x.bucket)}
              format={clickMetric === "ctr" ? (n) => `${n}%` : fmtNum}
              series={[
                {
                  label: clickMetric === "clicks" ? "קליקים" : "CTR",
                  color: "#2563eb",
                  values: data.clicksSeries.map((x: any) => (clickMetric === "clicks" ? x.clicks : x.ctr)),
                },
              ]}
            />
          </Card>

          {/* popular products */}
          <Card
            title="🔥 מוצרים פופולריים"
            actions={
              <select
                value={popularBy}
                onChange={(e) => setPopularBy(e.target.value as any)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="views">לפי צפיות</option>
                <option value="clicks">לפי קליקים</option>
                <option value="ctr">לפי CTR</option>
              </select>
            }
          >
            {popular.length === 0 ? (
              <p className="text-sm text-gray-400">אין מספיק נתונים</p>
            ) : (
              <ul className="space-y-2">
                {popular.map((p: any, i: number) => (
                  <li key={p.productId} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-gray-400">{i + 1}</span>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-100" />
                    )}
                    <Link href={`/admin/stats/${p.productId}`} className="min-w-0 flex-1 truncate text-sm text-brand-700">
                      {p.trendTitle}
                    </Link>
                    <span className="tabular-nums text-sm font-bold">
                      {popularBy === "ctr" ? fmtPct(p.ctr) : fmtNum(p[popularBy])}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* category performance */}
          <Card title="ביצועים לפי קטגוריה">
            {data.categories.length === 0 ? (
              <p className="text-sm text-gray-400">אין מספיק נתונים</p>
            ) : (
              <>
                <CompareBars rows={data.categories.map((c: any) => ({ label: c.category, value: c.views }))} format={fmtNum} />
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-xs text-gray-500">
                      <tr>
                        <th className="text-right">קטגוריה</th>
                        <th>מוצרים</th>
                        <th>צפיות</th>
                        <th>קליקים</th>
                        <th>CTR</th>
                        <th>ממוצע ציון טרנד</th>
                        <th>ממוצע ויראלי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map((c: any) => (
                        <tr key={c.category} className="border-t border-gray-100">
                          <td className="py-1.5">{c.category}</td>
                          <td className="text-center">{c.products}</td>
                          <td className="text-center">{fmtNum(c.views)}</td>
                          <td className="text-center">{fmtNum(c.clicks)}</td>
                          <td className="text-center">{fmtPct(c.ctr)}</td>
                          <td className="text-center">{c.avgTrendScore}</td>
                          <td className="text-center">{c.avgViralPotential}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {/* product performance table */}
          <Card
            title="ביצועי מוצרים"
            actions={
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                <option value="views">הכי נצפה</option>
                <option value="clicks">הכי הרבה קליקים</option>
                <option value="ctr">CTR הגבוה ביותר</option>
                <option value="trendScore">Trend Score</option>
                <option value="performanceScore">ביצועים כללי</option>
                <option value="createdAt">חדש ביותר</option>
              </select>
            }
          >
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">אין מספיק נתונים בטווח הזה</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr>
                      <th className="text-right">מוצר</th>
                      <th>צפיות</th>
                      <th>ייחודי</th>
                      <th>קליקים</th>
                      <th>CTR</th>
                      <th>Trend Score</th>
                      <th>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: any) => (
                      <tr key={p.productId} className="border-t border-gray-100">
                        <td className="py-1.5">
                          <Link href={`/admin/stats/${p.productId}`} className="text-brand-700">
                            {p.trendTitle}
                          </Link>
                          <span className="ms-1 text-xs text-gray-400">{p.category}</span>
                        </td>
                        <td className="text-center">{fmtNum(p.views)}</td>
                        <td className="text-center">{fmtNum(p.uniqueViews)}</td>
                        <td className="text-center">{fmtNum(p.clicks)}</td>
                        <td className="text-center">{fmtPct(p.ctr)}</td>
                        <td className="text-center">{p.trendScore}</td>
                        <td className="text-center text-xs text-gray-500">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString("he-IL") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* traffic sources */}
          <Card title="מקורות תנועה">
            {data.sources.length === 0 ? (
              <p className="text-sm text-gray-400">אין נתוני מקור זמינים</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr><th className="text-right">מקור</th><th>מבקרים</th><th>צפיות</th><th>קליקים</th><th>CTR</th></tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s: any) => (
                      <tr key={s.source} className="border-t border-gray-100">
                        <td className="py-1.5 capitalize">{s.source}</td>
                        <td className="text-center">{fmtNum(s.visitors)}</td>
                        <td className="text-center">{fmtNum(s.views)}</td>
                        <td className="text-center">{fmtNum(s.clicks)}</td>
                        <td className="text-center">{fmtPct(s.ctr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">
              מקור מזוהה לפי referrer / utm_source כשהם זמינים. תנועה מ-WhatsApp נספרת רק כשניתן לזהותה
              (הוסיפו <code>?utm_source=whatsapp</code> לקישורים שאתם משתפים בערוץ לזיהוי אמין).
            </p>
          </Card>

          {/* whatsapp */}
          <Card title="WhatsApp">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="צפיות" value={fmtNum(data.whatsapp.totals.views)} />
              <Stat label="מבקרים" value={fmtNum(data.whatsapp.totals.visitors)} />
              <Stat label="קליקים" value={fmtNum(data.whatsapp.totals.clicks)} />
              <Stat label="CTR" value={fmtPct(data.whatsapp.totals.ctr)} />
            </div>
            {data.whatsapp.products.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {data.whatsapp.products.map((p: any) => (
                  <li key={p.productId} className="flex justify-between">
                    <Link href={`/admin/stats/${p.productId}`} className="text-brand-700">{p.title}</Link>
                    <span className="text-gray-500">{fmtNum(p.views)} צפיות · {fmtNum(p.clicks)} קליקים · {fmtPct(p.ctr)}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.whatsapp.totals.views === 0 && (
              <p className="mt-2 text-xs text-gray-400">אין עדיין תנועה מזוהה מ-WhatsApp בטווח הזה.</p>
            )}
          </Card>

          {/* daily performance */}
          <Card title="ביצועים יומיים">
            {data.daily.length === 0 ? (
              <p className="text-sm text-gray-400">אין נתונים</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr><th className="text-right">תאריך</th><th>מוצרים</th><th>צפיות</th><th>קליקים</th><th>CTR</th></tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d: any) => (
                      <tr key={d.date} className="border-t border-gray-100">
                        <td className="py-1.5">{d.date}</td>
                        <td className="text-center">{d.products}</td>
                        <td className="text-center">{fmtNum(d.views)}</td>
                        <td className="text-center">{fmtNum(d.clicks)}</td>
                        <td className="text-center">{fmtPct(d.ctr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* best products */}
          <Card title="🏆 Best Performing Products">
            {data.products.length === 0 ? (
              <p className="text-sm text-gray-400">אין מספיק נתונים</p>
            ) : (
              <ol className="space-y-2">
                {[...data.products]
                  .sort((a: any, b: any) => b.performanceScore - a.performanceScore)
                  .slice(0, 10)
                  .map((p: any, i: number) => (
                    <li key={p.productId} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 text-sm font-bold text-gray-400">{i + 1}</span>
                        <Link href={`/admin/stats/${p.productId}`} className="truncate text-sm text-brand-700">
                          {p.trendTitle}
                        </Link>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {fmtNum(p.views)} צפיות · {fmtNum(p.clicks)} קליקים · {fmtPct(p.ctr)} ·{" "}
                        <Badge tone="blue">ציון {p.performanceScore}</Badge>
                      </span>
                    </li>
                  ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
