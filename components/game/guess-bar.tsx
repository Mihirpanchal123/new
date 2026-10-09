"use client";

import { Eye, Send, SkipForward } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GUESS_MAX_LENGTH } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
import { potentialPoints } from "@/lib/game/scoring";
import { command } from "@/lib/realtime/client";
import { cn, newActionId } from "@/lib/utils";
import type { TurnView, WordCardView } from "@/types/game";
import type { AckResult, GuessAckData, SkipAckData } from "@/types/realtime";
import { Button } from "../ui/button";

export interface GuessActions {
  guess(turnId: number, guess: string): Promise<AckResult<GuessAckData>>;
  skip(turnId: number, expectedRevealed: number): Promise<AckResult<SkipAckData>>;
}

export function onlineGuessActions(code: string): GuessActions {
  return {
    guess: (turnId, guess) => command("guess:submit", { code, turnId, guess, actionId: newActionId() }),
    skip: (turnId, expectedRevealed) => command("turn:skip", { code, turnId, expectedRevealed, actionId: newActionId() }),
  };
}

type Feedback = { tone: "danger" | "success" | "hint" | "muted"; text: string; key: number } | null;

/** GuessInput + SkipButton, as one sticky, thumb-friendly action bar. */
export function GuessBar({
  actions,
  turn,
  card,
  isMyTurn,
  opponentName,
  guesserName,
}: {
  actions: GuessActions;
  turn: TurnView | null;
  card: WordCardView | null;
  isMyTurn: boolean;
  opponentName: string;
  /** One-screen games: whose turn it is, shown as the input placeholder. */
  guesserName?: string;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<"guess" | "skip" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  const guessing = isMyTurn && turn?.phase === "GUESSING" && !!card;
  const turnId = turn?.id;

  // Fresh turn: reset local UI state (during render, not in an effect)…
  const [seenTurn, setSeenTurn] = useState(turnId);
  if (seenTurn !== turnId) {
    setSeenTurn(turnId);
    setValue("");
    setFeedback(null);
  }
  // …and focus the input so you can type immediately.
  useEffect(() => {
    if (guessing) inputRef.current?.focus({ preventScroll: true });
  }, [turnId, guessing]);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const say = (tone: NonNullable<Feedback>["tone"], text: string) => setFeedback({ tone, text, key: Date.now() });
  const shake = () => {
    if (scope.current) void animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.3 });
  };

  async function submitGuess() {
    if (!guessing || !turn || pending) return;
    const guess = value.trim();
    if (!guess) {
      shake();
      inputRef.current?.focus();
      return;
    }
    setPending("guess");
    const res = await actions.guess(turn.id, guess);
    setPending(null);
    if (res.ok) {
      if (res.data.correct) {
        setValue("");
        say("success", `Correct! +${res.data.points}`);
      } else {
        say("danger", res.data.duplicate ? "Already tried that one" : "Not quite!");
        shake();
        inputRef.current?.select();
      }
    } else {
      say(res.error === "TURN_EXPIRED" || res.error === "STALE" ? "muted" : "danger", res.message);
      if (res.error === "INVALID_INPUT") shake();
    }
  }

  async function skip() {
    if (!guessing || !turn || !card || pending) return;
    setPending("skip");
    const res = await actions.skip(turn.id, card.revealedCount);
    setPending(null);
    // On success the turn has passed; the bar switches to the opponent's view.
    if (!res.ok && res.error !== "STALE") say("muted", res.message);
  }

  const worth = card ? potentialPoints(card.wrongGuesses) : SCORING.basePoints;
  const nothingLeftToReveal = !!card && card.revealedCount >= card.length;

  if (!isMyTurn || !turn) {
    return (
      <div className="flex h-[7.25rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border px-4 text-center">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Eye className="size-5 text-muted" aria-hidden />
          {turn?.phase === "RESULT" ? "Next turn coming up…" : `${opponentName} is guessing…`}
        </p>
        <p className="text-sm text-muted">Watch them work through your chain.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-6 items-center justify-between px-1 text-sm font-bold">
        <AnimatePresence mode="wait">
          {feedback ? (
            <motion.span
              key={feedback.key}
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={cn(
                feedback.tone === "danger" && "text-danger",
                feedback.tone === "success" && "text-success",
                feedback.tone === "hint" && "text-hint dark:text-hint-bright",
                feedback.tone === "muted" && "text-muted",
              )}
            >
              {feedback.text}
            </motion.span>
          ) : (
            <motion.span key="worth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted">
              {turn.phase === "GUESSING" ? (
                <>
                  Worth up to <span className="text-ink">{worth}</span> pts
                </>
              ) : (
                "Switching turns…"
              )}
            </motion.span>
          )}
        </AnimatePresence>
        {card && turn.phase === "GUESSING" && <span className="text-muted tabular">{card.length} letters</span>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submitGuess();
        }}
      >
        <div ref={scope} className="min-w-0 flex-1">
          <label htmlFor="guess-input" className="sr-only">
            Your guess
          </label>
          <input
            id="guess-input"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, GUESS_MAX_LENGTH))}
            disabled={!guessing}
            placeholder={guessing ? (guesserName ? `${guesserName}, type your guess…` : "Type your guess…") : "…"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={GUESS_MAX_LENGTH}
            className={cn(
              "h-14 w-full rounded-2xl border-2 bg-surface px-4 font-display text-xl font-bold uppercase tracking-[0.12em] text-ink",
              "placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70",
              "transition-colors focus:outline-none disabled:opacity-60",
              feedback?.tone === "danger" ? "border-danger" : feedback?.tone === "success" ? "border-success" : "border-border focus:border-brand",
            )}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-[4.25rem] shrink-0 px-0 sm:w-auto sm:px-6"
          disabled={!guessing}
          loading={pending === "guess"}
          feedback={false}
          aria-label="Submit guess"
        >
          <Send className="size-5 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Guess</span>
        </Button>
      </form>

      <Button
        variant="hint"
        size="md"
        className="w-full"
        onClick={() => void skip()}
        disabled={!guessing || !card || nothingLeftToReveal}
        loading={pending === "skip"}
        aria-describedby="skip-cost"
      >
        <SkipForward className="size-5" aria-hidden />
        {nothingLeftToReveal ? "Every letter is showing — type it!" : "Skip · reveal a letter"}
        {!nothingLeftToReveal && (
          <span id="skip-cost" className="ml-auto rounded-lg bg-black/5 px-2 py-0.5 text-sm dark:bg-white/10">
            −{SCORING.skipPenalty} pts
          </span>
        )}
      </Button>
    </div>
  );
}
