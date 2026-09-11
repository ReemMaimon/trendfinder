"use client";

import { useEffect, useState } from "react";

/**
 * Welcome popup shown when a visitor enters the site. It invites them to join
 * the TrendFinder WhatsApp channel for alerts on the best products of the day.
 *
 * By default it appears on every full page load / refresh / fresh entry, but NOT
 * on internal client-side navigation (this component only mounts once per page
 * load). To show it at most once per browser session instead, set
 * REMEMBER_DISMISS = true.
 */
const REMEMBER_DISMISS = false;
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb9Uic53rZZbNaxlcd2I";
const SESSION_KEY = "tf_welcome_seen";
const LOGO_SRC = "/logo.svg";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // never on the admin area
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return;
    if (!REMEMBER_DISMISS) {
      setOpen(true);
      return;
    }
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function close() {
    if (REMEMBER_DISMISS) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="הצטרפות לערוץ הוואטסאפ של TrendFinder"
      onClick={close}
    >
      <div
        className="relative my-auto w-full max-w-xs rounded-3xl bg-[#0b1020] p-6 text-center text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="סגירה"
          className="absolute left-4 top-4 rounded-full bg-white/10 px-2 py-0.5 text-sm font-bold text-white/70"
        >
          ✕
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="TrendFinder" className="mx-auto w-36 rounded-2xl" />

        <h2 className="mt-4 text-lg font-extrabold">רוצים לדעת ראשונים?</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          הצטרפו לערוץ הוואטסאפ שלנו וקבלו כל יום התראה על המוצרים הכי חמים —
          לפני שכולם מדברים עליהם.
        </p>

        <a
          href={WHATSAPP_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-base font-bold text-white transition active:scale-[0.98]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M.06 24l1.68-6.13A11.9 11.9 0 0 1 .13 11.9C.13 5.33 5.46 0 12.03 0a11.8 11.8 0 0 1 8.41 3.49 11.8 11.8 0 0 1 3.48 8.42c0 6.57-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.68-1.45L.06 24zM6.6 20.2c1.68 1 3.28 1.6 5.42 1.6 5.46 0 9.9-4.44 9.9-9.9 0-5.45-4.44-9.89-9.9-9.89S2.14 6.45 2.14 11.9c0 2.25.66 3.93 1.76 5.7l-1 3.62 3.7-.98zM17.9 14.7c-.07-.12-.27-.2-.56-.34-.3-.15-1.75-.87-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.34.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.57-.48-.5-.66-.5l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.47 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.4.24-.7.24-1.28.17-1.4z"/>
          </svg>
          הצטרפות לערוץ הוואטסאפ
        </a>

        <button onClick={close} className="mt-2 w-full py-2 text-sm font-semibold text-white/50">
          המשך לאתר
        </button>
      </div>
    </div>
  );
}
