"use client";

import { ArrowDown, Check, Eye, EyeOff, Lock, Pencil, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CHAIN_LENGTH, WORD_MAX_LENGTH } from "@/constants/game";
import { command } from "@/lib/realtime/client";
import { checkChain, WORD_ISSUE_MESSAGES } from "@/lib/validation/words";
import { cn } from "@/lib/utils";
import { selectMe, selectOpponent } from "@/stores/game-store";
import type { RoomView } from "@/types/game";
import { ConnectionIndicator } from "../game/connection-indicator";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";

const EXAMPLES = [
  ["coffee", "bean", "plant", "farm", "market"],
  ["space", "rocket", "fuel", "engine", "power"],
  ["rain", "cloud", "water", "river", "ocean"],
  ["pizza", "cheese", "mouse", "trap", "door"],
  ["winter", "snow", "ball", "dance", "party"],
  ["guitar", "string", "kite", "wind", "mill"],
];

const draftKey = (code: string) => `word-duel:chain:${code}`;

function loadDraft(code: string): string[] {
  try {
    const raw = sessionStorage.getItem(draftKey(code));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed) && parsed.length === CHAIN_LENGTH && parsed.every((w) => typeof w === "string")) return parsed;
  } catch {
    /* ignore */
  }
  return Array(CHAIN_LENGTH).fill("");
}

export function ChainSetup({ room }: { room: RoomView }) {
  const me = selectMe(room)!;
  const opponent = selectOpponent(room);
  const locked = me.chainSubmitted;

  const [words, setWords] = useState<string[]>(() => room.myChain ?? loadDraft(room.code));
  const [touched, setTouched] = useState<boolean[]>(() => Array(CHAIN_LENGTH).fill(false));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // A refresh mid-setup keeps your draft (it's your own words, in your own tab).
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(room.code), JSON.stringify(words));
    } catch {
      /* ignore */
    }
  }, [words, room.code]);

  useEffect(() => {
    if (!locked) inputs.current[0]?.focus({ preventScroll: true });
  }, [locked]);

  const check = useMemo(() => checkChain(words), [words]);
  const validCount = check.issues.filter((i) => i === null).length;

  function errorFor(i: number): string | null {
    if (serverErrors[String(i)]) return serverErrors[String(i)]!;
    const issue = check.issues[i];
    if (!issue || !touched[i]) return null;
    return WORD_ISSUE_MESSAGES[issue];
  }

  async function submit() {
    setTouched(Array(CHAIN_LENGTH).fill(true));
    if (!check.valid) {
      const firstBad = check.issues.findIndex((i) => i !== null);
      inputs.current[firstBad]?.focus();
      return;
    }
    setPending(true);
    const res = await command("chain:submit", { code: room.code, words: check.words });
    setPending(false);
    if (!res.ok) {
      if (res.fieldErrors) setServerErrors(res.fieldErrors);
      toast.error(res.message);
    }
  }

  async function unlock() {
    setPending(true);
    const res = await command("chain:unlock", { code: room.code });
    setPending(false);
    if (!res.ok) toast.error(res.message);
  }

  function applyExample() {
    const options = EXAMPLES.filter((e) => e.join() !== words.join());
    const pick = options[Math.floor(Math.random() * options.length)]!;
    setWords([...pick]);
    setServerErrors({});
    setTouched(Array(CHAIN_LENGTH).fill(false));
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Duel · {room.code}</span>
        <ConnectionIndicator />
      </div>

      <div className="flex flex-1 flex-col gap-5 pb-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Create your chain</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Make each word meaningfully connected to the previous one. {opponent?.displayName ?? "Your opponent"} only sees the first.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3" aria-label={`${validCount} of ${CHAIN_LENGTH} words ready`}>
          <div className="flex flex-1 gap-1.5">
            {words.map((_, i) => (
              <motion.span
                key={i}
                className="h-2 flex-1 rounded-full"
                animate={{
                  backgroundColor: check.issues[i] === null ? "var(--success)" : i === focused && !locked ? "var(--brand)" : "var(--surface-3)",
                }}
              />
            ))}
          </div>
          <span className="font-display text-sm font-bold tabular text-muted">
            {Math.min(focused + 1, CHAIN_LENGTH)} / {CHAIN_LENGTH}
          </span>
        </div>

        <Card className="p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <ol className="flex flex-col">
              {words.map((word, i) => {
                const error = errorFor(i);
                const ok = check.issues[i] === null;
                return (
                  <li key={i} className="flex flex-col">
                    {i > 0 && <ArrowDown className="mx-auto my-1 size-4 text-muted" aria-hidden />}
                    <label htmlFor={`chain-${i}`} className="mb-1 flex items-center gap-1.5 px-1 text-xs font-extrabold uppercase tracking-wider text-muted">
                      Word {i + 1}
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1 text-brand normal-case tracking-normal">
                          <Eye className="size-3.5" aria-hidden /> visible to opponent
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
                        enterKeyHint={i === CHAIN_LENGTH - 1 ? "done" : "next"}
                        placeholder={i === 0 ? "e.g. COFFEE" : i === 1 ? "e.g. BEAN" : ""}
                        aria-invalid={!!error || undefined}
                        aria-describedby={error ? `chain-${i}-err` : undefined}
                        onFocus={() => setFocused(i)}
                        onBlur={() => setTouched((t) => t.map((v, j) => (j === i ? true : v)))}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^a-zA-Z]/g, "");
                          setWords((w) => w.map((x, j) => (j === i ? v : x)));
                          setServerErrors((s) => {
                            const { [String(i)]: _drop, ...rest } = s;
                            return rest;
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i < CHAIN_LENGTH - 1) {
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
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-6 place-items-center rounded-full bg-success text-white">
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

        {opponent && (
          <div className="flex items-center justify-center gap-2.5 text-sm font-bold text-muted" role="status">
            <PlayerAvatar avatar={opponent.avatar} color={opponent.color} size="xs" />
            {opponent.chainSubmitted ? (
              <span className="text-success">{opponent.displayName} is locked in ✓</span>
            ) : (
              <span>
                {opponent.displayName} is building their chain
                <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.4, repeat: Infinity }}>
                  …
                </motion.span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:-mx-6 sm:px-6">
        {locked ? (
          <div className="flex gap-2">
            <div className="flex h-16 flex-1 items-center justify-center gap-2 rounded-[1.25rem] bg-success-soft px-4 text-center font-display text-lg font-semibold text-success">
              <Check className="size-5 shrink-0" aria-hidden />
              <span className="truncate">Locked in! Waiting for {opponent?.displayName ?? "opponent"}…</span>
            </div>
            <Button variant="secondary" size="xl" className="px-5" onClick={unlock} loading={pending} aria-label="Edit chain">
              <Pencil className="size-5" aria-hidden />
            </Button>
          </div>
        ) : (
          <Button size="xl" className="w-full" onClick={() => void submit()} loading={pending} loadingText="Locking in…">
            <Lock className="size-5" aria-hidden />
            Lock in chain
          </Button>
        )}
      </div>
    </div>
  );
}
