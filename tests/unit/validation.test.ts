import { describe, expect, it } from "vitest";
import { displayNameSchema, roomCodeSchema } from "@/lib/validation/schemas";
import { checkChain, checkWord, normalizeGuess, normalizeWord } from "@/lib/validation/words";
import { WordValidationService } from "@/server/services/word-validation";

describe("word normalization", () => {
  it("trims and lowercases", () => {
    expect(normalizeWord("  CoFFee ")).toBe("coffee");
  });

  it("rejects bad words with specific reasons", () => {
    expect(checkWord("")).toBe("EMPTY");
    expect(checkWord("ab")).toBe("TOO_SHORT");
    expect(checkWord("a".repeat(13))).toBe("TOO_LONG");
    expect(checkWord("ice cream")).toBe("INVALID_CHARACTERS");
    expect(checkWord("r2d2")).toBe("INVALID_CHARACTERS");
    expect(checkWord("shit")).toBe("PROFANITY");
    expect(checkWord("planet")).toBeNull();
  });

  it("flags duplicates within a chain", () => {
    const res = checkChain(["sun", "moon", "SUN", "star", "sky"]);
    expect(res.valid).toBe(false);
    expect(res.issues[2]).toBe("DUPLICATE");
  });

  it("accepts a good chain and normalizes it", () => {
    const res = checkChain([" Coffee", "BEAN", "plant", "farm", "market "]);
    expect(res.valid).toBe(true);
    expect(res.words).toEqual(["coffee", "bean", "plant", "farm", "market"]);
  });

  it("normalizes guesses loosely", () => {
    expect(normalizeGuess(" Bean ")).toBe("bean");
    expect(normalizeGuess("ice cream")).toBe("icecream");
    expect(normalizeGuess("12")).toBeNull();
    expect(normalizeGuess("")).toBeNull();
  });
});

describe("WordValidationService", () => {
  it("returns field errors keyed by index", async () => {
    const svc = new WordValidationService();
    const res = await svc.validateChain(["sun", "", "moon", "moon", "x"]);
    expect(res.valid).toBe(false);
    expect(Object.keys(res.fieldErrors).sort()).toEqual(["1", "3", "4"]);
  });

  it("runs pluggable validators and fails open when they throw", async () => {
    const svc = new WordValidationService([
      { name: "boom", validate: () => { throw new Error("offline"); } },
      { name: "no-cats", validate: (w) => (w.includes("cat") ? { [w.indexOf("cat")]: "No cats." } : {}) },
    ]);
    const ok = await svc.validateChain(["dog", "bone", "meat", "steak", "grill"]);
    expect(ok.valid).toBe(true);
    const bad = await svc.validateChain(["dog", "cat", "milk", "cow", "farm"]);
    expect(bad.fieldErrors["1"]).toBe("No cats.");
  });
});

describe("schemas", () => {
  it("validates room codes", () => {
    expect(roomCodeSchema.safeParse("a7k9p").success).toBe(true);
    expect(roomCodeSchema.parse(" a7k9p ")).toBe("A7K9P");
    expect(roomCodeSchema.safeParse("A7K9").success).toBe(false);
    expect(roomCodeSchema.safeParse("A0K9P").success).toBe(false); // 0 is not in the alphabet
  });

  it("validates display names", () => {
    expect(displayNameSchema.safeParse("Swift Otter").success).toBe(true);
    expect(displayNameSchema.safeParse("x").success).toBe(false);
    expect(displayNameSchema.safeParse("<script>").success).toBe(false);
  });
});
