import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-mobile flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-3 text-xl font-extrabold text-ink">הדף לא נמצא</h1>
      <p className="mt-1 text-sm text-ink-muted">ייתכן שהמוצר כבר לא מוצג.</p>
      <Link href="/" className="btn-primary mt-5">
        למוצרים של היום
      </Link>
    </main>
  );
}
