"use client";

import { Check, Frown, Handshake, Home, RotateCcw, Share2, Trophy, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { command } from "@/lib/realtime/client";
import { resultShareText, shareOrCopy } from "@/lib/share";
import { cn, formatSeconds } from "@/lib/utils";
import { selectMe, selectOpponent } from "@/stores/game-store";
import type { PlayerMatchStats, PlayerView, RoomView, WordCardView } from "@/types/game";
import type { AckResult } from "@/types/realtime";
import { Confetti } from "../animations/particles";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";
import { ScoreDisplay } from "./player-header";
import { VoiceControl } from "./voice-control";

type Outcome = "win" | "loss" | "draw";

const TITLES: Record<Outcome, { text: string; icon: typeof Trophy; tone: string }> = {
  win: { text: "You win!", icon: Trophy, tone: "text-hint dark:text-hint-bright" },
  loss: { text: "So close!", icon: Frown, tone: "text-muted" },
  draw: { text: "It's a draw!", icon: Handshake, tone: "text-brand" },
};

export function StatRow({ label, mine, theirs, better }: { label: string; mine: string; theirs: string; better: "mine" | "theirs" | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5">
      <span className={cn("text-left font-display text-lg font-bold tabular", better === "mine" ? "text-success" : "text-ink")}>{mine}</span>
      <span className="text-center text-xs font-extrabold uppercase tracking-wider text-muted">{label}</span>
      <span className={cn("text-right font-display text-lg font-bold tabular", better === "theirs" ? "text-success" : "text-ink")}>{theirs}</span>
    </div>
  );
}

export function compare(a: number | null, b: number | null, higherIsBetter: boolean): "mine" | "theirs" | null {
  if (a === null || b === null || a === b) return null;
  return (a > b) === higherIsBetter ? "mine" : "theirs";
}

export function ChainRecap({ owner, words, cards }: { owner: PlayerView; words: string[]; cards: WordCardView[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-2 truncate text-sm font-extrabold">
        <PlayerAvatar avatar={owner.avatar} color={owner.color} size="xs" />
        <span className="truncate">{owner.displayName}&apos;s chain</span>
      </p>
      <ol className="flex flex-col gap-1.5">
        {words.map((w, i) => {
          const status = cards[i]?.status;
          return (
            <li
              key={i}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl px-3 py-2 font-display font-bold uppercase tracking-wide",
                status === "SOLVED" ? "bg-success-soft text-success" : status === "FAILED" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink",
              )}
            >
              <span className="truncate">{w}</span>
              {status === "SOLVED" && <Check className="size-4 shrink-0" strokeWidth={3} aria-label="solved" />}
              {status === "FAILED" && <X className="size-4 shrink-0" strokeWidth={3} aria-label="missed" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ResultsScreen({ room }: { room: RoomView }) {
  const router = useRouter();
  const match = room.match!;
  const result = match.result!;
  const me = selectMe(room)!;
  const opponent = selectOpponent(room)!;
  const [pending, setPending] = useState<string | null>(null);

  const outcome: Outcome = result.winnerId === null ? "draw" : result.winnerId === me.id ? "win" : "loss";
  const title = TITLES[outcome];
  const myStats = result.stats[me.id] as PlayerMatchStats;
  const theirStats = result.stats[opponent.id] as PlayerMatchStats;
  const myScore = match.scores[me.id] ?? 0;
  const theirScore = match.scores[opponent.id] ?? 0;

  const forfeitNote =
    result.endReason === "FORFEIT"
      ? outcome === "win"
        ? `${opponent.displayName} left the duel — win by forfeit.`
        : "You left the duel."
      : null;

  const rematchMine = room.rematch?.requestedBy === me.id;
  const rematchTheirs = room.rematch && room.rematch.requestedBy === opponent.id;
  const opponentGone = opponent.left;

  async function act(name: string, fn: () => Promise<AckResult<unknown>>) {
    setPending(name);
    const res = await fn();
    setPending(null);
    if (!res.ok) toast.error(res.message);
  }

  async function share() {
    const text = resultShareText({
      won: outcome === "draw" ? null : outcome === "win",
      myScore,
      theirScore,
      opponent: opponent.displayName,
    });
    const url = `${window.location.origin}/results/${match.id}`;
    const res = await shareOrCopy({ title: "Word Duel result", text, url });
    if (res === "copied") toast.success("Result copied — paste it anywhere!");
    if (res === "failed") toast.error("Couldn't share right now.");
    if (res === "shared" || res === "copied") analytics.track("result_shared", { outcome });
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-8 pt-8 sm:px-6 [&>*:not(:first-child)]:relative [&>*:not(:first-child)]:z-10">
      {outcome === "win" && <Confetti seed={match.number} />}

      {!opponentGone && (
        <div className="mb-2 flex justify-end">
          <VoiceControl opponentName={opponent.displayName} />
        </div>
      )}

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="flex flex-col items-center text-center"
      >
        <motion.div
          initial={{ rotate: -20, y: -10 }}
          animate={{ rotate: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 8, delay: 0.1 }}
          className={cn(
            "mb-3 grid size-20 place-items-center rounded-[1.6rem] bg-surface shadow-card",
            outcome === "loss" && "grayscale",
          )}
        >
          <title.icon className={cn("size-10", title.tone)} aria-hidden />
        </motion.div>
        <h1 className="font-display text-5xl font-bold uppercase sm:text-6xl">{title.text}</h1>
        {forfeitNote && <p className="mt-2 font-semibold text-muted">{forfeitNote}</p>}
      </motion.div>

      <Card className="mt-6 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-2">
            <PlayerAvatar avatar={me.avatar} color={me.color} size="md" active={outcome === "win"} />
            <span className="max-w-full truncate text-sm font-extrabold">{me.displayName}</span>
            <ScoreDisplay value={myScore} className="text-4xl sm:text-5xl" />
          </div>
          <span className="font-display text-lg font-bold text-muted">VS</span>
          <div className="flex min-w-0 flex-col items-center gap-2">
            <PlayerAvatar avatar={opponent.avatar} color={opponent.color} size="md" active={outcome === "loss"} />
            <span className="max-w-full truncate text-sm font-extrabold">{opponent.displayName}</span>
            <ScoreDisplay value={theirScore} className="text-4xl sm:text-5xl" />
          </div>
        </div>

        <div className="mt-5 divide-y divide-border border-t border-border">
          <StatRow label="Words solved" mine={`${myStats.solved}/${match.totalRounds}`} theirs={`${theirStats.solved}/${match.totalRounds}`} better={compare(myStats.solved, theirStats.solved, true)} />
          <StatRow label="Hints used" mine={String(myStats.hintsUsed)} theirs={String(theirStats.hintsUsed)} better={compare(myStats.hintsUsed, theirStats.hintsUsed, false)} />
          <StatRow label="Avg. guess time" mine={formatSeconds(myStats.avgSolveMs)} theirs={formatSeconds(theirStats.avgSolveMs)} better={compare(myStats.avgSolveMs, theirStats.avgSolveMs, false)} />
          <StatRow label="Wrong guesses" mine={String(myStats.wrongGuesses)} theirs={String(theirStats.wrongGuesses)} better={compare(myStats.wrongGuesses, theirStats.wrongGuesses, false)} />
        </div>
      </Card>

      <Card className="mt-4 grid grid-cols-2 gap-4 p-4 sm:p-5">
        <ChainRecap owner={opponent} words={result.chains[opponent.id] ?? []} cards={match.opponentBoard} />
        <ChainRecap owner={me} words={result.chains[me.id] ?? []} cards={match.myBoard} />
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {opponentGone ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-center text-sm font-bold text-muted">
            {opponent.displayName} left — start a new game to play again.
          </p>
        ) : rematchMine ? (
          <div className="flex gap-2">
            <div className="flex h-16 flex-1 items-center justify-center rounded-[1.25rem] bg-brand-soft px-4 text-center font-display text-lg font-semibold text-brand">
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                Waiting for {opponent.displayName}…
              </motion.span>
            </div>
            <Button variant="secondary" size="xl" className="px-5" loading={pending === "cancel"} onClick={() => act("cancel", () => command("rematch:cancel", { code: room.code }))}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="xl"
            variant={rematchTheirs ? "success" : "primary"}
            className="w-full"
            loading={pending === "rematch"}
            onClick={() => act("rematch", () => command("rematch:request", { code: room.code }))}
          >
            <RotateCcw className="size-6" aria-hidden />
            {rematchTheirs ? "Accept rematch" : "Rematch"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => router.push("/play")}>
            <Home className="size-5" aria-hidden /> New game
          </Button>
          <Button variant="secondary" size="lg" onClick={share}>
            <Share2 className="size-5" aria-hidden /> Share result
          </Button>
        </div>
        <Link href={`/results/${match.id}`} className="mx-auto mt-1 text-sm font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
          View full match recap
        </Link>
      </div>
    </div>
  );
}
