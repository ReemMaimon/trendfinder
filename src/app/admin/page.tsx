"use client";

import { useApi, Card, Stat, Badge, ErrorText } from "@/components/admin/ui";
import { GenerateButton } from "@/components/admin/GenerateButton";
import { ModeSwitch } from "@/components/admin/ModeSwitch";
import Link from "next/link";

export default function AdminDashboard() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/dashboard");

  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;

  const { today, scheduler, mode, ai, lastRuns, counts } = data;
  const hoursToMidnight = (scheduler.msUntilMidnight / 3_600_000).toFixed(1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="מוצרים במאגר" value={counts.products} />
        <Stat label="סטים יומיים" value={counts.sets} />
        <Stat label="ריצות AI" value={counts.runs} />
        <Stat label="ריצות שנכשלו" value={counts.failedRuns} tone={counts.failedRuns ? "bad" : "ok"} />
      </div>

      <Card title="מצב מערכת">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-bold">
              מצב אפליקציה:{" "}
              <Badge tone={mode.effective === "PRODUCTION" ? "green" : "amber"}>{mode.effective}</Badge>
            </div>
            <div className="mt-1 text-gray-600">
              ברירת מחדל מ-ENV: {mode.envDefault} · דריסה: {mode.override ?? "אין"}
            </div>
            {mode.effective === "TEST" && (
              <div className="mt-1 text-gray-600">מצב בדיקה — עיבוד אפיליאייט כבוי. כפתור הקנייה משתמש בקישור AliExpress רגיל.</div>
            )}
            {!mode.affiliateConfigured && (
              <div className="mt-1 text-amber-700">
                תצורת אפיליאייט חסרה: {mode.affiliateMissing.join(", ") || "—"}
              </div>
            )}
            <div className="mt-2">
              <ModeSwitch current={mode.effective} onChanged={reload} />
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-bold">מתזמן</div>
            <div className="mt-1 text-gray-600">אזור זמן: {scheduler.timezone}</div>
            <div className="text-gray-600">Cron בתהליך: {scheduler.inProcessCron ? "פעיל" : "כבוי"}</div>
            <div className="text-gray-600">הריצה הבאה בעוד ~{hoursToMidnight} שעות (00:00)</div>
            <div className="mt-1 text-gray-600">
              ספק AI: {ai.provider} · מודל: {ai.model} · {ai.ready ? "מוכן" : "לא מוכן (חסר מפתח)"}
            </div>
          </div>
        </div>
      </Card>

      <Card title="הפקה ידנית">
        <GenerateButton onDone={reload} />
      </Card>

      <Card
        title={`המוצרים של היום (${today.date})`}
        actions={<Link href="/admin/today" className="text-sm text-brand-600">עריכה →</Link>}
      >
        {today.set?.items?.length ? (
          <ol className="space-y-2">
            {today.set.items.map((it: any) => {
              const r = today.report?.rows?.find((x: any) => x.productId === it.productId);
              return (
                <li key={it.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm">
                  <span className="font-semibold">
                    #{it.position} {it.product.trendTitle}
                    {it.reused && <Badge tone="amber"> חוזר</Badge>}
                  </span>
                  <span className="text-gray-500">
                    ציון {it.product.overallScore} · צפיות {r?.views ?? 0} · קליקים {r?.clicks ?? 0} · CTR {r?.ctr ?? 0}%
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-gray-500">אין סט מפורסם להיום עדיין.</p>
        )}
      </Card>

      <Card title="ריצות אחרונות" actions={<Link href="/admin/runs" className="text-sm text-brand-600">הכל →</Link>}>
        <ul className="space-y-1 text-sm">
          {lastRuns.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between">
              <Link href={`/admin/runs/${r.id}`} className="text-brand-700">
                {r.targetDate} · {r.trigger}
              </Link>
              <Badge tone={r.status === "SUCCESS" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                {r.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
