export const ACHIEVEMENT_IDS = [
  "FIRST_WIN",
  "NO_HINTS",
  "PERFECT_CHAIN",
  "SPEED_DEMON",
  "COMEBACK",
  "HAT_TRICK",
  "REGULAR",
  "WORD_MASTER",
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  /** Lucide icon name rendered by the UI. */
  icon: "trophy" | "eye-off" | "link" | "zap" | "trending-up" | "flame" | "users" | "crown";
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  FIRST_WIN: { id: "FIRST_WIN", title: "First Blood", description: "Win your first duel.", icon: "trophy" },
  NO_HINTS: { id: "NO_HINTS", title: "Mind Reader", description: "Win without skipping a turn.", icon: "eye-off" },
  PERFECT_CHAIN: { id: "PERFECT_CHAIN", title: "Perfect Chain", description: "Solve every word in a duel.", icon: "link" },
  SPEED_DEMON: { id: "SPEED_DEMON", title: "Speed Demon", description: "Solve every word, averaging under 8 seconds.", icon: "zap" },
  COMEBACK: { id: "COMEBACK", title: "Comeback Kid", description: "Win after trailing by 50+ points.", icon: "trending-up" },
  HAT_TRICK: { id: "HAT_TRICK", title: "Hat Trick", description: "Win three duels in a row.", icon: "flame" },
  REGULAR: { id: "REGULAR", title: "Regular", description: "Play 10 duels.", icon: "users" },
  WORD_MASTER: { id: "WORD_MASTER", title: "Word Master", description: "Win 100 duels.", icon: "crown" },
};

export const SPEED_DEMON_AVG_MS = 8_000;
export const COMEBACK_DEFICIT = 50;
