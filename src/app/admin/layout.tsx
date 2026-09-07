import Link from "next/link";
import { getSession } from "@/lib/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Unauthenticated: render bare (this is the login page; middleware keeps every
  // other /admin route from reaching here without a session).
  if (!session) {
    return <div dir="rtl" className="min-h-screen bg-gray-100">{children}</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-lg font-extrabold text-brand-700">
            TrendFinder · ניהול
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{session.username}</span>
            <Link href="/" className="text-brand-600" target="_blank">
              צפייה באתר ↗
            </Link>
            <LogoutButton />
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
