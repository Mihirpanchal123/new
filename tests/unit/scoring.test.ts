import { describe, expect, it } from "vitest";
import { SCORING } from "@/constants/scoring";
import { calculateScore, potentialPoints } from "@/lib/game/scoring";

const slow = { elapsedMs: 30_000, turnMs: 30_000, wrongGuesses: 0 };

describe("calculateScore", () => {
  it("follows the 100 / 75 / 50 / 25 hint ladder (no speed bonus)", () => {
    expect(calculateScore({ ...slow, hintsUsed: 0 }).total).toBe(100);
    expect(calculateScore({ ...slow, hintsUsed: 1 }).total).toBe(75);
    expect(calculateScore({ ...slow, hintsUsed: 2 }).total).toBe(50);
    expect(calculateScore({ ...slow, hintsUsed: 3 }).total).toBe(25);
  });

  it("applies a small wrong-guess penalty but never drops below the minimum", () => {
    expect(calculateScore({ ...slow, hintsUsed: 0, wrongGuesses: 2 }).total).toBe(90);
    expect(calculateScore({ ...slow, hintsUsed: 4, wrongGuesses: 10 }).total).toBe(SCORING.minCorrectPoints);
  });

  it("awards a speed bonus that scales with remaining time", () => {
    expect(calculateScore({ hintsUsed: 0, wrongGuesses: 0, elapsedMs: 0, turnMs: 30_000 }).speedBonus).toBe(20);
    expect(calculateScore({ hintsUsed: 0, wrongGuesses: 0, elapsedMs: 15_000, turnMs: 30_000 }).speedBonus).toBe(10);
    expect(calculateScore({ hintsUsed: 0, wrongGuesses: 0, elapsedMs: 45_000, turnMs: 30_000 }).speedBonus).toBe(0);
  });

  it("honours a custom config", () => {
    const config = { ...SCORING, basePoints: 10, hintPenalty: 1, speedBonusMax: 0, minCorrectPoints: 0 };
    expect(calculateScore({ ...slow, hintsUsed: 2 }, config).total).toBe(8);
  });

  it("previews potential points for the hint button", () => {
    expect(potentialPoints(0, 0)).toBe(100);
    expect(potentialPoints(1, 1)).toBe(70);
  });
});
