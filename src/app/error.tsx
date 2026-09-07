"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main dir="rtl" className="container-mobile flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="text-5xl">😕</div>
      <h1 className="mt-3 text-xl font-extrabold text-ink">משהו השתבש</h1>
      <p className="mt-1 text-sm text-ink-muted">נסו לרענן את הדף בעוד רגע.</p>
      <button onClick={reset} className="btn-primary mt-5">
        רענון
      </button>
    </main>
  );
}
