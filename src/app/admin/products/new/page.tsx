"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, ErrorText, apiSend } from "@/components/admin/ui";
import { CATEGORIES } from "@/config/categories";

export default function NewProductPage() {
  const router = useRouter();
  const [f, setF] = useState<any>({
    trendTitle: "",
    trendDescription: "",
    category: "Gadgets",
    aeTitle: "",
    aeUrl: "",
    aeImages: "",
    aeRating: "",
    aeOrders: "",
    priceOriginal: "",
    currencyOriginal: "USD",
    explanationHe: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const json = await apiSend("/api/admin/products", "POST", {
        trendTitle: f.trendTitle,
        trendDescription: f.trendDescription,
        category: f.category,
        aeTitle: f.aeTitle,
        aeUrl: f.aeUrl,
        aeImages: f.aeImages.split(/\s*\n\s*/).filter(Boolean),
        aeRating: f.aeRating === "" ? null : Number(f.aeRating),
        aeOrders: f.aeOrders === "" ? null : Number(f.aeOrders),
        priceOriginal: f.priceOriginal === "" ? null : Number(f.priceOriginal),
        currencyOriginal: f.currencyOriginal || null,
        explanationHe: f.explanationHe,
      });
      router.push(`/admin/products/${json.product.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="הוספת מוצר ידנית">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>כותרת טרנד<input className={input} value={f.trendTitle} onChange={(e) => set("trendTitle", e.target.value)} /></label>
        <label>
          קטגוריה
          <select className={input} value={f.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">תיאור טרנד<textarea className={input} rows={2} value={f.trendDescription} onChange={(e) => set("trendDescription", e.target.value)} /></label>
        <label>כותרת AliExpress<input className={input} value={f.aeTitle} onChange={(e) => set("aeTitle", e.target.value)} /></label>
        <label>URL של AliExpress<input className={input} value={f.aeUrl} onChange={(e) => set("aeUrl", e.target.value)} /></label>
        <label className="sm:col-span-2">תמונות (שורה לכל URL)<textarea className={input} rows={3} value={f.aeImages} onChange={(e) => set("aeImages", e.target.value)} /></label>
        <label>דירוג<input className={input} value={f.aeRating} onChange={(e) => set("aeRating", e.target.value)} /></label>
        <label>הזמנות<input className={input} value={f.aeOrders} onChange={(e) => set("aeOrders", e.target.value)} /></label>
        <label>מחיר מקור<input className={input} value={f.priceOriginal} onChange={(e) => set("priceOriginal", e.target.value)} /></label>
        <label>מטבע מקור<input className={input} value={f.currencyOriginal} onChange={(e) => set("currencyOriginal", e.target.value)} /></label>
        <label className="sm:col-span-2">הסבר בעברית<textarea className={input} rows={3} value={f.explanationHe} onChange={(e) => set("explanationHe", e.target.value)} /></label>
      </div>
      {msg && <div className="mt-2"><ErrorText>{msg}</ErrorText></div>}
      <button onClick={create} disabled={busy} className="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {busy ? "יוצר…" : "יצירה"}
      </button>
    </Card>
  );
}
