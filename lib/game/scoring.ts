import { SCORING, type ScoringConfig } from "@/constants/scoring";

export interface ScoreInput {
  wrongGuesses: number;
  elapsedMs: number;
  turnMs: number;
}

export interface ScoreBreakdown {
  base: number;
  wrongPenalty: number;
  speedBonus: number;
  total: number;
}

/** Points for a correct guess. Skips are charged when they happen, not here. */
export function calculateScore(input: ScoreInput, config: ScoringConfig = SCORING): ScoreBreakdown {
  const wrong = Math.max(0, Math.floor(input.wrongGuesses));
  const wrongPenalty = wrong * config.wrongGuessPenalty;
  const afterPenalties = Math.max(config.minCorrectPoints, config.basePoints - wrongPenalty);

  const remaining = input.turnMs > 0 ? Math.max(0, 1 - input.elapsedMs / input.turnMs) : 0;
  const speedBonus = Math.round(remaining * config.speedBonusMax);

  return {
    base: config.basePoints,
    wrongPenalty,
    speedBonus,
    total: afterPenalties + speedBonus,
  };
}

/** What the guesser would score right now if they guessed correctly (ignores speed bonus). */
export function potentialPoints(wrongGuesses: number, config: ScoringConfig = SCORING): number {
  return Math.max(config.minCorrectPoints, config.basePoints - wrongGuesses * config.wrongGuessPenalty);
}
