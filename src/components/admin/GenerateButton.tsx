"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiSend } from "./ui";

interface RunLite {
  id: string;
  status: string;
  targetDate: string;
  summary?: string | null;
  stats?: any;
  errorLog?: any;
  candidates?: { id: string; order: number; trendTitle: string; status: string; rejectionReason?: string | null }[];
}

export function GenerateButton({ targetDate, onDone }: { targetDate?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<RunLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPoll, []);

  const refresh = useCallback(async (date: string) => {
    const res = await fetch(`/api/admin/runs?date=${date}&limit=1&candidates=1`, { cache: "no-store" });
    const json = await res.json();
    const latest: RunLite | undefined = json.runs?.[0];
    if (latest) {
      setRun(latest);
      if (latest.status !== "RUNNING") {
        setBusy(false);
        stopPoll();
        onDone?.();
      }
    }
  }, [onDone]);

  async function start() {
    setBusy(true);
    setError(null);
    setRun(null);
    try {
      const json = await apiSend("/api/admin/generate", "POST", { targetDate, force });
      const date = json.targetDate ?? targetDate;
      stopPoll();
      poll.current = setInterval(() => refresh(date), 2500);
      refresh(date);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-60"
        >
          {busy ? "רץ..." : "הפקת המוצרים של היום"}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          החלף סט קיים (force)
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {run && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="font-bold">
            סטטוס ריצה: {run.status}{" "}
            {run.stats ? `· ${run.stats.accepted ?? 0} חדשים / ${run.stats.fallbackUsed ?? 0} חוזרים` : ""}
          </div>
          {run.summary && <div className="mt-1 text-gray-600">{run.summary}</div>}
          {run.candidates && run.candidates.length > 0 && (
            <ul className="mt-2 space-y-1">
              {run.candidates.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <span className="text-gray-700">
                    #{c.order} {c.trendTitle}
                  </span>
                  <span
                    className={
                      c.status === "ACCEPTED"
                        ? "font-bold text-emerald-600"
                        : "text-gray-500"
                    }
                  >
                    {c.status === "ACCEPTED" ? "התקבל" : c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {Array.isArray(run.errorLog) && run.errorLog.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-amber-700">שגיאות ({run.errorLog.length})</summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                {JSON.stringify(run.errorLog, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
