import type { ReactNode } from "react";

export function Prose({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-4xl font-semibold">{title}</h1>
      {updated && <p className="mt-2 text-sm font-semibold text-muted">Last updated {updated}</p>}
      <div className="mt-8 flex flex-col gap-4 leading-relaxed text-ink-2 [&_a]:font-bold [&_a]:text-brand [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
