/**
 * Words per chain, chosen per game. The first word is always visible; the
 * other N − 1 are the race: first player to crack them all wins.
 */
export const MIN_CHAIN_LENGTH = 4;
export const MAX_CHAIN_LENGTH = 8;
export const DEFAULT_CHAIN_LENGTH = 5;
export const CHAIN_LENGTH_OPTIONS = [4, 5, 6, 7, 8] as const;

/** Turn-timer presets in seconds. `null` (no timer) is offered alongside these. */
export const TURN_TIME_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
export const MIN_TURN_MS = 5_000;
export const MAX_TURN_MS = 300_000;

export interface GameSettings {
  /** Words per chain, MIN_CHAIN_LENGTH..MAX_CHAIN_LENGTH. */
  chainLength: number;
  /** Time per guessing turn, or null for untimed turns. */
  turnMs: number | null;
}

/** Words each player has to crack = every word but the visible first one. */
export const hiddenWordsFor = (chainLength: number) => chainLength - 1;

/** Consecutive timed-out turns (across both players) before an idle game is settled on points. */
export const MAX_IDLE_TURNS = 6;

export function describeSettings(s: GameSettings): string {
  return `${s.chainLength} words · ${s.turnMs === null ? "no timer" : `${Math.round(s.turnMs / 1000)}s turns`}`;
}

export const MAX_PLAYERS = 2;

export const WORD_MIN_LENGTH = 3;
export const WORD_MAX_LENGTH = 12;
export const GUESS_MAX_LENGTH = 20;

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 16;

/** Unambiguous characters only — no 0/O, 1/I/L. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Character used for hidden letters in plain-text masks. */
export const MASK_CHAR = "•";

/** Default timings in milliseconds. The server may override these via env. */
export const DEFAULT_TIMINGS = {
  /** Default time a player has to guess one word (each room can change it). */
  turnMs: 30_000,
  /** Pause after a turn resolves so both players can see the outcome. */
  resultMs: 2_600,
  /** "3, 2, 1, DUEL!" before the first turn. */
  countdownMs: 3_600,
  /** How long a disconnected player has to come back before forfeiting. */
  disconnectGraceMs: 60_000,
  /** Guesses arriving this long after the deadline are still accepted (network latency). */
  latencyGraceMs: 400,
  /** Below this, the timer enters its "low time" state. */
  lowTimeMs: 5_000,
} as const;

export type Timings = { [K in keyof typeof DEFAULT_TIMINGS]: number };

export const DEFAULT_SETTINGS: GameSettings = { chainLength: DEFAULT_CHAIN_LENGTH, turnMs: DEFAULT_TIMINGS.turnMs };

export const ROOM_TTL = {
  /** Remove rooms nobody has touched in this long. */
  idleMs: 3 * 60 * 60_000,
  /** Remove finished rooms after this long. */
  completedMs: 30 * 60_000,
  /** Remove rooms with nobody connected after this long. */
  abandonedMs: 10 * 60_000,
  /** Keep retired codes reserved so they are not immediately reused. */
  retiredCodeMs: 60 * 60_000,
} as const;
