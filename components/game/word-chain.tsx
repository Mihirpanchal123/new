"use client";

import { Check, ChevronDown, Lock, X } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect } from "react";
import { lettersToMask } from "@/lib/game/mask";
import { cn } from "@/lib/utils";
import type { WordCardView } from "@/types/game";
import { ParticleBurst } from "../animations/particles";

type TileState = "given" | "hidden" | "shown" | "solved" | "failed" | "secret";

function LetterTile({ letter, state, index, long }: { letter: string | null; state: TileState; index: number; long: boolean }) {
  const content = state === "hidden" ? "" : letter;
  return (
    <span className="relative min-w-0 max-w-11 flex-1 [perspective:400px]">
      <motion.span
        key={`${state === "hidden" ? "h" : "s"}-${content}`}
        initial={state === "hidden" || state === "given" ? false : { rotateX: -90, opacity: 0.2 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 28, delay: state === "solved" || state === "failed" ? index * 0.045 : 0 }}
        className={cn(
          "grid aspect-square min-h-0 w-full place-items-center overflow-hidden rounded-[22%] border-2 font-display font-bold uppercase leading-none",
          long ? "text-[clamp(0.7rem,3.4vw,1.15rem)]" : "text-[clamp(0.95rem,4.6vw,1.45rem)]",
          state === "given" && "border-transparent bg-transparent text-ink",
          state === "hidden" && "border-tile-border/70 bg-tile-hidden",
          state === "shown" && "border-tile-border bg-tile text-ink shadow-[0_2px_0_0_var(--tile-border)]",
          state === "secret" && "border-dashed border-tile-border bg-transparent text-muted/70",
          state === "solved" && "border-success/40 bg-success text-white shadow-[0_2px_0_0_var(--success-deep)]",
          state === "failed" && "border-danger/30 bg-danger-soft text-danger",
        )}
      >
        {state === "hidden" ? <span className="size-1.5 rounded-full bg-muted/50" aria-hidden /> : content}
      </motion.span>
    </span>
  );
}

function tileState(card: WordCardView, i: number, owner: boolean): TileState {
  if (card.status === "GIVEN") return "given";
  if (card.status === "SOLVED") return "solved";
  if (card.status === "FAILED") return "failed";
  if (owner) return i < card.revealedCount ? "shown" : "secret";
  return card.letters[i] ? "shown" : "hidden";
}

export interface Celebration {
  key: number;
  position: number;
  points: number;
}

interface WordCardProps {
  card: WordCardView;
  active: boolean;
  /** Viewing my own chain (I know the letters). */
  owner?: boolean;
  celebration?: Celebration | null;
  shakeKey?: number;
  liveGuesses?: string[];
}

