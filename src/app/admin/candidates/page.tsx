"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, Card, Badge, ErrorText } from "@/components/admin/ui";

const FILTERS = [
  { key: "", label: "הכל" },
  { key: "ACCEPTED", label: "התקבלו" },
  { key: "rejected", label: "נדחו" },
  { key: "REJECTED_NO_PRODUCT", label: "אין מוצר" },
  { key: "REJECTED_DUPLICATE", label: "כפילות" },
  { key: "REJECTED_SIMILAR", label: "דמיון" },
  { key: "REJECTED_SATURATED", label: "רווי" },
  { key: "REJECTED_LOW_SCORE", label: "ציון נמוך" },
];

export default function CandidatesPage() {
  const [filter, setFilter] = useState("");
  const qs =
    filter === "rejected" ? "?rejected=1&limit=200" : filter ? `?status=${filter}&limit=200` : "?limit=200";
  const { data, error, loading } = useApi<any>(`/api/admin/candidates${qs}`, [filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-white text-gray-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && !data && <p>טוען…</p>}
      {error && <ErrorText>{error}</ErrorText>}

      {data?.candidates?.map((c: any) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between">
            <span className="font-bold">{c.trendTitle}</span>
            <Badge tone={c.status === "ACCEPTED" ? "green" : "amber"}>{c.status}</Badge>
          </div>
          <div className="text-xs text-gray-500">
            ריצה{" "}
            <Link href={`/admin/runs/${c.run.id}`} className="text-brand-600">
              {c.run.targetDate}
            </Link>{" "}
            · {new Date(c.run.startedAt).toLocaleDateString("he-IL")}
          </div>
          <p className="mt-1 text-sm text-gray-600">{c.trendDescription}</p>
          {c.aeUrl && (
            <a href={c.aeUrl} target="_blank" className="text-xs text-brand-600">
              {c.aeTitle || c.aeUrl} ↗
            </a>
          )}
          {c.rejectionReason && <p className="mt-1 text-xs text-red-600">{c.rejectionReason}</p>}
        </Card>
      ))}
    </div>
  );
}
