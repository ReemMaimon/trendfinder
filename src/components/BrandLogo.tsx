"use client";

import { useState } from "react";

/**
 * Site logo — renders /public/logo.svg. If you have an exact brand PNG, save it
 * as /public/logo.png and change LOGO_SRC below (or ask to have it switched).
 * Falls back to a text wordmark if the file can't load, so the site is never
 * visually broken.
 */
const LOGO_SRC = "/logo.svg";

export function BrandLogo({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={
          variant === "hero"
            ? "text-xl font-extrabold tracking-tight text-brand-600"
            : "text-base font-extrabold tracking-tight text-brand-600"
        }
      >
        TrendFinder
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="TrendFinder"
      onError={() => setFailed(true)}
      className={
        variant === "hero"
          ? "mx-auto w-full max-w-[160px] rounded-3xl shadow-card"
          : "h-9 w-9 rounded-xl"
      }
    />
  );
}
