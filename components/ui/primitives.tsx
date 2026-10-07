import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-border bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-2xl border-2 border-border bg-surface-2 px-4 text-base font-semibold text-ink",
          "placeholder:font-medium placeholder:text-muted/70 transition-colors",
          "focus:border-brand focus:bg-surface focus:outline-none",
          invalid && "border-danger/60 focus:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "brand" | "success" | "danger" | "hint" }) {
  const tones = {
    neutral: "bg-surface-3 text-ink-2",
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    hint: "bg-hint-soft text-hint dark:text-hint-bright",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-surface-3/70", className)} />;
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 text-center sm:mb-8">
      {eyebrow && <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h2>
      {children && <p className="mx-auto mt-3 max-w-xl text-muted">{children}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
