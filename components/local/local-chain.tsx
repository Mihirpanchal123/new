"use client";

import { EyeOff, Lock, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { describeSettings, type GameSettings } from "@/constants/game";
import { type Seat, useLocalGame } from "@/lib/local/local-game";
import type { PublicProfile } from "@/types/game";
import { ChainEditor, emptyChain } from "../lobby/chain-editor";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";

/** "Pass the device to X" — keeps one player's chain off the other's screen. */
export function Handoff({
  player,
  other,
  title,
  text,
  action,
  onContinue,
}: {
  player: PublicProfile;
  other: PublicProfile;
  title: string;
  text: string;
  /** Omit for a non-interactive "get ready" screen. */
  action?: string;
  onContinue?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="relative"
      >
        <PlayerAvatar avatar={player.avatar} color={player.color} size="xl" bob />
        <span className="absolute -bottom-2 -right-2 grid size-10 place-items-center rounded-full border-4 border-[var(--bg)] bg-surface-3 text-ink-2">
          <Smartphone className="size-5" aria-hidden />
        </span>
      </motion.div>
      <div>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">{text}</p>
      </div>
      <p className="flex items-center gap-2 rounded-full bg-hint-soft px-4 py-2 text-sm font-bold text-hint dark:text-hint-bright">
        <EyeOff className="size-4 shrink-0" aria-hidden /> {other.displayName}, no peeking!
      </p>
      {action && onContinue && (
        <Button size="xl" className="w-full" onClick={onContinue}>
          {action}
        </Button>
      )}
    </div>
  );
}

/** One player's private chain editor. */
export function LocalChain({ seat, settings }: { seat: Seat; settings: GameSettings }) {
  const players = useLocalGame((s) => s.players);
  const submitChain = useLocalGame((s) => s.submitChain);
  const me = players[seat];
  const other = players[seat === 0 ? 1 : 0];
  const [words, setWords] = useState(() => emptyChain(settings.chainLength));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  function submit(normalized: string[]) {
    const res = submitChain(seat, normalized);
    if (!res.ok) {
      if (res.fieldErrors) setServerErrors(res.fieldErrors);
      toast.error(res.message);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
          <PlayerAvatar avatar={me.avatar} color={me.color} size="xs" />
          <span className="truncate">{me.displayName}</span>
        </span>
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-[0.2em] text-muted">
          Chain {seat + 1} of 2
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-5 pb-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{me.displayName}, build your chain</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Each word should connect to the one before it. {other.displayName} will only see the first word.
          </p>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-brand">{describeSettings(settings)}</p>
        </div>

        <ChainEditor
          length={settings.chainLength}
          formId="local-chain-form"
          words={words}
          onWordsChange={setWords}
          locked={false}
          pending={false}
          serverErrors={serverErrors}
          onServerErrorClear={(i) =>
            setServerErrors((s) => {
              const { [String(i)]: _drop, ...rest } = s;
              return rest;
            })
          }
          onSubmit={submit}
          opponentName={other.displayName}
        />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:-mx-6 sm:px-6">
        <Button type="submit" form="local-chain-form" size="xl" className="w-full">
          <Lock className="size-5" aria-hidden />
          Lock in &amp; hide
        </Button>
      </div>
    </div>
  );
}
