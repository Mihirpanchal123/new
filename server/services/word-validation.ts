import { checkChain, WORD_ISSUE_MESSAGES } from "@/lib/validation/words";

/**
 * Pluggable extra checks — e.g. a dictionary API, semantic-relatedness model
 * or category rules. V1 ships none: a flaky validator must never make the game
 * unplayable, so extra validators should fail open.
 */
export interface ChainValidator {
  name: string;
  /** Return issue messages keyed by word index; empty object = all good. */
  validate(words: string[]): Promise<Record<number, string>> | Record<number, string>;
}

export interface ChainValidationResult {
  valid: boolean;
  words: string[];
  fieldErrors: Record<string, string>;
}

export class WordValidationService {
  constructor(private readonly validators: ChainValidator[] = []) {}

  async validateChain(rawWords: readonly string[]): Promise<ChainValidationResult> {
    const base = checkChain(rawWords);
    const fieldErrors: Record<string, string> = {};
    base.issues.forEach((issue, i) => {
      if (issue) fieldErrors[String(i)] = WORD_ISSUE_MESSAGES[issue];
    });

    if (base.valid) {
      for (const validator of this.validators) {
        try {
          const issues = await validator.validate(base.words);
          for (const [i, msg] of Object.entries(issues)) fieldErrors[i] ??= msg;
        } catch (err) {
          console.warn(`[word-validation] validator "${validator.name}" failed open`, err);
        }
      }
    }

    return { valid: Object.keys(fieldErrors).length === 0, words: base.words, fieldErrors };
  }
}
