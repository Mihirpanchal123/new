"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLocalGame, type LocalView } from "@/lib/local/local-game";
import { cn } from "@/lib/utils";
import { GameStatus } from "../game/game-status";
import { GuessBar, type GuessActions } from "../game/guess-bar";
import { useGameEvents } from "../game/hooks/use-game-events";
import { PlayerHeader } from "../game/player-header";
import { RaceProgress, solvedCount, Timer } from "../game/timer";
import { WordChain, type Celebration } from "../game/word-chain";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";

/**
 * Shared-screen board. Both chains are always shown masked (exactly what the
 * guesser is allowed to see), so nothing secret appears while players sit
 * side by side.
 */
export function LocalBoard({ view }: { view: LocalView }) {
  const match = view.match!;
  const [p1, p2] = view.players;
  const turn = match.turn;
  const guesser = view.players.find((p) => p.id === turn?.guesserId) ?? p1;
  const owner = guesser.id === p1.id ? p2 : p1;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.displayName ?? "Player";

  const guess = useLocalGame((s) => s.guess);
  const skip = useLocalGame((s) => s.skip);
  const quit = useLocalGame((s) => s.quit);
  const actions = useMemo<GuessActions>(() => ({ guess, skip }), [guess, skip]);

  // Mobile shows one chain; it follows the turn, and players can peek at the other.
  const [viewing, setViewing] = useState(guesser.id);
  const [followedTurn, setFollowedTurn] = useState(turn?.id);
  if (turn?.id !== followedTurn) {
    setFollowedTurn(turn?.id);
    setViewing(guesser.id);
  }

  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [spotlight, setSpotlight] = useState<{ key: number; id: string } | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!confirmQuit) return;
    const id = window.setTimeout(() => setConfirmQuit(false), 3000);
    return () => window.clearTimeout(id);
  }, [confirmQuit]);

  useGameEvents((event) => {
    if (event.type === "guess.result") {
      if (event.correct) {
        setCelebration({ key: Date.now(), position: event.position, points: event.points });
        window.setTimeout(() => setCelebration(null), 1300);
      } else {
        setShakeKey((k) => k + 1);
      }
    }
    if (event.type === "turn.start") {
      setSpotlight({ key: event.turnId, id: event.guesserId });
      window.setTimeout(() => setSpotlight(null), 1100);
    }
  });

  const activeCard = turn ? match.boards[guesser.id]?.[turn.position] ?? null : null;
  const spotlightPlayer = spotlight ? view.players.find((p) => p.id === spotlight.id) : null;

  // Board keyed by guesser: p1 cracks p2's chain and vice versa.
  const panel = (guesserId: string) => {
    const g = view.players.find((p) => p.id === guesserId)!;
    const o = g.id === p1.id ? p2 : p1;
    const isActive = turn?.guesserId === g.id;
    return (
      <section aria-label={`${o.displayName}'s chain, guessed by ${g.displayName}`} className={cn("transition-opacity", !isActive && "lg:opacity-60")}>
        <h2 className="mb-2 hidden items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted lg:flex">
          <PlayerAvatar avatar={g.avatar} color={g.color} size="xs" />
          <span className="truncate">
            {o.displayName}&apos;s chain · {g.displayName} guesses
          </span>
        </h2>
        <WordChain
          label={`${o.displayName}'s chain`}
          cards={match.boards[g.id] ?? []}
          activePosition={isActive && turn ? turn.position : null}
          celebration={isActive ? celebration : null}
          shakeKey={isActive ? shakeKey : 0}
        />
      </section>
    );
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="flex flex-col gap-3 px-4 pt-3 sm:px-6 sm:pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-muted">One screen</span>
          <Button variant={confirmQuit ? "danger" : "ghost"} size="sm" onClick={() => (confirmQuit ? quit() : setConfirmQuit(true))}>
            <X className="size-4" aria-hidden />
            {confirmQuit ? "Tap again to quit" : "Quit"}
          </Button>
        </div>
        <PlayerHeader me={p1} opponent={p2} scores={match.scores} activeId={turn?.guesserId ?? null} showYou={false} />
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-3 py-2 backdrop-blur">
          <RaceProgress
            total={match.totalWords}
            racers={view.players.map((p) => ({ name: p.displayName, solved: solvedCount(match.boards[p.id] ?? []) }))}
          />
          <Timer
            endsAt={turn?.phase === "GUESSING" ? turn.endsAt : null}
            durationMs={match.settings.turnMs ?? 0}
            paused={turn?.phase !== "GUESSING"}
            untimed={match.settings.turnMs === null}
            audible
          />
        </div>
        <GameStatus turn={turn} meId={guesser.id} opponentName={owner.displayName} resolvedCard={activeCard} nameOf={nameOf} />
      </header>

      <main className="flex-1 px-4 pb-4 pt-2 sm:px-6">
        <div className="lg:hidden">
          <div role="tablist" aria-label="Chains" className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
            {view.players.map((g) => {
              const o = g.id === p1.id ? p2 : p1;
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={viewing === g.id}
                  onClick={() => setViewing(g.id)}
                  className={cn(
                    "h-10 truncate rounded-xl px-2 text-sm font-extrabold transition-colors",
                    viewing === g.id ? "bg-surface text-ink shadow-sm" : "text-muted",
                  )}
                >
                  {o.displayName}&apos;s chain
                  {turn?.guesserId === g.id && (
                    <span className="ml-1.5 inline-block size-2 rounded-full bg-brand align-middle" aria-label="(active)" />
                  )}
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewing}
              initial={{ opacity: 0, x: viewing === p1.id ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: viewing === p1.id ? 16 : -16 }}
              transition={{ duration: 0.18 }}
            >
              {panel(viewing)}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hidden gap-8 lg:grid lg:grid-cols-2">
          {panel(p1.id)}
          {panel(p2.id)}
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:px-6">
        <div className="mx-auto max-w-xl">
          <GuessBar
            actions={actions}
            turn={turn}
            card={turn?.phase === "GUESSING" ? activeCard : null}
            isMyTurn
            opponentName={owner.displayName}
            guesserName={guesser.displayName}
          />
        </div>
      </div>

      <AnimatePresence>
        {spotlight && spotlightPlayer && (
          <motion.div
            key={spotlight.key}
            aria-hidden
            className="pointer-events-none fixed inset-0 z-30 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="flex max-w-[90vw] items-center gap-3 rounded-3xl bg-brand px-6 py-4 font-display text-3xl font-bold text-brand-ink shadow-pop sm:px-8 sm:text-4xl"
            >
              <PlayerAvatar avatar={spotlightPlayer.avatar} color={spotlightPlayer.color} size="sm" />
              <span className="truncate">{spotlightPlayer.displayName}&apos;s turn!</span>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