export function WordCard({ card, active, owner = false, celebration, shakeKey = 0, liveGuesses }: WordCardProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const celebrating = celebration?.position === card.position;
  const long = card.length > 8;

  useEffect(() => {
    if (shakeKey && active && scope.current) {
      void animate(scope.current, { x: [0, -9, 9, -6, 6, -3, 0] }, { duration: 0.38 });
    }
  }, [shakeKey, active, animate, scope]);

  useEffect(() => {
    if (celebrating && scope.current) {
      void animate(scope.current, { scale: [1, 1.045, 1] }, { duration: 0.4, ease: "easeOut" });
    }
  }, [celebrating, celebration?.key, animate, scope]);

  const status = card.status;
  const srText =
    status === "GIVEN"
      ? `Start word: ${card.letters.join("")}`
      : status === "SOLVED"
        ? `Word ${card.position + 1}: ${card.letters.join("")}, solved for ${card.points} points`
        : status === "FAILED"
          ? `Word ${card.position + 1}: ${card.letters.join("")}, missed`
          : `Word ${card.position + 1}: ${owner ? card.letters.join("") : lettersToMask(card.letters)}, ${card.length} letters${active ? ", current word" : ""}`;

  return (
    <motion.div
      layout
      ref={scope}
      className={cn(
        "relative rounded-2xl border-2 px-2.5 py-2.5 transition-colors sm:px-3.5 sm:py-3",
        status === "GIVEN" && "border-transparent bg-surface-2",
        status === "LOCKED" && "border-border bg-surface opacity-70",
        status === "ACTIVE" && "border-brand bg-surface shadow-[0_0_0_4px_var(--brand-soft),0_12px_30px_-14px_var(--brand)]",
        status === "SOLVED" && "border-success/30 bg-success-soft",
        status === "FAILED" && "border-danger/20 bg-surface",
      )}
    >
      <span className="sr-only">{srText}</span>
      <div className="flex items-center gap-2" aria-hidden>
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-extrabold sm:size-6 sm:rounded-lg sm:text-[11px]",
            status === "ACTIVE" ? "bg-brand text-brand-ink" : "bg-surface-3 text-muted",
          )}
        >
          {card.position + 1}
        </span>
        <div className={cn("flex min-w-0 flex-1", long ? "gap-[3px] sm:gap-1" : "gap-1 sm:gap-1.5")}>
          {card.letters.map((l, i) => (
            <LetterTile key={i} letter={l} index={i} long={long} state={tileState(card, i, owner)} />
          ))}
        </div>
      </div>

      {/* Status chip sits on the card's top edge so the tiles keep the full row width. */}
      <span className="pointer-events-none absolute -top-2.5 right-3 z-10" aria-hidden>
        {status === "SOLVED" && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="inline-flex items-center gap-0.5 rounded-full bg-success px-2 py-0.5 text-xs font-extrabold text-white shadow-sm"
          >
            <Check className="size-3.5" strokeWidth={3.5} />
            {card.points}
          </motion.span>
        )}
        {status === "FAILED" && (
          <span className="inline-flex items-center rounded-full border border-danger/30 bg-surface px-2 py-0.5 text-xs font-extrabold text-danger">
            <X className="size-3.5" strokeWidth={3.5} />0
          </span>
        )}
        {status === "LOCKED" && (
          <span className="grid size-5 place-items-center rounded-full border border-border bg-surface">
            <Lock className="size-3 text-muted" />
          </span>
        )}
        {status === "ACTIVE" && !owner && card.hintsUsed > 0 && (
          <span className="inline-flex rounded-full border border-hint/40 bg-surface px-2 py-0.5 text-xs font-extrabold text-hint dark:text-hint-bright">
            💡 {card.hintsUsed}
          </span>
        )}
      </span>

      {active && liveGuesses && liveGuesses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-8" aria-label="Recent wrong guesses">
          <AnimatePresence initial={false}>
            {liveGuesses.map((g, i) => (
              <motion.span
                key={`${g}-${i}`}
                initial={{ opacity: 0, y: -4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="rounded-lg bg-danger-soft px-2 py-0.5 text-xs font-bold uppercase text-danger line-through decoration-2"
              >
                {g}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {celebrating && celebration && (
          <motion.div key={celebration.key} className="pointer-events-none absolute inset-0" exit={{ opacity: 0 }}>
            <ParticleBurst seed={celebration.key} />
            <motion.span
              className="absolute right-3 top-0 font-display text-2xl font-bold text-success drop-shadow"
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -34, opacity: [0, 1, 1, 0], scale: 1.1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            >
              +{celebration.points}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function WordChain({
  cards,
  activePosition,
  owner,
  celebration,
  shakeKey,
  liveGuesses,
  label,
}: {
  cards: WordCardView[];
  activePosition: number | null;
  owner?: boolean;
  celebration?: Celebration | null;
  shakeKey?: number;
  liveGuesses?: string[];
  label: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {cards.map((card, i) => (
        <li key={card.position} className="flex flex-col">
          {i > 0 && (
            <ChevronDown
              aria-hidden
              className={cn("mx-auto my-1 size-4", card.status === "LOCKED" ? "text-border-strong" : "text-muted")}
            />
          )}
          <WordCard
            card={card}
            active={card.position === activePosition}
            owner={owner}
            celebration={celebration}
            shakeKey={card.position === activePosition ? shakeKey : 0}
            liveGuesses={card.position === activePosition ? liveGuesses : undefined}
          />
        </li>
      ))}
    </ol>
  );
}
