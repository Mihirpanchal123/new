import type { GameEventEnvelope } from "@/types/realtime";

// ───────────── transient event bus (sounds, animations, toasts) ─────────────
// Fed by the socket for online games and by the local controller for one-screen games.

type Listener = (envelope: GameEventEnvelope) => void;
const listeners = new Set<Listener>();

export const gameEvents = {
  on(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emit(envelope: GameEventEnvelope) {
    for (const fn of listeners) fn(envelope);
  },
};
