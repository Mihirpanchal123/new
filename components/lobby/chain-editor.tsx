"use client";

import { ArrowDown, Check, Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WORD_MAX_LENGTH } from "@/constants/game";
import { checkChain, WORD_ISSUE_MESSAGES } from "@/lib/validation/words";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";

/** Eight-word chains; shorter games use the first N words. */
const EXAMPLES = [
  ["coffee", "bean", "plant", "farm", "market", "stall", "horse", "race"],
  ["space", "rocket", "fuel", "engine", "power", "station", "train", "track"],
  ["rain", "cloud", "water", "river", "ocean", "wave", "surf", "board"],
  ["pizza", "cheese", "mouse", "trap", "door", "bell", "tower", "clock"],
  ["winter", "snow", "ball", "dance", "party", "cake", "candle", "light"],
  ["guitar", "string", "kite", "wind", "mill", "flour", "bread", "butter"],
];

export const emptyChain = (length: number) => Array<string>(length).fill("");

/**
 * The chain form: one input per word, live validation, an example picker and
 * a step indicator. Submitting is wired through `formId`, so the page's own
 * sticky footer button can submit it.
 */
export function ChainEditor({
  length,
  formId,
  words,
  onWordsChange,
  locked,
  pending,
  serverErrors = {},
  onServerErrorClear,
  onSubmit,
  opponentName,
  autoFocus = true,
}: {
  length: number;
  formId: string;
  words: string[];
  onWordsChange: (words: string[]) => void;
  locked: boolean;
  pending: boolean;
  serverErrors?: Record<string, string>;
  onServerErrorClear?: (index: number) => void;
  /** Called with normalized words once every word is valid. */
  onSubmit: (words: string[]) => void;
  opponentName: string;
  autoFocus?: boolean;
}) {
  const [touched, setTouched] = useState<boolean[]>(() => Array(length).fill(false));
  const [focused, setFocused] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!locked && autoFocus) inputs.current[0]?.focus({ preventScroll: true });
  }, [locked, autoFocus]);

  const check = useMemo(() => checkChain(words, length), [words, length]);
  const validCount = check.issues.filter((i) => i === null).length;

  function errorFor(i: number): string | null {
    if (serverErrors[String(i)]) return serverErrors[String(i)]!;
    const issue = check.issues[i];
    if (!issue || !touched[i]) return null;
    return WORD_ISSUE_MESSAGES[issue];
  }

  function submit() {
    setTouched(Array(length).fill(true));
    if (!check.valid) {
      const firstBad = check.issues.findIndex((i) => i !== null);
      inputs.current[firstBad]?.focus();
      return;
    }
    onSubmit(check.words);
  }

  function applyExample() {
    const options = EXAMPLES.map((e) => e.slice(0, length)).filter((e) => e.join() !== words.join());
    const pick = options[Math.floor(Math.random() * options.length)]!;
    onWordsChange([...pick]);
    for (let i = 0; i < length; i++) onServerErrorClear?.(i);
    setTouched(Array(length).fill(false));
  }

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center gap-3" aria-label={`${validCount} of ${length} words ready`}>
        <div className="flex flex-1 gap-1.5">
          {words.map((_, i) => (
            <motion.span
              key={i}
              className="h-2 flex-1 rounded-full"
              animate={{
                backgroundColor:
                  check.issues[i] === null ? "var(--success)" : i === focused && !locked ? "var(--brand)" : "var(--surface-3)",
              }}
            />
          ))}
        </div>
        <span className="font-display text-sm font-bold tabular text-muted">
          {Math.min(focused + 1, length)} / {length}
        </span>
      </div>

      <Card className="p-3 sm:p-4">
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <ol className="flex flex-col">
            {words.map((word, i) => {
              const error = errorFor(i);
              const ok = check.issues[i] === null;
              return (
                <li key={i} className="flex flex-col">
                  {i > 0 && <ArrowDown className="mx-auto my-1 size-4 text-muted" aria-hidden />}
                  <label
                    htmlFor={`chain-${i}`}
                    className="mb-1 flex items-center gap-1.5 px-1 text-xs font-extrabold uppercase tracking-wider text-muted"
                  >
                    Word {i + 1}
                    {i === 0 ? (
                      <span className="inline-flex items-center gap-1 text-brand normal-case tracking-normal">
                        <Eye className="size-3.5" aria-hidden /> visible to {opponentName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                        <EyeOff className="size-3.5" aria-hidden /> hidden
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id={`chain-${i}`}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={word}
                      disabled={locked || pending}
                      maxLength={WORD_MAX_LENGTH}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint={i === length - 1 ? "done" : "next"}
                      placeholder={i === 0 ? "e.g. COFFEE" : i === 1 ? "e.g. BEAN" : ""}
                      aria-invalid={!!error || undefined}
                      aria-describedby={error ? `chain-${i}-err` : undefined}
                      onFocus={() => setFocused(i)}
                      onBlur={() => setTouched((t) => t.map((v, j) => (j === i ? true : v)))}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^a-zA-Z]/g, "");
                        onWordsChange(words.map((x, j) => (j === i ? v : x)));
                        onServerErrorClear?.(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && i < length - 1) {
                          e.preventDefault();
                          inputs.current[i + 1]?.focus();
                        }
                      }}
                      className={cn(
                        "h-13 w-full rounded-2xl border-2 bg-surface-2 pl-4 pr-11 font-display text-xl font-bold uppercase tracking-[0.1em] text-ink",
                        "placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60",
                        "transition-colors focus:bg-surface focus:outline-none disabled:opacity-70",
                        error ? "border-danger/70" : "border-border focus:border-brand",
                      )}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                      {locked ? (
                        <Lock className="size-5 text-muted" aria-hidden />
                      ) : ok ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="grid size-6 place-items-center rounded-full bg-success text-white"
                        >
                          <Check className="size-4" strokeWidth={3} aria-hidden />
                        </motion.span>
                      ) : null}
                    </span>
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        id={`chain-${i}-err`}
                        role="alert"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden px-1 pt-1 text-sm font-semibold text-danger"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
          {/* Lets Enter on the last field submit */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Card>

      {!locked && (
        <Button variant="ghost" size="sm" className="mx-auto" onClick={applyExample}>
          <Sparkles className="size-4 text-hint" aria-hidden /> Need inspiration? Try an example
        </Button>
      )}
    </>
  );
}
