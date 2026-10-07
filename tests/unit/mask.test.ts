import { describe, expect, it } from "vitest";
import { getMaskedLetters, getMaskedWord, lettersToMask } from "@/lib/game/mask";

describe("getMaskedWord", () => {
  it("reveals letters progressively", () => {
    expect(getMaskedWord("banana", 1)).toBe("B•••••");
    expect(getMaskedWord("banana", 2)).toBe("BA••••");
    expect(getMaskedWord("banana", 3)).toBe("BAN•••");
    expect(getMaskedWord("banana", 6)).toBe("BANANA");
  });

  it("clamps out-of-range reveal counts", () => {
    expect(getMaskedWord("bean", 99)).toBe("BEAN");
    expect(getMaskedWord("bean", -3)).toBe("••••");
    expect(getMaskedWord("bean", Number.NaN)).toBe("••••");
  });

  it("produces null for hidden letters in the wire format", () => {
    expect(getMaskedLetters("bean", 2)).toEqual(["B", "E", null, null]);
    expect(lettersToMask(["B", null, null])).toBe("B••");
  });

  it("never leaks hidden characters", () => {
    const letters = getMaskedLetters("secret", 1);
    expect(letters.filter(Boolean).join("")).toBe("S");
  });
});
