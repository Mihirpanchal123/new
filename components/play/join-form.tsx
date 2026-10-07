"use client";

import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/constants/game";
import { roomCodeSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

const ALLOWED = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, "g");

/** Large code input → server pre-check → into the room. */
export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase().replace(ALLOWED, "").slice(0, ROOM_CODE_LENGTH));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  function fail(message: string) {
    setError(message);
    if (scope.current) void animate(scope.current, { x: [0, -10, 10, -6, 6, 0] }, { duration: 0.35 });
  }

  async function submit() {
    if (!code) return fail("Enter the 5-character code your friend shared.");
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That doesn't look like a game code.");

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${parsed.data}`, { cache: "no-store" });
      const body = (await res.json()) as { ok: boolean; message?: string };
      if (!body.ok) {
        setPending(false);
        return fail(body.message ?? "We couldn't join that game.");
      }
      router.push(`/game/${parsed.data}`);
    } catch {
      setPending(false);
      fail("Connection problem — check your internet and try again.");
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <label htmlFor="join-code" className="text-center text-xs font-extrabold uppercase tracking-[0.25em] text-muted">
        Enter game code
      </label>
      <div ref={scope}>
        <input
          id="join-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(ALLOWED, "").slice(0, ROOM_CODE_LENGTH));
            setError(null);
          }}
          placeholder="A7K9P"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          autoFocus
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "join-error" : undefined}
          className={cn(
            "h-20 w-full rounded-[1.5rem] border-2 bg-surface text-center font-display text-5xl font-bold uppercase tracking-[0.35em] text-ink shadow-card",
            "placeholder:text-muted/30 focus:outline-none",
            error ? "border-danger" : "border-border focus:border-brand",
          )}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id="join-error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center font-semibold text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="xl" loading={pending} loadingText="Joining game…" disabled={code.length === 0}>
        Join game <ArrowRight className="size-6" aria-hidden />
      </Button>
    </form>
  );
}
