"use client";

import { ArrowLeft, ArrowRight, Check, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SCORING } from "@/constants/scoring";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";

const CHAIN = ["COFFEE", "BEAN", "PLANT", "FARM", "MARKET"];

function useTicker(length: number, ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => (v + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [length, ms]);
  return n;
}

function Tiles({ word, shown, tone = "plain" }: { word: string; shown: number; tone?: "plain" | "success" }) {
  return (
    <div className="flex gap-1">
      {word.split("").map((ch, i) => (
        <motion.span
          key={`${i}-${i < shown}`}
          initial={i < shown && i > 0 ? { rotateX: -90 } : false}
          animate={{ rotateX: 0 }}
          className={cn(
            "grid size-8 place-items-center rounded-lg border-2 font-display text-sm font-bold sm:size-9 sm:text-base",
            tone === "success"
              ? "border-success/40 bg-success text-white"
              : i < shown
                ? "border-tile-border bg-tile"
                : "border-tile-border/70 bg-tile-hidden text-transparent",
          )}
        >
          {i < shown ? ch : "•"}
        </motion.span>
      ))}
    </div>
  );
}

function DemoCreate() {
  const n = useTicker(CHAIN.length + 2, 700);
  return (
    <div className="flex flex-col items-center gap-1">
      {CHAIN.map((w, i) => (
        <motion.div
          key={w}
          animate={{ opacity: i < n ? 1 : 0.25, scale: i === n - 1 ? 1.05 : 1 }}
          className="w-44 rounded-xl bg-surface-2 px-3 py-1.5 text-center font-display font-bold tracking-wide"
        >
          {i < n ? w : "· · ·"}
        </motion.div>
      ))}
    </div>
  );
}

function DemoVisible() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {CHAIN.map((w, i) => (
        <Tiles key={w} word={w} shown={i === 0 ? w.length : 1} />
      ))}
    </div>
  );
}

function DemoGuess() {
  const n = useTicker(8, 450);
  const typed = "BEAN".slice(0, Math.min(n, 4));
  const solved = n >= 5;
  return (
    <div className="flex flex-col items-center gap-3">
      <Tiles word="BEAN" shown={solved ? 4 : 1} tone={solved ? "success" : "plain"} />
      <div className={cn("flex h-11 w-44 items-center rounded-xl border-2 px-3 font-display font-bold tracking-widest", solved ? "border-success" : "border-border")}>
        {typed}
        {!solved && <span className="ml-0.5 h-5 w-0.5 animate-pulse bg-brand" />}
      </div>
      <span className={cn("h-5 font-bold text-success transition-opacity", solved ? "opacity-100" : "opacity-0")}>
        Correct! +{SCORING.basePoints}
      </span>
    </div>
  );
}

function DemoSkip() {
  const n = useTicker(5, 900);
  const shown = Math.min(n + 1, 4);
  return (
    <div className="flex flex-col items-center gap-3">
      <Tiles word="BEAN" shown={shown} />
      <div className="flex gap-1.5">
        {[1, 2, 3].map((h) => (
          <span
            key={h}
            className={cn(
              "rounded-lg px-2 py-0.5 text-sm font-bold transition-colors",
              h < shown ? "bg-hint-soft text-hint dark:text-hint-bright" : "bg-surface-2 text-muted",
            )}
          >
            ⏭ −{SCORING.skipPenalty}
          </span>
        ))}
      </div>
      <p className="text-xs font-semibold text-muted">Each skip passes the turn to your opponent.</p>
    </div>
  );
}

function DemoWin() {
  const n = useTicker(6, 700);
  const racers = [
    { name: "You", solved: Math.min(n, 4) },
    { name: "Sam", solved: Math.min(Math.max(n - 1, 0), 3) },
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Trophy className="size-12 text-hint-bright" aria-hidden />
      </motion.div>
      <div className="flex flex-col gap-1.5">
        {racers.map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-sm font-bold">
            <span className="w-10 text-muted">{r.name}</span>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-2 w-6 rounded-full transition-colors", i < r.solved ? "bg-success" : "bg-surface-3")} />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-muted">Points are your stakes: +{SCORING.basePoints} a word, −{SCORING.skipPenalty} a skip.</p>
    </div>
  );
}

const STEPS: { title: string; text: string; demo: ReactNode }[] = [
  { title: "Create 5 connected words", text: "Each word should link to the one before it. Make it fair — but not too easy.", demo: <DemoCreate /> },
  { title: "Your opponent sees the first word", text: "Every other word shows only its first letter. They know how long it is.", demo: <DemoVisible /> },
  { title: "Guess the hidden words", text: "Take turns, one word at a time. Solve it and the turn passes — wrong guesses cost a little.", demo: <DemoGuess /> },
  { title: "Stuck? Skip", text: "Skipping reveals the next letter of your word, costs points, and hands the turn over. The word waits for you.", demo: <DemoSkip /> },
  { title: "First to crack the chain wins", text: "Solve every word before your opponent does. Spend your points on skips wisely.", demo: <DemoWin /> },
];

export function Tutorial() {
  const router = useRouter();
  const setUi = useUiStore((s) => s.set);
  const [[step, dir], setStep] = useState<[number, number]>([0, 1]);
  const last = step === STEPS.length - 1;
  const go = (d: number) => setStep(([s]) => [Math.max(0, Math.min(STEPS.length - 1, s + d)), d]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = STEPS[step]!;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand">How to play</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">Learn it in 30 seconds</h1>
      </div>

      <Card className="relative overflow-hidden p-6">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="grid min-h-56 w-full place-items-center rounded-2xl bg-surface-2/60 p-4" aria-hidden>
              {current.demo}
            </div>
            <div aria-live="polite">
              <p className="mb-1 font-display text-sm font-bold text-muted">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="font-display text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-muted">{current.text}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="flex justify-center gap-2" role="tablist" aria-label="Tutorial steps">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            role="tab"
            aria-selected={i === step}
            aria-label={`Step ${i + 1}: ${s.title}`}
            onClick={() => setStep([i, i > step ? 1 : -1])}
            className="grid h-6 place-items-center"
          >
            <motion.span className="block h-2 rounded-full" animate={{ width: i === step ? 28 : 8, backgroundColor: i <= step ? "var(--brand)" : "var(--surface-3)" }} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button variant="secondary" size="lg" onClick={() => go(-1)} disabled={step === 0} aria-label="Previous step">
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        {last ? (
          <Button
            size="lg"
            variant="success"
            onClick={() => {
              setUi({ hasSeenTutorial: true });
              router.push("/play");
            }}
          >
            <Check className="size-5" aria-hidden /> Got it!
          </Button>
        ) : (
          <Button size="lg" onClick={() => go(1)}>
            Next <ArrowRight className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
