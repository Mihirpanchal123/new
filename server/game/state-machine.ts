import type { RoomPhase } from "@/types/game";
import { GameError } from "./errors";
import type { ServerRoom } from "./types";

/**
 * Every legal room phase transition. Anything not listed is rejected, so a
 * bug elsewhere can't silently put a room into an impossible state.
 */
export const TRANSITIONS: Readonly<Record<RoomPhase, readonly RoomPhase[]>> = {
  LOBBY: ["SETUP", "CLOSED"],
  SETUP: ["COUNTDOWN", "LOBBY", "CLOSED"],
  COUNTDOWN: ["PLAYING", "COMPLETE", "LOBBY", "CLOSED"],
  PLAYING: ["COMPLETE", "CLOSED"],
  COMPLETE: ["SETUP", "CLOSED"],
  CLOSED: [],
};

export function canTransition(from: RoomPhase, to: RoomPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(room: ServerRoom, to: RoomPhase): void {
  if (!canTransition(room.phase, to)) {
    throw new GameError("INVALID_STATE", `Illegal transition ${room.phase} → ${to}`);
  }
  room.phase = to;
}

export function assertPhase(room: ServerRoom, ...phases: RoomPhase[]): void {
  if (!phases.includes(room.phase)) {
    if (room.phase === "CLOSED") throw new GameError("ROOM_EXPIRED");
    throw new GameError("INVALID_STATE");
  }
}
