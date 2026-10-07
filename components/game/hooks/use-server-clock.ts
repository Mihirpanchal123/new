"use client";

import { useSyncExternalStore } from "react";
import { useGameStore } from "@/stores/game-store";

/**
 * One shared 100ms ticker for every countdown on screen. It only runs while
 * something is subscribed.
 */
const TICK_MS = 100;
// Seeded at load so the very first render is close to correct (refreshed on subscribe).
let current = typeof window === "undefined" ? 0 : Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const subscribers = new Set<() => void>();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  current = Date.now();
  timer ??= setInterval(() => {
    current = Date.now();
    for (const fn of subscribers) fn();
  }, TICK_MS);
  cb();
  return () => {
    subscribers.delete(cb);
    if (!subscribers.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => 0;

/** Local wall clock, refreshed every 100ms. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Milliseconds until `endsAt` on the SERVER's clock. Display only — the
 * server decides when time is actually up.
 */
export function useCountdown(endsAt: number | null | undefined): number {
  const offset = useGameStore((s) => s.clockOffset);
  const now = useNow();
  if (!endsAt || !now) return 0;
  return Math.max(0, endsAt - (now + offset));
}
