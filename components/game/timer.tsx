"use client";

import { Infinity as InfinityIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { DEFAULT_TIMINGS } from "@/constants/game";
import { haptics } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { cn, formatClock } from "@/lib/utils";
import type { WordCardView } from "@/types/game";
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
  untimed,
  className,
}: {
  endsAt: number | null;
  durationMs: number;
  paused?: boolean;
  audible?: boolean;
  /** The game has no turn timer: show an infinity badge instead of a countdown. */
  untimed?: boolean;
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

  if (untimed) {
    return (
      <div
        className={cn("grid size-[3.75rem] shrink-0 place-items-center rounded-full border-[5px] border-surface-3 bg-surface text-muted", className)}
        role="timer"
        aria-label="No time limit"
        title="No time limit"
      >
        <InfinityIcon className="size-6" aria-hidden />
      </div>
    );
  }

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

export const solvedCount = (cards: WordCardView[]) => cards.filter((c) => c.status === "SOLVED").length;

export interface Racer {
  name: string;
  solved: number;
}

/** Who's closer to cracking the whole chain. First to `total` wins. */
export function RaceProgress({ racers, total }: { racers: Racer[]; total: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" aria-label="Words cracked">
      {racers.map((r) => (
        <div key={r.name} className="flex min-w-0 items-center gap-2 text-xs font-bold">
          <span className="w-16 truncate text-muted sm:w-20">{r.name}</span>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <motion.span
                key={i}
                className="h-1.5 w-4 rounded-full sm:w-5"
                animate={{ backgroundColor: i < r.solved ? "var(--success)" : "var(--surface-3)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            ))}
          </div>
          <span className="tabular text-ink">
            {r.solved}
            <span className="text-muted/70">/{total}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
