/**
 * Typed Socket.IO contracts shared by client and server.
 *
 * Model: the server pushes a full, per-viewer `room:state` snapshot after
 * every change (the single source of truth) plus `game:event`s that drive
 * transient feedback — sounds, animations, toasts. Clients never derive game
 * state from events; they only react to them.
 */
import type { AchievementId } from "@/constants/achievements";
import type { EndReason, PublicProfile, RoomView, TurnOutcome } from "./game";

export type GameEvent =
  | { type: "room.created"; code: string }
  | { type: "room.joined"; player: PublicProfile }
  | { type: "player.left"; playerId: string }
  | { type: "player.ready"; playerId: string; ready: boolean }
  | { type: "setup.start" }
  | { type: "chain.submitted"; playerId: string }
  | { type: "chain.unlocked"; playerId: string }
  | { type: "game.countdown"; endsAt: number }
  | { type: "game.start"; matchId: string; firstPlayerId: string }
  | { type: "turn.start"; turnId: number; round: number; guesserId: string; position: number; endsAt: number }
  | {
      type: "guess.result";
      turnId: number;
      guesserId: string;
      position: number;
      guess: string;
      correct: boolean;
      points: number;
    }
  | {
      type: "hint.revealed";
      turnId: number;
      guesserId: string;
      position: number;
      index: number;
      letter: string;
      revealedCount: number;
    }
  | { type: "turn.timeout"; turnId: number; guesserId: string; position: number }
  | {
      type: "turn.complete";
      turnId: number;
      guesserId: string;
      position: number;
      outcome: TurnOutcome;
      points: number;
      word: string;
    }
  | { type: "score.updated"; scores: Record<string, number> }
  | { type: "game.complete"; matchId: string; winnerId: string | null; endReason: EndReason }
  | { type: "rematch.requested"; playerId: string }
  | { type: "rematch.accepted" }
  | { type: "rematch.declined"; playerId: string }
  | { type: "rematch.cancelled"; playerId: string }
  | { type: "player.disconnected"; playerId: string; graceEndsAt: number }
  | { type: "player.reconnected"; playerId: string }
  | { type: "achievement.unlocked"; playerId: string; achievements: AchievementId[] }
  | { type: "room.closed"; reason: string };

export type GameEventType = GameEvent["type"];

/** Envelope so clients can order events against snapshots. */
export interface GameEventEnvelope {
  roomCode: string;
  version: number;
  event: GameEvent;
}

export const ERROR_CODES = [
  "INVALID_INPUT",
  "INVALID_CHAIN",
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED",
  "ROOM_FULL",
  "GAME_IN_PROGRESS",
  "GAME_OVER",
  "NOT_IN_ROOM",
  "NOT_YOUR_TURN",
  "INVALID_STATE",
  "STALE",
  "TURN_EXPIRED",
  "RATE_LIMITED",
  "OPPONENT_UNAVAILABLE",
  "UNAUTHORIZED",
  "SERVER_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type AckResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export type Ack<T = null> = (result: AckResult<T>) => void;

export interface GuessAckData {
  correct: boolean;
  duplicate: boolean;
  points: number;
}

export interface HintAckData {
  revealedCount: number;
  letter: string;
  exhausted: boolean;
}

export interface ClientToServerEvents {
  "room:create": (payload: Record<string, never>, ack: Ack<{ code: string }>) => void;
  "room:join": (payload: { code: string }, ack: Ack<RoomView>) => void;
  /** Stop watching a room (navigated away). Not a forfeit. */
  "room:unwatch": (payload: { code: string }) => void;
  /** Explicit leave. Mid-match this forfeits. */
  "room:leave": (payload: { code: string }, ack: Ack) => void;
  "player:ready": (payload: { code: string; ready: boolean }, ack: Ack) => void;
  "chain:submit": (payload: { code: string; words: string[] }, ack: Ack) => void;
  "chain:unlock": (payload: { code: string }, ack: Ack) => void;
  "guess:submit": (
    payload: { code: string; turnId: number; guess: string; actionId: string },
    ack: Ack<GuessAckData>,
  ) => void;
  "hint:request": (
    payload: { code: string; turnId: number; expectedRevealed: number; actionId: string },
    ack: Ack<HintAckData>,
  ) => void;
  "rematch:request": (payload: { code: string }, ack: Ack) => void;
  "rematch:respond": (payload: { code: string; accept: boolean }, ack: Ack) => void;
  "rematch:cancel": (payload: { code: string }, ack: Ack) => void;
  "clock:ping": (payload: { clientSentAt: number }, ack: (res: { serverNow: number; clientSentAt: number }) => void) => void;
}

export interface ServerToClientEvents {
  "room:state": (view: RoomView) => void;
  "game:event": (envelope: GameEventEnvelope) => void;
  /** Another tab/device took over this player's session. */
  "session:replaced": () => void;
}

export interface SocketData {
  playerId: string;
  watching: Set<string>;
  ip: string;
}
