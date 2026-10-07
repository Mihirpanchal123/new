"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-4xl font-semibold">Something went sideways</h1>
      <p className="text-muted">An unexpected error occurred. Your game is safe on the server — try again.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="h-12 rounded-2xl bg-brand px-6 font-display font-semibold text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)]"
        >
          Try again
        </button>
        <Link href="/" className="grid h-12 place-items-center rounded-2xl border-2 border-border px-6 font-display font-semibold">
          Home
        </Link>
      </div>
    </main>
  );
}
