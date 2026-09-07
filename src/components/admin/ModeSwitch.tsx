"use client";

import { useState } from "react";
import { apiSend } from "./ui";

export function ModeSwitch({ current, onChanged }: { current: "TEST" | "PRODUCTION"; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = current === "TEST" ? "PRODUCTION" : "TEST";

  async function switchMode() {
    if (!confirm(`להעביר את מצב האפליקציה ל-${target}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/admin/mode", "POST", { mode: target });
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={switchMode}
        disabled={busy}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
      >
        מעבר ל-{target}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
