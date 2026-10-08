"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { selectMe, selectOpponent } from "@/stores/game-store";
import type { RoomView } from "@/types/game";
import { ConnectionIndicator } from "./connection-indicator";
import { GameStatus, OpponentPresenceBanner } from "./game-status";
import { GuessBar, onlineGuessActions } from "./guess-bar";
import { useGameEvents } from "./hooks/use-game-events";
import { PlayerHeader } from "./player-header";
import { RoundIndicator, Timer } from "./timer";
import { VoiceControl } from "./voice-control";
import { WordChain, type Celebration } from "./word-chain";

type View = "theirs" | "mine";

export function GameBoard({ room }: { room: RoomView }) {
  const match = room.match!;
  const me = selectMe(room)!;
  const opponent = selectOpponent(room)!;
  const turn = match.turn;
  const isMyTurn = turn?.guesserId === me.id;
  const actions = useMemo(() => onlineGuessActions(room.code), [room.code]);

  // Mobile shows one chain at a time and follows the turn; the user can peek at the other.
  const [view, setView] = useState<View>(isMyTurn ? "theirs" : "mine");
  const [followedTurn, setFollowedTurn] = useState(turn?.id);
  if (turn?.id !== followedTurn) {
    setFollowedTurn(turn?.id);
    setView(isMyTurn ? "theirs" : "mine");
  }

  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [shake, setShake] = useState({ theirs: 0, mine: 0 });
  const [spotlight, setSpotlight] = useState<number | null>(null);

  useGameEvents((event) => {
    if (event.type === "guess.result") {
      const mine = event.guesserId === me.id;
      if (event.correct) {
        setCelebration({ key: Date.now(), position: event.position, points: event.points });
        window.setTimeout(() => setCelebration(null), 1300);
      } else {
        setShake((s) => (mine ? { ...s, theirs: s.theirs + 1 } : { ...s, mine: s.mine + 1 }));
      }
    }
    if (event.type === "turn.start" && event.guesserId === me.id) {
      setSpotlight(event.turnId);
      window.setTimeout(() => setSpotlight(null), 1100);
    }
  });

  const theirCard = turn && isMyTurn ? match.opponentBoard[turn.position] ?? null : null;
  const resolvedCard = turn ? (isMyTurn ? match.opponentBoard : match.myBoard)[turn.position] ?? null : null;
  const activeTheirs = turn && isMyTurn ? turn.position : null;
  const activeMine = turn && !isMyTurn ? turn.position : null;
  const celebrationTheirs = celebration && isMyTurn ? celebration : null;
  const celebrationMine = celebration && !isMyTurn ? celebration : null;

  const theirsPanel = (
    <section aria-labelledby="theirs-title" className={cn("transition-opacity", !isMyTurn && "lg:opacity-60")}>
      <h2 id="theirs-title" className="mb-2 hidden text-sm font-extrabold uppercase tracking-wider text-muted lg:block">
        {opponent.displayName}&apos;s chain · you guess
      </h2>
      <WordChain
        label={`${opponent.displayName}'s chain`}
        cards={match.opponentBoard}
        activePosition={activeTheirs}
        celebration={celebrationTheirs}
        shakeKey={shake.theirs}
      />
    </section>
  );

  const minePanel = (
    <section aria-labelledby="mine-title" className={cn("transition-opacity", isMyTurn && "lg:opacity-60")}>
      <h2 id="mine-title" className="mb-2 hidden text-sm font-extrabold uppercase tracking-wider text-muted lg:block">
        Your chain · {opponent.displayName} guesses
      </h2>
      <WordChain
        label="Your chain"
        owner
        cards={match.myBoard}
        activePosition={activeMine}
        celebration={celebrationMine}
        shakeKey={shake.mine}
        liveGuesses={turn && !isMyTurn ? turn.recentGuesses : undefined}
      />
    </section>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="flex flex-col gap-3 px-4 pt-3 sm:px-6 sm:pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Duel · {room.code}</span>
          <div className="flex items-center gap-1.5">
            <VoiceControl opponentName={opponent.displayName} />
            <ConnectionIndicator />
          </div>
        </div>
        <PlayerHeader me={me} opponent={opponent} scores={match.scores} activeId={turn?.guesserId ?? null} />
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-3 py-2 backdrop-blur">
          <RoundIndicator round={turn?.round ?? match.totalRounds} total={match.totalRounds} />
          <Timer
            endsAt={turn?.phase === "GUESSING" ? turn.endsAt : null}
            durationMs={match.settings.turnMs ?? 0}
            untimed={match.settings.turnMs === null}
            paused={turn?.phase !== "GUESSING"}
            audible={isMyTurn}
          />
        </div>
        <GameStatus turn={turn} meId={me.id} opponentName={opponent.displayName} resolvedCard={resolvedCard} />
        <OpponentPresenceBanner opponent={opponent} />
      </header>

      <main className="flex-1 px-4 pb-4 pt-2 sm:px-6">
        {/* Mobile / tablet: one chain at a time */}
        <div className="lg:hidden">
          <div role="tablist" aria-label="Chains" className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
            {(["theirs", "mine"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "h-10 rounded-xl text-sm font-extrabold transition-colors",
                  view === v ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {v === "theirs" ? `${opponent.displayName}'s chain` : "Your chain"}
                {((v === "theirs" && isMyTurn) || (v === "mine" && !isMyTurn)) && (
                  <span className="ml-1.5 inline-block size-2 rounded-full bg-brand align-middle" aria-label="(active)" />
                )}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, x: view === "theirs" ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: view === "theirs" ? 16 : -16 }}
              transition={{ duration: 0.18 }}
            >
              {view === "theirs" ? theirsPanel : minePanel}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop: both chains side by side */}
        <div className="hidden gap-8 lg:grid lg:grid-cols-2">
          {theirsPanel}
          {minePanel}
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:px-6">
        <div className="mx-auto max-w-xl">
          <GuessBar
            actions={actions}
            turn={turn}
            card={theirCard}
            isMyTurn={isMyTurn}
            opponentName={opponent.displayName}
          />
        </div>
      </div>

      <AnimatePresence>
        {spotlight !== null && (
          <motion.div
            key={spotlight}
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
              className="rounded-3xl bg-brand px-8 py-4 font-display text-4xl font-bold text-brand-ink shadow-pop"
            >
              Your turn!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
