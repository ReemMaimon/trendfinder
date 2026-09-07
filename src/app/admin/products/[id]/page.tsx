"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi, Card, ErrorText, apiSend } from "@/components/admin/ui";
import { CATEGORIES } from "@/config/categories";

const NUM_FIELDS = [
  ["viralPotentialScore", "ויראלי"],
  ["affiliatePotentialScore", "שותפים"],
  ["noveltyScore", "חדשנות"],
  ["trendMomentumScore", "מומנטום"],
  ["saturationScore", "רוויה"],
  ["overallScore", "ציון כולל"],
] as const;

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading } = useApi<any>(`/api/admin/products/${id}`);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.product) {
      const p = data.product;
      setForm({
        trendTitle: p.trendTitle,
        trendDescription: p.trendDescription,
        category: p.category,
        aeTitle: p.aeTitle,
        aeDescription: p.aeDescription ?? "",
        aeUrl: p.aeUrl,
        aeImages: (p.aeImages ?? []).join("\n"),
        aeRating: p.aeRating ?? "",
        aeOrders: p.aeOrders ?? "",
        aeStoreName: p.aeStoreName ?? "",
        priceOriginal: p.priceOriginal ?? "",
        currencyOriginal: p.currencyOriginal ?? "",
        priceShipping: p.priceShipping ?? "",
        shippingVerified: p.shippingVerified,
        explanationHe: p.explanationHe,
        viralPotentialScore: p.viralPotentialScore,
        affiliatePotentialScore: p.affiliatePotentialScore,
        noveltyScore: p.noveltyScore,
        trendMomentumScore: p.trendMomentumScore,
        saturationScore: p.saturationScore,
        overallScore: p.overallScore,
      });
    }
  }, [data]);

  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!form) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const payload: any = {
        ...form,
        aeImages: form.aeImages.split(/\s*\n\s*/).filter(Boolean),
        aeRating: form.aeRating === "" ? null : Number(form.aeRating),
        aeOrders: form.aeOrders === "" ? null : Number(form.aeOrders),
        priceOriginal: form.priceOriginal === "" ? null : Number(form.priceOriginal),
        priceShipping: form.priceShipping === "" ? null : Number(form.priceShipping),
        currencyOriginal: form.currencyOriginal || null,
        aeStoreName: form.aeStoreName || null,
        aeDescription: form.aeDescription || null,
      };
      for (const [k] of NUM_FIELDS) payload[k] = Number(form[k]);
      await apiSend(`/api/admin/products/${id}`, "PATCH", payload);
      setMsg("נשמר ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את המוצר? הוא יוסר גם מכל הסטים היומיים.")) return;
    await apiSend(`/api/admin/products/${id}`, "DELETE");
    router.push("/admin/products");
  }

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <Card title="עריכת מוצר" actions={<button onClick={remove} className="text-sm text-red-600">מחיקה</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>כותרת טרנד<input className={input} value={form.trendTitle} onChange={(e) => set("trendTitle", e.target.value)} /></label>
          <label>
            קטגוריה
            <select className={input} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">תיאור טרנד<textarea className={input} rows={2} value={form.trendDescription} onChange={(e) => set("trendDescription", e.target.value)} /></label>
          <label>כותרת AliExpress<input className={input} value={form.aeTitle} onChange={(e) => set("aeTitle", e.target.value)} /></label>
          <label>URL של AliExpress<input className={input} value={form.aeUrl} onChange={(e) => set("aeUrl", e.target.value)} /></label>
          <label className="sm:col-span-2">תמונות (שורה לכל URL)<textarea className={input} rows={3} value={form.aeImages} onChange={(e) => set("aeImages", e.target.value)} /></label>
          <label className="sm:col-span-2">תיאור מוצר<textarea className={input} rows={3} value={form.aeDescription} onChange={(e) => set("aeDescription", e.target.value)} /></label>
          <label>דירוג<input className={input} value={form.aeRating} onChange={(e) => set("aeRating", e.target.value)} /></label>
          <label>הזמנות<input className={input} value={form.aeOrders} onChange={(e) => set("aeOrders", e.target.value)} /></label>
          <label>חנות<input className={input} value={form.aeStoreName} onChange={(e) => set("aeStoreName", e.target.value)} /></label>
          <label>מחיר מקור<input className={input} value={form.priceOriginal} onChange={(e) => set("priceOriginal", e.target.value)} /></label>
          <label>מטבע מקור<input className={input} value={form.currencyOriginal} onChange={(e) => set("currencyOriginal", e.target.value)} placeholder="USD" /></label>
          <label>מחיר משלוח<input className={input} value={form.priceShipping} onChange={(e) => set("priceShipping", e.target.value)} /></label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.shippingVerified} onChange={(e) => set("shippingVerified", e.target.checked)} />
            משלוח מאומת
          </label>
          <label className="sm:col-span-2">הסבר בעברית<textarea className={input} rows={3} value={form.explanationHe} onChange={(e) => set("explanationHe", e.target.value)} /></label>
        </div>
      </Card>

      <Card title="ציונים">
        <div className="grid grid-cols-3 gap-3">
          {NUM_FIELDS.map(([k, label]) => (
            <label key={k} className="text-sm">
              {label}
              <input className={input} type="number" min={0} max={100} value={form[k]} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
        </div>
      </Card>

      {msg && <ErrorText>{msg}</ErrorText>}
      <button onClick={save} disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {busy ? "שומר…" : "שמירה"}
      </button>

      <Card title="נתוני מקור ומהימנות">
        <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(data.product.dataConfidence, null, 2)}</pre>
        <div className="mt-2 text-xs text-gray-500">
          צפיות: {data.product._count?.views ?? 0} · קליקים: {data.product._count?.clicks ?? 0}
        </div>
      </Card>
    </div>
  );
}
