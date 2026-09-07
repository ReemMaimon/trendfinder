"use client";

import { useParams } from "next/navigation";
import { useApi, Card, Badge, ErrorText } from "@/components/admin/ui";

const CAND_TONE: Record<string, string> = {
  ACCEPTED: "green",
  REJECTED_NO_PRODUCT: "amber",
  REJECTED_DUPLICATE: "amber",
  REJECTED_SIMILAR: "amber",
  REJECTED_LOW_SCORE: "gray",
  REJECTED_SATURATED: "gray",
  REJECTED_DATA_QUALITY: "red",
  REJECTED_OTHER: "red",
};

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<any>(`/api/admin/runs/${id}`);
  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  const run = data.run;

  return (
    <div className="space-y-4">
      <Card title={`ריצה · ${run.targetDate}`}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>סטטוס: <Badge tone={run.status === "SUCCESS" ? "green" : run.status === "FAILED" ? "red" : "amber"}>{run.status}</Badge></div>
          <div>טריגר: {run.trigger}</div>
          <div>מצב: {run.mode}</div>
          <div>מודל: {run.aiModel} (prompt v{run.promptVersion})</div>
          <div>התחלה: {new Date(run.startedAt).toLocaleString("he-IL")}</div>
          <div>משך: {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</div>
        </div>
        {run.summary && <p className="mt-2 rounded bg-gray-50 p-2 text-sm">{run.summary}</p>}
        {run.stats && (
          <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(run.stats, null, 2)}</pre>
        )}
      </Card>

      {run.searchedTopics?.length > 0 && (
        <Card title="נושאים שנחקרו">
          <div className="flex flex-wrap gap-1">
            {run.searchedTopics.map((t: string, i: number) => (
              <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </Card>
      )}

      <Card title={`מועמדים (${run.candidates.length})`}>
        <ol className="space-y-2">
          {run.candidates.map((c: any) => (
            <li key={c.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">#{c.order} {c.trendTitle}</span>
                <Badge tone={CAND_TONE[c.status] ?? "gray"}>{c.status}</Badge>
              </div>
              <p className="mt-1 text-gray-600">{c.trendDescription}</p>
              {c.category && <div className="text-xs text-gray-500">קטגוריה: {c.category}</div>}
              {c.aeUrl && (
                <a href={c.aeUrl} target="_blank" className="text-xs text-brand-600">
                  {c.aeTitle || c.aeUrl} ↗
                </a>
              )}
              {c.scores && (
                <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(c.scores, null, 2)}</pre>
              )}
              {c.rejectionReason && <p className="mt-1 text-xs text-red-600">סיבת דחייה: {c.rejectionReason}</p>}
              {c.socialSignals && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-gray-500">אותות חברתיים</summary>
                  <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(c.socialSignals, null, 2)}</pre>
                </details>
              )}
              {c.rawResearch && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-gray-500">מחקר גולמי מה-AI</summary>
                  <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(c.rawResearch, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <Card title={`מקורות (${run.sources.length})`}>
        <ul className="space-y-1 text-xs">
          {run.sources.map((s: any) => (
            <li key={s.id}>
              <span className="rounded bg-gray-100 px-1.5">{s.sourceType}</span>{" "}
              <a href={s.url} target="_blank" className="text-brand-600">{s.title || s.url}</a>
              {s.relevance ? ` — ${s.relevance}` : ""}
            </li>
          ))}
        </ul>
      </Card>

      {Array.isArray(run.errorLog) && run.errorLog.length > 0 && (
        <Card title="יומן שגיאות">
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-700">
            {JSON.stringify(run.errorLog, null, 2)}
          </pre>
        </Card>
      )}

      <Card title={`יומני API (${run.apiLogs.length})`}>
        <ul className="space-y-1 text-xs">
          {run.apiLogs.map((l: any) => (
            <li key={l.id} className={l.ok ? "text-gray-600" : "text-red-600"}>
              [{l.provider}] {l.operation} · {l.ok ? "OK" : "FAIL"} · {l.durationMs ?? "?"}ms
              {l.errorText ? ` · ${l.errorText}` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
