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
    let utmSource: string | undefined;
    try {
      utmSource = new URLSearchParams(window.location.search).get("utm_source") || undefined;
    } catch {
      /* ignore */
    }
    const payload = JSON.stringify({
      productId,
      type,
      referrer: document.referrer || undefined,
      utmSource,
    });
    try {
      // fetch (not sendBeacon) so the Set-Cookie for the session id is applied
      fetch("/api/track", {
        method: "POST",
        body: payload,
        headers: { "content-type": "application/json" },
        keepalive: true,
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }
  }, [productId, type]);
  return null;
}
