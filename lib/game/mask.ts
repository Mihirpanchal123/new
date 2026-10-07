import { MASK_CHAR } from "@/constants/game";

/**
 * Plain-text mask: getMaskedWord("banana", 2) → "BA••••".
 * Only ever call this on the server or with a word the viewer already owns.
 */
export function getMaskedWord(word: string, revealedLetterCount: number): string {
  const upper = word.toUpperCase();
  const shown = clampReveal(upper.length, revealedLetterCount);
  return upper.slice(0, shown) + MASK_CHAR.repeat(upper.length - shown);
}

/** Per-character mask — `null` for hidden letters. This is what goes over the wire. */
export function getMaskedLetters(word: string, revealedLetterCount: number): (string | null)[] {
  const upper = word.toUpperCase();
  const shown = clampReveal(upper.length, revealedLetterCount);
  return Array.from(upper, (ch, i) => (i < shown ? ch : null));
}

/** Render letters received from the server back into a text mask (for a11y labels). */
export function lettersToMask(letters: (string | null)[]): string {
  return letters.map((l) => l ?? MASK_CHAR).join("");
}

function clampReveal(length: number, revealed: number): number {
  if (!Number.isFinite(revealed)) return 0;
  return Math.max(0, Math.min(length, Math.floor(revealed)));
}
