"use client";

import { Handshake, Home, RotateCcw, Settings2, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { describeSettings } from "@/constants/game";
import { useLocalGame, type LocalView } from "@/lib/local/local-game";
import { formatSeconds } from "@/lib/utils";
import type { PlayerMatchStats } from "@/types/game";
import { Confetti } from "../animations/particles";
import { ChainRecap, compare, StatRow } from "../game/results-screen";
import { ScoreDisplay } from "../game/player-header";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";

export function LocalResults({ view }: { view: LocalView }) {
  const router = useRouter();
  const match = view.match!;
  const result = match.result!;
  const [p1, p2] = view.players;
  const playAgain = useLocalGame((s) => s.playAgain);
  const backToSetup = useLocalGame((s) => s.backToSetup);
  const quit = useLocalGame((s) => s.quit);

  const winner = view.players.find((p) => p.id === result.winnerId) ?? null;
  const s1 = result.stats[p1.id] as PlayerMatchStats;
  const s2 = result.stats[p2.id] as PlayerMatchStats;
  const TitleIcon = winner ? Trophy : Handshake;

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-8 pt-8 sm:px-6 [&>*:not(:first-child)]:relative [&>*:not(:first-child)]:z-10">
      {winner && <Confetti seed={match.number} />}

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-3 grid size-20 place-items-center rounded-[1.6rem] bg-surface shadow-card">
          <TitleIcon className={winner ? "size-10 text-hint dark:text-hint-bright" : "size-10 text-brand"} aria-hidden />
        </div>
        <h1 className="max-w-full break-words font-display text-4xl font-bold uppercase sm:text-6xl">
          {winner ? `${winner.displayName} wins!` : "It's a draw!"}
        </h1>
        <p className="mt-2 text-sm font-bold text-muted">{describeSettings(match.settings)}</p>
      </motion.div>

      <Card className="mt-6 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {[p1, p2].map((p, i) => (
            <div key={p.id} className={i === 1 ? "order-3 flex min-w-0 flex-col items-center gap-2" : "flex min-w-0 flex-col items-center gap-2"}>
              <PlayerAvatar avatar={p.avatar} color={p.color} size="md" active={winner?.id === p.id} />
              <span className="max-w-full truncate text-sm font-extrabold">{p.displayName}</span>
              <ScoreDisplay value={match.scores[p.id] ?? 0} className="text-4xl sm:text-5xl" />
            </div>
          ))}
          <span className="order-2 font-display text-lg font-bold text-muted">VS</span>
        </div>

        <div className="mt-5 divide-y divide-border border-t border-border">
          <StatRow label="Words solved" mine={`${s1.solved}/${match.totalRounds}`} theirs={`${s2.solved}/${match.totalRounds}`} better={compare(s1.solved, s2.solved, true)} />
          <StatRow label="Hints used" mine={String(s1.hintsUsed)} theirs={String(s2.hintsUsed)} better={compare(s1.hintsUsed, s2.hintsUsed, false)} />
          <StatRow label="Avg. guess time" mine={formatSeconds(s1.avgSolveMs)} theirs={formatSeconds(s2.avgSolveMs)} better={compare(s1.avgSolveMs, s2.avgSolveMs, false)} />
          <StatRow label="Wrong guesses" mine={String(s1.wrongGuesses)} theirs={String(s2.wrongGuesses)} better={compare(s1.wrongGuesses, s2.wrongGuesses, false)} />
        </div>
      </Card>

      <Card className="mt-4 grid grid-cols-2 gap-4 p-4 sm:p-5">
        {/* Each player's chain, coloured by how the OTHER player did on it. */}
        <ChainRecap owner={p1} words={result.chains[p1.id] ?? []} cards={match.boards[p2.id] ?? []} />
        <ChainRecap owner={p2} words={result.chains[p2.id] ?? []} cards={match.boards[p1.id] ?? []} />
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <Button size="xl" className="w-full" onClick={playAgain}>
          <RotateCcw className="size-6" aria-hidden /> Play again
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={backToSetup}>
            <Settings2 className="size-5" aria-hidden /> Change setup
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              quit();
              router.push("/play");
            }}
          >
            <Home className="size-5" aria-hidden /> Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
