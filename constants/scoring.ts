/**
 * Scoring model. Every number the game awards comes from here — never
 * hardcode points in UI or engine code.
 *
 *   correct, first letter only   → 100
 *   correct after 1 hint         →  75
 *   correct after 2 hints        →  50
 *   correct after 3 hints        →  25
 *   fully revealed / timed out   →   0
 *
 * Wrong guesses shave a little off (never below `minCorrectPoints`), and a
 * small speed bonus rewards quick solves.
 */
export const SCORING = {
  basePoints: 100,
  hintPenalty: 25,
  wrongGuessPenalty: 5,
  minCorrectPoints: 10,
  speedBonusMax: 20,
  failedPoints: 0,
} as const;

export type ScoringConfig = { [K in keyof typeof SCORING]: number };
