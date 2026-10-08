"use client";

import { AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { DEFAULT_TIMINGS } from "@/constants/game";
import { haptics } from "@/lib/haptics";
import { useLocalGame } from "@/lib/local/local-game";
import { sound } from "@/lib/sound/sound-manager";
import { CountdownOverlay } from "../game/countdown-overlay";
import { GameSkeleton } from "../game/game-failure";
import { useGameEvents } from "../game/hooks/use-game-events";
import { ClockOffsetContext } from "../game/hooks/use-server-clock";
import { Handoff, LocalChain } from "./local-chain";
import { LocalBoard } from "./local-board";
import { LocalResults } from "./local-results";
import { LocalSetup } from "./local-setup";

/** Sounds and haptics for a shared screen: every guesser is "you". */
function useLocalFeedback() {
  useGameEvents((event) => {
    switch (event.type) {
      case "turn.start":
        sound.playTurnStart();
        haptics.tap();
        break;
      case "guess.result":
        if (event.correct) {
          sound.playCorrect();
          haptics.correct();
        } else {
          sound.playWrong();
          haptics.wrong();
        }
        break;
      case "hint.revealed":
        sound.playHint();
        haptics.hint();
        break;
      case "turn.timeout":
        sound.playTimerWarning();
        haptics.warning();
        break;
      case "game.complete":
        if (event.winnerId) {
          sound.playVictory();
          haptics.victory();
        } else {
          sound.playNotification();
        }
        break;
      default:
        break;
    }
  });
}

export function LocalGameClient() {
  const restored = useLocalGame((s) => s.restored);
  const restore = useLocalGame((s) => s.restore);
  const step = useLocalGame((s) => s.step);
  const players = useLocalGame((s) => s.players);
  const settings = useLocalGame((s) => s.settings);
  const view = useLocalGame((s) => s.view);
  const reveal = useLocalGame((s) => s.reveal);
  useLocalFeedback();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!restored) return <GameSkeleton label="Loading…" />;

  let screen: React.ReactNode;
  if (step.kind === "setup" || !settings) {
    screen = <LocalSetup />;
  } else if (step.kind === "handoff") {
    const player = players[step.seat];
    const other = players[step.seat === 0 ? 1 : 0];
    screen = (
      <Handoff
        key={`handoff-${step.seat}`}
        player={player}
        other={other}
        title={step.seat === 0 ? `${player.displayName} goes first` : `Pass the device to ${player.displayName}`}
        text={
          step.seat === 0
            ? `${player.displayName}, take the device and write your secret chain.`
            : `${players[0].displayName}'s chain is locked and hidden. ${player.displayName}, your turn to write.`
        }
        action={`I'm ${player.displayName} — let's write`}
        onContinue={() => reveal(step.seat)}
      />
    );
  } else if (step.kind === "chain") {
    screen = <LocalChain key={`chain-${step.seat}`} seat={step.seat} settings={settings} />;
  } else if (view?.phase === "PLAYING" && view.match) {
    screen = <LocalBoard view={view} />;
  } else if (view?.phase === "COMPLETE" && view.match?.result) {
    screen = <LocalResults view={view} />;
  } else {
    // Countdown: put the device where both players can see it.
    const first = view?.match?.turn ? players.find((p) => p.id === view.match!.turn!.guesserId) : null;
    screen = (
      <Handoff
        player={first ?? players[0]}
        other={players[1]}
        title="Both chains locked!"
        text="Put the device between you — guessing starts now."
      />
    );
  }

  return (
    <ClockOffsetContext.Provider value={0}>
      {screen}
      <AnimatePresence>
        {view?.phase === "COUNTDOWN" && view.countdownEndsAt && (
          <CountdownOverlay key="countdown" endsAt={view.countdownEndsAt} totalMs={DEFAULT_TIMINGS.countdownMs} />
        )}
      </AnimatePresence>
    </ClockOffsetContext.Provider>
  );
}
