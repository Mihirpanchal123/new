"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { DEFAULT_TIMINGS } from "@/constants/game";
import { haptics } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { cn, formatClock } from "@/lib/utils";
import { useCountdown } from "./hooks/use-server-clock";

const R = 22;
const CIRC = 2 * Math.PI * R;

/**
 * Countdown ring. Purely a display of the server's deadline: the server
 * enforces time, this just shows it. Ticks during the last 5 seconds only
 * when `audible` (it's my turn).
 */
export function Timer({
  endsAt,
  durationMs,
  paused,
  audible,
  className,
}: {
  endsAt: number | null;
  durationMs: number;
  paused?: boolean;
  audible?: boolean;
  className?: string;
}) {
  const left = useCountdown(paused ? null : endsAt);
  const low = !paused && left > 0 && left <= DEFAULT_TIMINGS.lowTimeMs;
  const fraction = paused ? 1 : Math.max(0, Math.min(1, left / durationMs));
  const seconds = Math.ceil(left / 1000);

  const lastSecond = useRef<number | null>(null);
  useEffect(() => {
    if (!audible || paused || !low || seconds === lastSecond.current) return;
    lastSecond.current = seconds;
    if (seconds === 5) {
      sound.playTimerWarning();
      haptics.warning();
    } else if (seconds > 0) {
      sound.playTick();
    }
  }, [seconds, low, audible, paused]);

  return (
    <motion.div
      className={cn("relative grid size-[3.75rem] shrink-0 place-items-center", className)}
      animate={low ? { scale: [1, 1.07, 1] } : { scale: 1 }}
      transition={low ? { duration: 1, repeat: Infinity } : undefined}
      role="timer"
      aria-label={paused ? "Timer paused" : `${seconds} seconds left`}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={R} fill="var(--surface)" stroke="var(--surface-3)" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          stroke={low ? "var(--danger)" : "var(--brand)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className={cn("relative font-display text-[15px] font-bold tabular", low ? "text-danger" : "text-ink")}>
        {paused ? "—" : formatClock(left)}
      </span>
    </motion.div>
  );
}

export function RoundIndicator({ round, total }: { round: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted">
        Round <span className="text-ink tabular">{round}</span>
        <span className="text-muted/70"> / {total}</span>
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className="h-1.5 rounded-full"
            animate={{
              width: i + 1 === round ? 22 : 8,
              backgroundColor: i + 1 <= round ? "var(--brand)" : "var(--surface-3)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        ))}
      </div>
    </div>
  );
}
