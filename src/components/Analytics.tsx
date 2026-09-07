"use client";

import { useEffect, useRef } from "react";

/** Fire-and-forget anonymous view beacon. */
export function TrackView({
  productId,
  type,
}: {
  productId: string;
  type: "view-card" | "view-detail";
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const payload = JSON.stringify({ productId, type });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      /* ignore */
    }
  }, [productId, type]);
  return null;
}
