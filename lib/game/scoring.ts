import { SCORING, type ScoringConfig } from "@/constants/scoring";

export interface ScoreInput {
  /** Letters revealed by hints (initial first letter excluded). */
  hintsUsed: number;
  wrongGuesses: number;
  elapsedMs: number;
  turnMs: number;
}

export interface ScoreBreakdown {
  base: number;
  hintPenalty: number;
  wrongPenalty: number;
  speedBonus: number;
  total: number;
}

/** Points for a correct guess. Failed words always score `failedPoints`. */
export function calculateScore(input: ScoreInput, config: ScoringConfig = SCORING): ScoreBreakdown {
  const hints = Math.max(0, Math.floor(input.hintsUsed));
  const wrong = Math.max(0, Math.floor(input.wrongGuesses));
  const hintPenalty = hints * config.hintPenalty;
  const wrongPenalty = wrong * config.wrongGuessPenalty;
  const afterPenalties = Math.max(config.minCorrectPoints, config.basePoints - hintPenalty - wrongPenalty);

  const remaining = input.turnMs > 0 ? Math.max(0, 1 - input.elapsedMs / input.turnMs) : 0;
  const speedBonus = Math.round(remaining * config.speedBonusMax);

  return {
    base: config.basePoints,
    hintPenalty,
    wrongPenalty,
    speedBonus,
    total: afterPenalties + speedBonus,
  };
}

/** What the guesser would score right now if they guessed correctly (ignores speed bonus). */
export function potentialPoints(hintsUsed: number, wrongGuesses: number, config: ScoringConfig = SCORING): number {
  return Math.max(
    config.minCorrectPoints,
    config.basePoints - hintsUsed * config.hintPenalty - wrongGuesses * config.wrongGuessPenalty,
  );
}
