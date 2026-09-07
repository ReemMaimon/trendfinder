"use client";

import { useApi, Card, Stat, Badge, ErrorText } from "@/components/admin/ui";

export default function AnalyticsPage() {
  const { data, error, loading } = useApi<any>("/api/admin/analytics?days=21");
  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;

  const { today, history } = data;

  return (
    <div className="space-y-5">
      <Card title="ביצועים כוללים (21 יום)">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="צפיות" value={history.totals.views.toLocaleString("he-IL")} />
          <Stat label="קליקים לקנייה" value={history.totals.clicks.toLocaleString("he-IL")} />
          <Stat label="CTR" value={`${history.totals.ctr}%`} />
        </div>
      </Card>

      {today && (
        <Card title={`היום · ${today.date}`}>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-right">מוצר</th>
                <th>ציון AI</th>
                <th>צפיות</th>
                <th>קליקים</th>
                <th>CTR</th>
                <th>דירוג פופולריות</th>
              </tr>
            </thead>
            <tbody>
              {today.rows.map((r: any) => (
                <tr key={r.productId} className="border-t border-gray-100">
                  <td className="py-1.5">
                    #{r.position} {r.title} {r.reused && <Badge tone="amber">חוזר</Badge>}
                  </td>
                  <td className="text-center">{r.aiOverallScore}</td>
                  <td className="text-center">{r.views}</td>
                  <td className="text-center">{r.clicks}</td>
                  <td className="text-center">{r.ctr}%</td>
                  <td className="text-center">{r.popularityRank}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            ציון ה-AI = פוטנציאל טרנד חיצוני. פופולריות = התנהגות גולשים בפועל. שני מדדים נפרדים.
          </p>
        </Card>
      )}

      <Card title="ביצועים לפי קטגוריה">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500">
            <tr><th className="text-right">קטגוריה</th><th>צפיות</th><th>קליקים</th><th>CTR</th></tr>
          </thead>
          <tbody>
            {history.categoryPerformance.map((c: any) => (
              <tr key={c.category} className="border-t border-gray-100">
                <td className="py-1.5">{c.category}</td>
                <td className="text-center">{c.views}</td>
                <td className="text-center">{c.clicks}</td>
                <td className="text-center">{c.ctr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="לפי יום">
        {history.daily.map((d: any) => (
          <details key={d.date} className="border-b border-gray-100 py-2">
            <summary className="cursor-pointer text-sm font-semibold">
              {d.date} · {d.rows.reduce((a: number, r: any) => a + r.views, 0)} צפיות ·{" "}
              {d.rows.reduce((a: number, r: any) => a + r.clicks, 0)} קליקים
            </summary>
            <ul className="mt-1 text-xs text-gray-600">
              {d.rows.map((r: any) => (
                <li key={r.productId}>
                  #{r.position} {r.title} — {r.views} / {r.clicks} ({r.ctr}%)
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Card>
    </div>
  );
}
