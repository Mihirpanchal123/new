/**
 * Minimal, conservative blocklist. Matches whole normalized words, plus a
 * handful of roots that are never part of innocent words. Swap this out for a
 * proper service via WordValidationService if you need more coverage.
 */
const BLOCKED_WORDS = new Set([
  "fuck", "fucker", "fucking", "motherfucker", "shit", "shitty", "bullshit", "bitch", "bitches",
  "cunt", "asshole", "dick", "dickhead", "cock", "pussy", "twat", "wanker", "bastard", "slut",
  "whore", "fag", "faggot", "nigger", "nigga", "retard", "kike", "spic", "chink", "tranny",
  "dyke", "rape", "rapist", "nazi", "porn", "cum", "dildo", "jizz", "prick",
]);

const BLOCKED_ROOTS = ["fuck", "faggot", "motherf"];

export function isProfane(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return false;
  if (BLOCKED_WORDS.has(w)) return true;
  return BLOCKED_ROOTS.some((root) => w.includes(root));
}

export function containsProfanity(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((part) => part && isProfane(part));
}
