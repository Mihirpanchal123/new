export interface RateRule {
  /** Bucket size — how many actions can burst at once. */
  capacity: number;
  /** Tokens added back per second. */
  refillPerSec: number;
}

export const RATE_RULES = {
  createRoom: { capacity: 5, refillPerSec: 5 / 60 },
  joinRoom: { capacity: 20, refillPerSec: 20 / 60 },
  guess: { capacity: 8, refillPerSec: 4 },
  hint: { capacity: 4, refillPerSec: 2 },
  rematch: { capacity: 6, refillPerSec: 6 / 60 },
  chain: { capacity: 15, refillPerSec: 15 / 60 },
  ready: { capacity: 20, refillPerSec: 2 },
  profile: { capacity: 20, refillPerSec: 20 / 60 },
  session: { capacity: 30, refillPerSec: 30 / 60 },
  general: { capacity: 40, refillPerSec: 10 },
} satisfies Record<string, RateRule>;

export type RateAction = keyof typeof RATE_RULES;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** In-memory token buckets. Swap for Redis when running multiple instances. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Returns true if allowed (and consumes a token). */
  consume(action: RateAction, key: string, cost = 1): boolean {
    const rule = RATE_RULES[action];
    const id = `${action}:${key}`;
    const t = this.now();
    const bucket = this.buckets.get(id) ?? { tokens: rule.capacity, updatedAt: t };
    const elapsed = Math.max(0, t - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(rule.capacity, bucket.tokens + elapsed * rule.refillPerSec);
    bucket.updatedAt = t;
    const allowed = bucket.tokens >= cost;
    if (allowed) bucket.tokens -= cost;
    this.buckets.set(id, bucket);
    return allowed;
  }

  /** Drop buckets that have fully refilled. */
  prune(): void {
    const t = this.now();
    for (const [id, bucket] of this.buckets) {
      if (t - bucket.updatedAt > 10 * 60_000) this.buckets.delete(id);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
