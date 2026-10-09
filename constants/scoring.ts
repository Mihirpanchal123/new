/**
 * Scoring model. Every number the game awards comes from here — never
 * hardcode points in UI or engine code.
 *
 *   correct guess                → 100
 *   −5 per distinct wrong guess (never below `minCorrectPoints`)
 *   + a small speed bonus for quick solves (timed games only)
 *
 * Skipping a turn reveals one more letter and costs `skipPenalty` straight
 * off your score (which can go below zero). Points don't decide the winner —
 * the first to crack the whole chain does — they're the stakes.
 */
export const SCORING = {
  basePoints: 100,
  skipPenalty: 25,
  wrongGuessPenalty: 5,
  minCorrectPoints: 10,
  speedBonusMax: 20,
} as const;

export type ScoringConfig = { [K in keyof typeof SCORING]: number };
