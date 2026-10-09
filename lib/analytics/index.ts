/**
 * Vendor-neutral analytics. Code calls `track()`; providers decide where the
 * event goes. Add a provider (PostHog, Plausible, Segment…) by implementing
 * `AnalyticsProvider` and registering it — no call sites change.
 */
export const ANALYTICS_EVENTS = [
  "game_created",
  "game_joined",
  "game_started",
  "word_submitted",
  "guess_submitted",
  "guess_correct",
  "guess_wrong",
  "turn_skipped",
  "game_completed",
  "rematch_requested",
  "rematch_accepted",
  "player_disconnected",
  "result_shared",
  "room_shared",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsProvider {
  name: string;
  track(event: AnalyticsEvent, props: AnalyticsProps): void;
}

export const consoleProvider: AnalyticsProvider = {
  name: "console",
  track(event, props) {
    console.info(`[analytics] ${event}`, props);
  },
};

export class Analytics {
  private providers: AnalyticsProvider[] = [];

  register(provider: AnalyticsProvider): this {
    this.providers.push(provider);
    return this;
  }

  track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
    for (const p of this.providers) {
      try {
        p.track(event, props);
      } catch {
        // Analytics must never break gameplay.
      }
    }
  }
}

export function createAnalytics(providerName: string | undefined): Analytics {
  const analytics = new Analytics();
  if (providerName === "console") analytics.register(consoleProvider);
  return analytics;
}
