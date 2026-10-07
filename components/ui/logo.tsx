import { cn } from "@/lib/utils";

/** Two crossed letter tiles — "W" and "D" — dueling. Original mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9", className)} aria-hidden>
      <g transform="rotate(-12 18 24)">
        <rect x="4" y="9" width="26" height="30" rx="7" fill="var(--brand)" />
        <rect x="4" y="9" width="26" height="26" rx="7" fill="color-mix(in oklab, var(--brand) 82%, white)" />
        <text x="17" y="29.5" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="17" fill="#fff">
          W
        </text>
      </g>
      <g transform="rotate(12 30 24)">
        <rect x="18" y="9" width="26" height="30" rx="7" fill="#e0942a" />
        <rect x="18" y="9" width="26" height="26" rx="7" fill="#ffc247" />
        <text x="31" y="29.5" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="17" fill="#2a1a00">
          D
        </text>
      </g>
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && <span className="font-display text-xl font-bold tracking-tight">Word Duel</span>}
    </span>
  );
}
