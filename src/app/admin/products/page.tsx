"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, Card, Badge, ErrorText } from "@/components/admin/ui";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const { data, error, loading } = useApi<any>(`/api/admin/products?q=${encodeURIComponent(q)}&limit=100`, [q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          placeholder="חיפוש…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2"
        />
        <Link href="/admin/products/new" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white">
          הוספת מוצר ידנית
        </Link>
      </div>

      {loading && !data && <p>טוען…</p>}
      {error && <ErrorText>{error}</ErrorText>}

      {data?.products?.map((p: any) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={`/admin/products/${p.id}`} className="font-bold text-brand-700">
                {p.trendTitle}
              </Link>
              <div className="text-sm text-gray-500">{p.aeTitle}</div>
              <div className="mt-1 text-xs text-gray-500">
                {p.category} · ציון {p.overallScore} · {p.origin}
                {p.priceIls != null ? ` · ₪${p.priceIls}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.dailyItems?.map((di: any) => (
                  <Badge key={di.id} tone="blue">
                    {di.set.date} #{di.position}
                  </Badge>
                ))}
              </div>
            </div>
            {p.aeImages?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.aeImages[0]} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
