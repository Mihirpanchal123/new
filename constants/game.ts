/** Number of words in every chain. The first word is always visible. */
export const CHAIN_LENGTH = 5;

/** Words the opponent actually has to guess — one per round. */
export const HIDDEN_WORDS = CHAIN_LENGTH - 1;

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
  /** Time a player has to guess one word. */
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
