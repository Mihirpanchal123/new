import type { ErrorCode } from "@/types/realtime";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "That didn't look right. Please try again.",
  INVALID_CHAIN: "Some of your words need a tweak.",
  ROOM_NOT_FOUND: "We couldn't find a game with that code.",
  ROOM_EXPIRED: "This game has expired. Start a new one!",
  ROOM_FULL: "This game already has two players.",
  GAME_IN_PROGRESS: "This duel has already started.",
  GAME_OVER: "This duel is already over.",
  NOT_IN_ROOM: "You're not part of this game.",
  NOT_YOUR_TURN: "Hang tight — it's not your turn.",
  INVALID_STATE: "That can't be done right now.",
  STALE: "The game moved on — refreshing.",
  TURN_EXPIRED: "Time's up for that word!",
  RATE_LIMITED: "Whoa, slow down a little!",
  OPPONENT_UNAVAILABLE: "Your opponent isn't around right now.",
  UNAUTHORIZED: "Your session expired. Refresh to continue.",
  SERVER_ERROR: "Something went wrong on our side.",
};

export class GameError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message?: string, fieldErrors?: Record<string, string>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "GameError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function friendlyMessage(code: ErrorCode): string {
  return DEFAULT_MESSAGES[code];
}
