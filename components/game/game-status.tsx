"use client";

import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn, formatClock } from "@/lib/utils";
import type { PlayerView, TurnView, WordCardView } from "@/types/game";
import { useCountdown } from "./hooks/use-server-clock";

/** One line that always tells you what's happening. Also the screen-reader live region. */
export function GameStatus({
  turn,
  meId,
  opponentName,
  resolvedCard,
}: {
  turn: TurnView | null;
  meId: string;
  opponentName: string;
  /** The card that just resolved (for RESULT phase text). */
  resolvedCard: WordCardView | null;
}) {
  let text = "Get ready…";
  let tone: "brand" | "muted" | "success" | "danger" = "muted";

  if (turn) {
    const mine = turn.guesserId === meId;
    if (turn.phase === "GUESSING") {
      text = mine ? `Your turn — crack word ${turn.position + 1}` : `${opponentName} is guessing word ${turn.position + 1}`;
      tone = mine ? "brand" : "muted";
    } else {
      const word = resolvedCard?.letters.join("") ?? "";
      const who = mine ? "You" : opponentName;
      if (turn.outcome === "SOLVED") {
        text = `${who} solved ${word}! +${resolvedCard?.points ?? 0}`;
        tone = "success";
      } else if (turn.outcome === "TIMEOUT") {
        text = `Time's up! It was ${word}`;
        tone = "danger";
      } else {
        text = `Fully revealed: ${word}`;
        tone = "danger";
      }
    }
  }

  return (
    <div className="relative flex h-8 items-center justify-center overflow-hidden" aria-live="polite" aria-atomic>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={text}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "truncate text-center font-display text-base font-semibold sm:text-lg",
            tone === "brand" && "text-brand",
            tone === "muted" && "text-ink-2",
            tone === "success" && "text-success",
            tone === "danger" && "text-danger",
          )}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Opponent dropped: show the reconnection window. */
export function OpponentPresenceBanner({ opponent }: { opponent: PlayerView | null }) {
  const left = useCountdown(opponent?.graceEndsAt ?? null);
  const show = !!opponent && !opponent.connected && !opponent.left;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-hint-soft px-4 py-1.5 text-sm font-bold text-hint dark:text-hint-bright"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            Waiting for {opponent!.displayName} to reconnect…
            {opponent!.graceEndsAt ? <span className="ml-1 tabular">{formatClock(left)}</span> : null}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
