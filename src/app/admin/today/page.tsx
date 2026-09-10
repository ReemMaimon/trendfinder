"use client";

import { useApi, Card, Badge, ErrorText, apiSend } from "@/components/admin/ui";
import { GenerateButton } from "@/components/admin/GenerateButton";
import { useState } from "react";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export default function AdminTodayPage() {
  const [date, setDate] = useState(today());
  const { data, error, loading, reload } = useApi<any>(`/api/admin/sets/${date}`, [date]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(body: any) {
    setBusy(true);
    setMsg(null);
    try {
      await apiSend(`/api/admin/sets/${date}`, "POST", body);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const set = data?.set;

  return (
    <div className="space-y-5">
      <Card title="בחירת תאריך">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
      </Card>

      <Card title="הפקה / הפקה מחדש">
        <GenerateButton targetDate={date} onDone={reload} />
      </Card>

      {loading && !data && <p>טוען…</p>}
      {error && <ErrorText>{error}</ErrorText>}
      {msg && <ErrorText>{msg}</ErrorText>}

      {set && (
        <Card
          title={`סט ${set.date}`}
          actions={
            <div className="flex gap-2">
              <Badge tone={set.status === "PUBLISHED" ? "green" : "amber"}>{set.status}</Badge>
              {set.status === "PUBLISHED" ? (
                <button onClick={() => act({ action: "unpublish" })} disabled={busy} className="text-sm text-gray-600">
                  ביטול פרסום
                </button>
              ) : (
                <button onClick={() => act({ action: "publish" })} disabled={busy} className="text-sm font-bold text-emerald-600">
                  פרסום
                </button>
              )}
            </div>
          }
        >
          <ol className="space-y-3">
            {set.items.map((it: any) => (
              <li key={it.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      #{it.position} {it.product.trendTitle} {it.reused && <Badge tone="amber">חוזר</Badge>}
                    </div>
                    <div className="text-sm text-gray-500">{it.product.aeTitle}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      קטגוריה {it.product.category} · ציון כולל {it.product.overallScore} · רוויה {it.product.saturationScore}
                    </div>
                    <a href={it.product.aeUrl} target="_blank" className="text-xs text-brand-600">
                      דף AliExpress ↗
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 text-sm">
                    <a href={`/admin/products/${it.product.id}`} className="text-brand-600">עריכה</a>
                    <RegenerateControl date={date} position={it.position} onDone={reload} setMsg={setMsg} />
                    <button onClick={() => act({ action: "remove", position: it.position })} className="text-red-600">
                      הסרה
                    </button>
                    <ReplaceControl onReplace={(pid) => act({ action: "replace", position: it.position, newProductId: pid })} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {set.items.length < 3 && (
            <p className="mt-3 text-sm text-amber-700">
              בסט יש {set.items.length} מוצרים בלבד. השתמש ב&quot;החלפה&quot; או בהפקה מחדש כדי להשלים ל-3.
            </p>
          )}
        </Card>
      )}

      {data?.set?.generationRun?.candidates && (
        <Card title="מועמדים בריצה">
          <ul className="space-y-1 text-sm">
            {data.set.generationRun.candidates.map((c: any) => (
              <li key={c.id} className="flex justify-between">
                <span>#{c.order} {c.trendTitle}</span>
                <span className="text-gray-500">
                  {c.status}
                  {c.rejectionReason ? ` — ${c.rejectionReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function RegenerateControl({
  date,
  position,
  onDone,
  setMsg,
}: {
  date: string;
  position: number;
  onDone: () => void;
  setMsg: (m: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm(`להחליף את מוצר #${position} במוצר חדש שה-AI ימצא? (עד ~2 דקות)`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiSend(`/api/admin/sets/${date}/regenerate`, "POST", { position });
      setMsg(res.message || "הוחלף בהצלחה");
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={run} disabled={busy} className="font-semibold text-brand-600 disabled:opacity-50">
      {busy ? "ה-AI מחפש…" : "החלפה עם AI"}
    </button>
  );
}

function ReplaceControl({ onReplace }: { onReplace: (productId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data } = useApi<any>(open ? `/api/admin/products?q=${encodeURIComponent(q)}&limit=15` : null, [open, q]);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-gray-600">
        החלפה
      </button>
    );
  }
  return (
    <div className="w-56 rounded-lg border border-gray-200 bg-white p-2">
      <input
        placeholder="חיפוש מוצר…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border px-2 py-1 text-xs"
      />
      <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
        {data?.products?.map((p: any) => (
          <li key={p.id}>
            <button className="w-full text-right hover:bg-gray-100" onClick={() => { onReplace(p.id); setOpen(false); }}>
              {p.trendTitle}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => setOpen(false)} className="mt-1 text-xs text-gray-400">
        סגירה
      </button>
    </div>
  );
}
