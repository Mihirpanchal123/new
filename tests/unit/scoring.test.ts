import { describe, expect, it } from "vitest";
import { SCORING } from "@/constants/scoring";
import { calculateScore, potentialPoints } from "@/lib/game/scoring";

const slow = { elapsedMs: 30_000, turnMs: 30_000, wrongGuesses: 0 };

describe("calculateScore", () => {
  it("awards full base points for a clean solve (no speed bonus)", () => {
    expect(calculateScore(slow).total).toBe(SCORING.basePoints);
  });

  it("applies a small wrong-guess penalty but never drops below the minimum", () => {
    expect(calculateScore({ ...slow, wrongGuesses: 2 }).total).toBe(90);
    expect(calculateScore({ ...slow, wrongGuesses: 50 }).total).toBe(SCORING.minCorrectPoints);
  });

  it("awards a speed bonus that scales with remaining time", () => {
    expect(calculateScore({ wrongGuesses: 0, elapsedMs: 0, turnMs: 30_000 }).speedBonus).toBe(20);
    expect(calculateScore({ wrongGuesses: 0, elapsedMs: 15_000, turnMs: 30_000 }).speedBonus).toBe(10);
    expect(calculateScore({ wrongGuesses: 0, elapsedMs: 45_000, turnMs: 30_000 }).speedBonus).toBe(0);
  });

  it("honours a custom config", () => {
    const config = { ...SCORING, basePoints: 10, wrongGuessPenalty: 1, speedBonusMax: 0, minCorrectPoints: 0 };
    expect(calculateScore({ ...slow, wrongGuesses: 2 }, config).total).toBe(8);
  });

  it("previews potential points for the guess bar", () => {
    expect(potentialPoints(0)).toBe(100);
    expect(potentialPoints(2)).toBe(90);
  });
});
