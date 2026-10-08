"use client";

import { Check, Lock, Pencil } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { describeSettings } from "@/constants/game";
import { command } from "@/lib/realtime/client";
import { selectMe, selectOpponent } from "@/stores/game-store";
import type { RoomView } from "@/types/game";
import { ConnectionIndicator } from "../game/connection-indicator";
import { VoiceControl } from "../game/voice-control";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { ChainEditor, emptyChain } from "./chain-editor";

const draftKey = (code: string) => `word-duel:chain:${code}`;

function loadDraft(code: string, length: number): string[] {
  try {
    const raw = sessionStorage.getItem(draftKey(code));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed) && parsed.length === length && parsed.every((w) => typeof w === "string")) return parsed;
  } catch {
    /* ignore */
  }
  return emptyChain(length);
}

export function ChainSetup({ room }: { room: RoomView }) {
  const me = selectMe(room)!;
  const opponent = selectOpponent(room);
  const locked = me.chainSubmitted;
  const length = room.settings.chainLength;

  const [words, setWords] = useState<string[]>(() => room.myChain ?? loadDraft(room.code, length));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  // A refresh mid-setup keeps your draft (it's your own words, in your own tab).
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(room.code), JSON.stringify(words));
    } catch {
      /* ignore */
    }
  }, [words, room.code]);

  async function submit(normalized: string[]) {
    setPending(true);
    const res = await command("chain:submit", { code: room.code, words: normalized });
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Duel · {room.code}</span>
        <div className="flex items-center gap-1.5">
          <VoiceControl opponentName={opponent?.displayName} />
          <ConnectionIndicator />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 pb-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Create your chain</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Make each word meaningfully connected to the previous one. {opponent?.displayName ?? "Your opponent"} only sees the first.
          </p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-brand">{describeSettings(room.settings)}</p>
        </div>

        <ChainEditor
          length={length}
          formId="chain-form"
          words={words}
          onWordsChange={setWords}
          locked={locked}
          pending={pending}
          serverErrors={serverErrors}
          onServerErrorClear={(i) =>
            setServerErrors((s) => {
              const { [String(i)]: _drop, ...rest } = s;
              return rest;
            })
          }
          onSubmit={(w) => void submit(w)}
          opponentName={opponent?.displayName ?? "opponent"}
        />

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
          <Button type="submit" form="chain-form" size="xl" className="w-full" loading={pending} loadingText="Locking in…">
            <Lock className="size-5" aria-hidden />
            Lock in chain
          </Button>
        )}
      </div>
    </div>
  );
}
