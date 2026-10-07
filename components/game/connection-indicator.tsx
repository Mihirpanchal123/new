"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useGameStore, type ConnectionStatus } from "@/stores/game-store";

const LABELS: Record<ConnectionStatus, string> = {
  online: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

/** Subtle when healthy; prominent only when something's wrong. */
export function ConnectionIndicator({ className }: { className?: string }) {
  const status = useGameStore((s) => s.connection);
  const healthy = status === "online";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold transition-colors",
        healthy ? "text-muted" : status === "offline" ? "bg-danger-soft text-danger" : "bg-hint-soft text-hint dark:text-hint-bright",
        className,
      )}
    >
      <span className="relative flex size-2.5">
        {!healthy && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />}
        <span className={cn("relative size-2.5 rounded-full", healthy ? "bg-success" : "bg-current")} />
      </span>
      <span className={cn(healthy && "sr-only sm:not-sr-only")}>{LABELS[status]}</span>
    </div>
  );
}

/** Full-width strip when our own connection is interrupted mid-game. */
export function ConnectionBanner() {
  const status = useGameStore((s) => s.connection);
  const show = status === "reconnecting" || status === "offline";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            role="alert"
            className={cn(
              "px-4 py-2 text-center text-sm font-bold",
              status === "offline" ? "bg-danger text-white" : "bg-hint-bright text-[#2a1a00]",
            )}
          >
            {status === "offline" ? "You're offline — we'll reconnect when you're back." : "Connection interrupted — reconnecting…"}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
