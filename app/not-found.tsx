import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="size-16" />
      <h1 className="font-display text-4xl font-semibold">Lost the thread</h1>
      <p className="text-muted">That page isn&apos;t part of any chain we know.</p>
      <Link
        href="/"
        className="inline-flex h-14 items-center rounded-2xl bg-brand px-8 font-display text-lg font-semibold text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)]"
      >
        Back home
      </Link>
    </main>
  );
}
