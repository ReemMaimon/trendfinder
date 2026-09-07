"use client";

import Link from "next/link";
import { useApi, Card, Badge, ErrorText } from "@/components/admin/ui";

export default function AdminRunsPage() {
  const { data, error, loading } = useApi<any>("/api/admin/runs?limit=60");
  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-extrabold">ריצות הפקה של ה-AI</h1>
      {data.runs.map((r: any) => (
        <Link key={r.id} href={`/admin/runs/${r.id}`} className="block">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">
                  {r.targetDate}{" "}
                  <Badge tone={r.status === "SUCCESS" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                    {r.status}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  {r.trigger} · {new Date(r.startedAt).toLocaleString("he-IL")} ·{" "}
                  {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"} · מודל {r.aiModel} · v{r.promptVersion}
                </div>
                {r.summary && <div className="mt-1 text-sm text-gray-600">{r.summary}</div>}
              </div>
              <div className="text-left text-xs text-gray-500">
                מועמדים {r._count?.candidates ?? 0}
                <br />
                מוצרים {r._count?.products ?? 0}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
