"use client";

import { useState } from "react";

export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [];

  if (!list.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-brand-100 text-brand-400">
        אין תמונה זמינה
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={list[active]}
          alt={alt}
          className="aspect-square w-full object-contain"
          loading="eager"
        />
      </div>
      {list.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {list.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                i === active ? "border-brand-500" : "border-transparent"
              }`}
              aria-label={`תמונה ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
