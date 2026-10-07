"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WordCardView, WordStatus } from "@/types/game";
import { WordCard, type Celebration } from "../game/word-chain";

const CHAIN = ["coffee", "bean", "plant", "farm", "market"];

interface Frame {
  active: number;
  revealed: number[];
  status: WordStatus[];
  points: number[];
  input: string;
  note?: { tone: "danger" | "success" | "hint"; text: string };
  celebrate?: number;
  shake?: boolean;
  ms: number;
}

/** A scripted mini-match that loops on the home page. */
function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  let revealed = [6, 1, 1, 1, 1];
  let status: WordStatus[] = ["GIVEN", "ACTIVE", "LOCKED", "LOCKED", "LOCKED"];
  let points = [0, 0, 0, 0, 0];
  const push = (f: Partial<Frame> & { ms: number }) =>
    frames.push({ active: 1, revealed: [...revealed], status: [...status], points: [...points], input: "", ...f });
  const type = (word: string, active: number) => {
    for (let i = 1; i <= word.length; i++) push({ active, input: word.slice(0, i).toUpperCase(), ms: 150 });
  };
  const solve = (pos: number, pts: number) => {
    revealed = revealed.map((r, i) => (i === pos ? CHAIN[pos]!.length : r));
    status = status.map((s, i) => (i === pos ? "SOLVED" : i === pos + 1 ? "ACTIVE" : s));
    points = points.map((p, i) => (i === pos ? pts : p));
    push({ active: pos + 1, celebrate: pos, note: { tone: "success", text: `Correct! +${pts}` }, ms: 1300 });
  };
  const hint = (pos: number) => {
    revealed = revealed.map((r, i) => (i === pos ? r + 1 : r));
    push({ active: pos, note: { tone: "hint", text: "Hint used · −25" }, ms: 900 });
  };

  push({ ms: 900 });
  type("bean", 1);
  solve(1, 100);
  type("plan", 2);
  push({ active: 2, input: "PLAN", shake: true, note: { tone: "danger", text: "Not quite!" }, ms: 900 });
  hint(2);
  type("plant", 2);
  solve(2, 70);
  type("farm", 3);
  solve(3, 98);
  hint(4);
  hint(4);
  type("market", 4);
  solve(4, 50);
  push({ active: 5, ms: 2200 });
  return frames;
}

const FRAMES = buildFrames();

export function GameplayPreview({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const frame = FRAMES[reduce ? 0 : i]!;

  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(() => setI((n) => (n + 1) % FRAMES.length), frame.ms);
    return () => window.clearTimeout(id);
  }, [i, frame.ms, reduce]);

  const cards: WordCardView[] = CHAIN.map((w, pos) => ({
    position: pos,
    length: w.length,
    letters: Array.from(w.toUpperCase(), (ch, k) => (k < frame.revealed[pos]! ? ch : null)),
    revealedCount: frame.revealed[pos]!,
    status: frame.status[pos]!,
    hintsUsed: frame.revealed[pos]! - 1,
    wrongGuesses: 0,
    points: frame.points[pos]!,
  }));
  const celebration: Celebration | null = frame.celebrate !== undefined ? { key: i, position: frame.celebrate, points: frame.points[frame.celebrate]! } : null;

  return (
    <div
      aria-label="Animated example: a player guesses the chain coffee, bean, plant, farm, market"
      role="img"
      className={cn("relative w-full max-w-sm rounded-[1.75rem] border border-border bg-surface p-3 shadow-pop sm:p-4", className)}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted">Alex&apos;s chain</span>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-extrabold text-brand">
          Round {Math.min(frame.active, 4)}/4
        </span>
      </div>
      <div className="flex flex-col gap-1.5" aria-hidden>
        {cards.map((c) => (
          <WordCard key={c.position} card={c} active={c.position === frame.active} celebration={celebration} shakeKey={frame.shake ? i : 0} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2" aria-hidden>
        <div
          className={cn(
            "flex h-12 flex-1 items-center rounded-2xl border-2 bg-surface-2 px-4 font-display text-lg font-bold tracking-[0.12em]",
            frame.note?.tone === "danger" ? "border-danger" : "border-border",
          )}
        >
          {frame.input}
          <motion.span className="ml-0.5 h-6 w-0.5 bg-brand" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
        </div>
        <div className="grid h-12 w-16 place-items-center rounded-2xl bg-brand font-display font-semibold text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)]">
          Go
        </div>
      </div>
      <div className="h-6 pt-1.5 text-center text-sm font-bold" aria-hidden>
        <AnimatePresence mode="wait">
          {frame.note && (
            <motion.span
              key={`${i}-${frame.note.text}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                frame.note.tone === "danger" && "text-danger",
                frame.note.tone === "success" && "text-success",
                frame.note.tone === "hint" && "text-hint dark:text-hint-bright",
              )}
            >
              {frame.note.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
