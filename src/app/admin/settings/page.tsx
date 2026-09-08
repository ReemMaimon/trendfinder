"use client";

import { useEffect, useState } from "react";
import { useApi, Card, ErrorText, apiSend } from "@/components/admin/ui";

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/settings");
  const [draft, setDraft] = useState<any>(null);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setDraft(data.settings);
      setRaw(JSON.stringify(data.settings, null, 2));
    }
  }, [data]);

  if (loading && !data) return <p>טוען…</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!draft) return null;

  const setW = (k: string, v: number) => setDraft((d: any) => ({ ...d, scoringWeights: { ...d.scoringWeights, [k]: v } }));
  const setD = (k: string, v: any) => setDraft((d: any) => ({ ...d, diversityRules: { ...d.diversityRules, [k]: v } }));
  const setTop = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  async function save(payload: any) {
    setBusy(true);
    setMsg(null);
    try {
      await apiSend("/api/admin/settings", "PUT", payload);
      setMsg("נשמר ✓");
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="הוראות מחקר ל-AI">
        <textarea
          className={input}
          rows={10}
          value={draft.researchInstructions}
          onChange={(e) => setTop("researchInstructions", e.target.value)}
        />
        <label className="mt-2 block text-sm">
          גרסת prompt
          <input className={input} value={draft.promptVersion} onChange={(e) => setTop("promptVersion", e.target.value)} />
        </label>
      </Card>

      <Card title="תבניות חיפוש AliExpress (שורה לכל תבנית)">
        <textarea
          className={input}
          rows={5}
          value={draft.aliexpressSearchTemplates.join("\n")}
          onChange={(e) => setTop("aliexpressSearchTemplates", e.target.value.split(/\s*\n\s*/).filter(Boolean))}
        />
        <p className="mt-1 text-xs text-gray-500">{"נתמכים placeholders: {keyword} , {trendKeyword}"}</p>
      </Card>

      <Card title="פרמטרים של הפייפליין">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="text-sm">מקס' מועמדים<input type="number" className={input} value={draft.maxCandidates} onChange={(e) => setTop("maxCandidates", Number(e.target.value))} /></label>
          <label className="text-sm">ציון כולל מינ'<input type="number" className={input} value={draft.minOverallScore} onChange={(e) => setTop("minOverallScore", Number(e.target.value))} /></label>
          <label className="text-sm">רוויה מקס'<input type="number" className={input} value={draft.maxSaturationScore} onChange={(e) => setTop("maxSaturationScore", Number(e.target.value))} /></label>
          <label className="text-sm">ימי fallback (0-3)<input type="number" className={input} value={draft.fallbackLookbackDays} onChange={(e) => setTop("fallbackLookbackDays", Number(e.target.value))} /></label>
          <label className="text-sm">
            מחיר מקסימלי למוצר (₪)
            <input
              type="number"
              min={0}
              step="1"
              placeholder="ללא הגבלה"
              className={input}
              value={draft.maxProductPriceIls ?? ""}
              onChange={(e) =>
                setTop("maxProductPriceIls", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          מחיר מקסימלי בשקלים. ריק = ללא הגבלה. התקציב נשלח ל-AI, מסנן את חיפוש AliExpress, וכל מוצר יקר יותר נדחה.
        </p>
      </Card>

      <Card title="משקלי ניקוד">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(draft.scoringWeights).map(([k, v]) => (
            <label key={k} className="text-sm">
              {k}
              <input type="number" step="0.1" className={input} value={v as number} onChange={(e) => setW(k, Number(e.target.value))} />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          ציון כולל = (ויראלי·w + שותפים·w + מומנטום·w + חדשנות·w − רוויה·penalty) מנורמל ל-0..100
        </p>
      </Card>

      <Card title="כללי גיוון">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.diversityRules.enforceDistinctCategories} onChange={(e) => setD("enforceDistinctCategories", e.target.checked)} />
            אכיפת קטגוריות שונות
          </label>
          <label className="text-sm">דמיון כותרת מקס' (0-1)<input type="number" step="0.05" className={input} value={draft.diversityRules.maxTitleSimilarity} onChange={(e) => setD("maxTitleSimilarity", Number(e.target.value))} /></label>
          <label className="text-sm">ימי היסטוריה<input type="number" className={input} value={draft.diversityRules.historyLookbackDays} onChange={(e) => setD("historyLookbackDays", Number(e.target.value))} /></label>
          <label className="text-sm">דמיון היסטוריה מקס' (0-1)<input type="number" step="0.05" className={input} value={draft.diversityRules.maxHistorySimilarity} onChange={(e) => setD("maxHistorySimilarity", Number(e.target.value))} /></label>
        </div>
      </Card>

      {msg && <ErrorText>{msg}</ErrorText>}
      <button onClick={() => save(draft)} disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {busy ? "שומר…" : "שמירת כל ההגדרות"}
      </button>

      <Card title="JSON גולמי (מתקדם)">
        <textarea className={input} rows={12} value={raw} onChange={(e) => setRaw(e.target.value)} />
        <button
          onClick={() => {
            try {
              save(JSON.parse(raw));
            } catch {
              setMsg("JSON לא תקין");
            }
          }}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          שמירת JSON
        </button>
      </Card>
    </div>
  );
}
