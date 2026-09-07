"use client";

import Link from "next/link";
import { useApi, Card, Badge, ErrorText } from "@/components/admin/ui";

export default function AdminHistoryPage() {
  const { data, error, loading } = useApi<any>("/api/admin/sets?limit=120");

  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-extrabold">היסטוריית סטים יומיים</h1>
      {data.sets.map((s: any) => (
        <Card
          key={s.id}
          title={s.date}
          actions={
            <div className="flex gap-2">
              <Badge tone={s.status === "PUBLISHED" ? "green" : "amber"}>{s.status}</Badge>
              <Link href={`/admin/today?d=${s.date}`} className="text-sm text-brand-600">
                פתיחה
              </Link>
            </div>
          }
        >
          <ol className="grid gap-2 sm:grid-cols-3">
            {s.items.map((it: any) => (
              <li key={it.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                <div className="font-semibold">
                  #{it.position} {it.product.trendTitle}
                </div>
                <div className="text-xs text-gray-500">
                  {it.product.category} · ציון {it.product.overallScore}
                  {it.reused && " · חוזר"}
                </div>
              </li>
            ))}
          </ol>
          {s.generationRun && (
            <div className="mt-2 text-xs text-gray-500">
              ריצה:{" "}
              <Link href={`/admin/runs/${s.generationRun.id}`} className="text-brand-600">
                {s.generationRun.status} ({s.generationRun.trigger})
              </Link>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
