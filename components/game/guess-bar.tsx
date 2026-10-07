"use client";

import { Eye, Lightbulb, Send } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GUESS_MAX_LENGTH } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
import { potentialPoints } from "@/lib/game/scoring";
import { command } from "@/lib/realtime/client";
import { cn, newActionId } from "@/lib/utils";
import type { TurnView, WordCardView } from "@/types/game";
import { Button } from "../ui/button";

type Feedback = { tone: "danger" | "success" | "hint" | "muted"; text: string; key: number } | null;

/** GuessInput + HintButton, as one sticky, thumb-friendly action bar. */
export function GuessBar({
  code,
  turn,
  card,
  isMyTurn,
  opponentName,
}: {
  code: string;
  turn: TurnView | null;
  card: WordCardView | null;
  isMyTurn: boolean;
  opponentName: string;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<"guess" | "hint" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  const guessing = isMyTurn && turn?.phase === "GUESSING" && !!card;
  const turnId = turn?.id;

  // Fresh turn: reset local UI state (during render, not in an effect)…
  const [seenTurn, setSeenTurn] = useState(turnId);
  if (seenTurn !== turnId) {
    setSeenTurn(turnId);
    setValue("");
    setConfirmReveal(false);
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

  useEffect(() => {
    if (!confirmReveal) return;
    const id = window.setTimeout(() => setConfirmReveal(false), 3500);
    return () => window.clearTimeout(id);
  }, [confirmReveal]);

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
    const res = await command("guess:submit", { code, turnId: turn.id, guess, actionId: newActionId() });
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

  async function requestHint() {
    if (!guessing || !turn || !card || pending) return;
    const revealsWholeWord = card.revealedCount + 1 >= card.length;
    if (revealsWholeWord && !confirmReveal) {
      setConfirmReveal(true);
      return;
    }
    setConfirmReveal(false);
    setPending("hint");
    const res = await command("hint:request", {
      code,
      turnId: turn.id,
      expectedRevealed: card.revealedCount,
      actionId: newActionId(),
    });
    setPending(null);
    if (res.ok) {
      say("hint", res.data.exhausted ? "Word revealed — 0 pts" : `Hint used · −${SCORING.hintPenalty}`);
    } else if (res.error !== "STALE") {
      say("muted", res.message);
    }
    inputRef.current?.focus({ preventScroll: true });
  }

  const worth = card ? potentialPoints(card.hintsUsed, card.wrongGuesses) : SCORING.basePoints;

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
                "Nice — next word coming up"
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
            placeholder={guessing ? "Type your guess…" : "…"}
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
        variant={confirmReveal ? "danger" : "hint"}
        size="md"
        className="w-full"
        onClick={() => void requestHint()}
        disabled={!guessing || !card}
        loading={pending === "hint"}
        aria-describedby="hint-cost"
      >
        <Lightbulb className="size-5" aria-hidden />
        {confirmReveal ? "Tap again to reveal the whole word" : "Reveal letter"}
        <span id="hint-cost" className="ml-auto rounded-lg bg-black/5 px-2 py-0.5 text-sm dark:bg-white/10">
          {confirmReveal ? "0 pts" : `−${SCORING.hintPenalty} pts`}
        </span>
      </Button>
    </div>
  );
}
