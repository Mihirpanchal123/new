"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { useGameStore } from "@/stores/game-store";
import { ChainSetup } from "../lobby/chain-setup";
import { Lobby } from "../lobby/lobby";
import { ConnectionBanner } from "./connection-indicator";
import { CountdownOverlay, FlashBanner } from "./countdown-overlay";
import { GameBoard } from "./game-board";
import { GameFailure, GameSkeleton } from "./game-failure";
import { useGameEvents } from "./hooks/use-game-events";
import { useGameFeedback } from "./hooks/use-game-feedback";
import { useRoomConnection } from "./hooks/use-room-connection";
import { useVoiceChat } from "./hooks/use-voice-chat";
import { RematchDialog } from "./rematch-dialog";
import { ResultsScreen } from "./results-screen";

/**
 * Root of a game room. Picks the screen from the authoritative room phase;
 * never decides game rules itself.
 */
export function GameClient({ code }: { code: string }) {
  useRoomConnection(code);
  useGameFeedback();
  const room = useGameStore((s) => s.room);
  const failure = useGameStore((s) => s.failure);
  useVoiceChat(code, room?.code === code ? room.meId : null);
  const [flash, setFlash] = useState<number | null>(null);

  useGameEvents((e) => {
    if (e.type === "setup.start") {
      setFlash(Date.now());
      window.setTimeout(() => setFlash(null), 900);
    }
  });

  if (failure) return <GameFailure code={failure.code} message={failure.message} />;
  if (!room || room.code !== code) return <GameSkeleton />;
  if (room.phase === "CLOSED") {
    return <GameFailure code="ROOM_EXPIRED" message={room.closedReason ?? "This room has closed."} />;
  }

  return (
    <>
      <ConnectionBanner />
      {room.phase === "LOBBY" && <Lobby room={room} />}
      {(room.phase === "SETUP" || room.phase === "COUNTDOWN") && <ChainSetup room={room} />}
      {room.phase === "PLAYING" && room.match && <GameBoard room={room} />}
      {room.phase === "COMPLETE" && room.match?.result && <ResultsScreen room={room} />}

      <AnimatePresence>
        {room.phase === "COUNTDOWN" && room.countdownEndsAt && (
          <CountdownOverlay key="countdown" endsAt={room.countdownEndsAt} totalMs={room.countdownDurationMs} />
        )}
        {flash !== null && <FlashBanner key={flash} text="GO!" />}
      </AnimatePresence>
      <RematchDialog room={room} />
    </>
  );
}
