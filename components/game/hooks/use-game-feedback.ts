"use client";

import { toast } from "sonner";
import { ACHIEVEMENTS } from "@/constants/achievements";
import { haptics } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { useGameStore } from "@/stores/game-store";
import { useUiStore } from "@/stores/ui-store";
import { useGameEvents } from "./use-game-events";

/**
 * Turns server events into sound, haptics and compact toasts. Purely
 * presentational — game state comes from snapshots, not from here.
 */
export function useGameFeedback() {
  useGameEvents((event) => {
    const room = useGameStore.getState().room;
    if (!room) return;
    const me = room.meId;
    const nameOf = (id: string) => room.players.find((p) => p.id === id)?.displayName ?? "Your opponent";
    const notify = useUiStore.getState().notificationsEnabled;

    switch (event.type) {
      case "room.joined":
        if (event.player.id !== me) {
          sound.playJoin();
          if (notify) toast(`${event.player.displayName} joined!`, { icon: "👋" });
        }
        break;
      case "player.ready":
        if (event.playerId !== me && event.ready) sound.playNotification();
        break;
      case "setup.start":
        sound.playGo();
        break;
      case "turn.start":
        if (event.guesserId === me) {
          sound.playTurnStart();
          haptics.tap();
        }
        break;
      case "guess.result":
        if (event.guesserId === me) {
          if (event.correct) {
            sound.playCorrect();
            haptics.correct();
          } else {
            sound.playWrong();
            haptics.wrong();
          }
        } else if (event.correct) {
          sound.playNotification();
        }
        break;
      case "hint.revealed":
        if (event.guesserId === me) {
          sound.playHint();
          haptics.hint();
        }
        break;
      case "turn.timeout":
        if (event.guesserId === me) {
          sound.playTimerWarning();
          haptics.warning();
        }
        break;
      case "game.complete": {
        if (event.winnerId === me) {
          sound.playVictory();
          haptics.victory();
        } else if (event.winnerId === null) {
          sound.playNotification();
        } else {
          sound.playDefeat();
        }
        break;
      }
      case "rematch.requested":
        if (event.playerId !== me) sound.playRematch();
        break;
      case "rematch.declined":
        if (event.playerId !== me) toast(`${nameOf(event.playerId)} passed on a rematch.`);
        break;
      case "rematch.cancelled":
        if (event.playerId !== me && room.phase === "COMPLETE") toast(`${nameOf(event.playerId)} withdrew the rematch.`);
        break;
      case "player.disconnected":
        if (event.playerId !== me && notify) toast.warning(`${nameOf(event.playerId)} disconnected`, { id: `presence-${event.playerId}` });
        break;
      case "player.reconnected":
        if (event.playerId !== me && notify) toast.success(`${nameOf(event.playerId)} reconnected`, { id: `presence-${event.playerId}` });
        break;
      case "player.left":
        if (event.playerId !== me) toast(`${nameOf(event.playerId)} left the room.`, { id: `presence-${event.playerId}` });
        break;
      case "achievement.unlocked":
        if (event.playerId === me) {
          for (const id of event.achievements) {
            toast.success(`Achievement unlocked: ${ACHIEVEMENTS[id].title}`, {
              description: ACHIEVEMENTS[id].description,
              icon: "🏆",
              duration: 4000,
            });
          }
        }
        break;
      default:
        break;
    }
  });
}
