"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { haptics } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { useCountdown } from "./hooks/use-server-clock";

/** "3, 2, 1, DUEL!" synced to the server's countdown deadline. */
export function CountdownOverlay({ endsAt, totalMs, finalWord = "DUEL!" }: { endsAt: number; totalMs: number; finalWord?: string }) {
  const left = useCountdown(endsAt);
  const step = totalMs / 4;
  const label = left > step * 3 ? "3" : left > step * 2 ? "2" : left > step ? "1" : finalWord;

  const last = useRef<string | null>(null);
  useEffect(() => {
    if (label === last.current) return;
    last.current = label;
    if (label === finalWord) {
      sound.playGo();
      haptics.correct();
    } else {
      sound.playCountdown();
      haptics.tap();
    }
  }, [label, finalWord]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/85 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alert"
      aria-live="assertive"
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={label}
          initial={{ scale: 2.2, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          className={
            label === finalWord
              ? "font-display text-7xl font-bold text-brand drop-shadow-[0_8px_30px_var(--brand)] sm:text-8xl"
              : "font-display text-9xl font-bold tabular text-ink"
          }
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

/** Short client-only flourish (e.g. both ready in the lobby). */
export function FlashBanner({ text }: { text: string }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="rounded-[2rem] bg-brand px-10 py-5 font-display text-5xl font-bold text-brand-ink shadow-pop"
      >
        {text}
      </motion.span>
    </motion.div>
  );
}
