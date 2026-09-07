"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "לוח בקרה" },
  { href: "/admin/today", label: "המוצרים של היום" },
  { href: "/admin/history", label: "היסטוריה" },
  { href: "/admin/runs", label: "ריצות AI" },
  { href: "/admin/candidates", label: "מועמדים" },
  { href: "/admin/sources", label: "מקורות" },
  { href: "/admin/products", label: "מוצרים" },
  { href: "/admin/analytics", label: "אנליטיקה" },
  { href: "/admin/settings", label: "הגדרות" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 font-semibold ${
              active ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
