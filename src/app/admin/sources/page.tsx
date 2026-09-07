"use client";

import { useApi, Card, ErrorText } from "@/components/admin/ui";

export default function SourcesPage() {
  const { data, error, loading } = useApi<any>("/api/admin/sources?limit=400");
  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;

  return (
    <Card title={`מקורות (${data.sources.length})`}>
      <ul className="space-y-1 text-sm">
        {data.sources.map((s: any) => (
          <li key={s.id} className="border-b border-gray-100 py-1.5">
            <span className="rounded bg-gray-100 px-1.5 text-xs">{s.sourceType}</span>{" "}
            <a href={s.url} target="_blank" className="text-brand-600">
              {s.title || s.url}
            </a>
            <div className="text-xs text-gray-500">
              {s.supports ? `תומך ב: ${s.supports} · ` : ""}
              {s.relevance || ""}
              {s.product ? ` · מוצר: ${s.product.aeTitle}` : ""}
              {s.run ? ` · ריצה ${s.run.targetDate}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
