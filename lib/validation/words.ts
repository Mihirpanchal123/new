import {
  GUESS_MAX_LENGTH,
  WORD_MAX_LENGTH,
  WORD_MIN_LENGTH,
} from "@/constants/game";
import { isProfane } from "./profanity";

/** Shared by client (instant feedback) and server (authoritative). */
export function normalizeWord(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

const LETTERS_ONLY = /^[a-z]+$/;

export type WordIssue =
  | "EMPTY"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARACTERS"
  | "PROFANITY"
  | "DUPLICATE";

export const WORD_ISSUE_MESSAGES: Record<WordIssue, string> = {
  EMPTY: "Enter a word.",
  TOO_SHORT: `Use at least ${WORD_MIN_LENGTH} letters.`,
  TOO_LONG: `Keep it to ${WORD_MAX_LENGTH} letters or fewer.`,
  INVALID_CHARACTERS: "Letters A–Z only — no spaces, numbers or symbols.",
  PROFANITY: "Let's keep it friendly — pick another word.",
  DUPLICATE: "You already used this word.",
};

export function checkWord(normalized: string): WordIssue | null {
  if (!normalized) return "EMPTY";
  if (!LETTERS_ONLY.test(normalized)) return "INVALID_CHARACTERS";
  if (normalized.length < WORD_MIN_LENGTH) return "TOO_SHORT";
  if (normalized.length > WORD_MAX_LENGTH) return "TOO_LONG";
  if (isProfane(normalized)) return "PROFANITY";
  return null;
}

export interface ChainCheck {
  words: string[];
  /** Issue per index, or null when that word is fine. */
  issues: (WordIssue | null)[];
  valid: boolean;
}

/** Checks exactly `length` words (missing entries count as empty). */
export function checkChain(rawWords: readonly string[], length: number = rawWords.length): ChainCheck {
  const words = Array.from({ length }, (_, i) => normalizeWord(rawWords[i] ?? ""));
  const seen = new Set<string>();
  const issues = words.map((w) => {
    const issue = checkWord(w);
    if (issue) return issue;
    if (seen.has(w)) return "DUPLICATE" as const;
    seen.add(w);
    return null;
  });
  return { words, issues, valid: issues.every((i) => i === null) };
}

/** Guesses are looser than chain words: any letters, bounded length. */
export function normalizeGuess(raw: string): string | null {
  const g = normalizeWord(raw).replace(/\s+/g, "");
  if (!g || g.length > GUESS_MAX_LENGTH || !LETTERS_ONLY.test(g)) return null;
  return g;
}
