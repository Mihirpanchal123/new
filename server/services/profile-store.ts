import { randomUUID } from "node:crypto";
import {
  ACHIEVEMENT_IDS,
  COMEBACK_DEFICIT,
  SPEED_DEMON_AVG_MS,
  type AchievementId,
} from "@/constants/achievements";
import { HIDDEN_WORDS } from "@/constants/game";
import { AVATAR_COLOR_IDS, AVATAR_IDS, randomGuestName, type AvatarColor, type AvatarId } from "@/constants/profile";
import type {
  LeaderboardRow,
  LeaderboardScope,
  MatchRecord,
  PlayerStats,
  ProfileView,
  PublicProfile,
} from "@/types/game";
import type { PersistenceAdapter, Snapshot } from "./persistence";

export interface StoredProfile extends PublicProfile {
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  stats: PlayerStats;
  achievements: Partial<Record<AchievementId, number>>;
}

export interface ProfilePatch {
  displayName?: string;
  avatar?: AvatarId;
  color?: AvatarColor;
}

const MAX_MATCHES = 10_000;
const SAVE_DEBOUNCE_MS = 2_000;
const STALE_GUEST_MS = 30 * 24 * 60 * 60_000;

export function emptyStats(): PlayerStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalScore: 0,
    bestScore: 0,
    perfectGames: 0,
    hintsUsed: 0,
    wordsSolved: 0,
    wrongGuesses: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

/**
 * Profiles, stats, achievements and match history. In-memory, with an
 * optional snapshot via a PersistenceAdapter. No database required.
 */
export class ProfileStore {
  private profiles = new Map<string, StoredProfile>();
  /** Newest first. */
  private matches: MatchRecord[] = [];
  private matchIndex = new Map<string, MatchRecord>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly persistence: PersistenceAdapter,
    private readonly now: () => number = Date.now,
  ) {
    this.loadFromPersistence();
  }

  private loadFromPersistence() {
    const snapshot = this.persistence.load();
    if (!snapshot) return;
    const cutoff = this.now() - STALE_GUEST_MS;
    for (const p of snapshot.profiles) {
      // Drop guests who never played and haven't been seen in a month.
      if (p.stats.gamesPlayed === 0 && p.lastSeenAt < cutoff) continue;
      this.profiles.set(p.id, { ...p, stats: { ...emptyStats(), ...p.stats } });
    }
    this.matches = snapshot.matches.slice(0, MAX_MATCHES);
    for (const m of this.matches) this.matchIndex.set(m.id, m);
  }

  // ───────────── profiles ─────────────

  createGuest(id: string = randomUUID()): StoredProfile {
    const t = this.now();
    const profile: StoredProfile = {
      id,
      displayName: randomGuestName(),
      avatar: AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!,
      color: AVATAR_COLOR_IDS[Math.floor(Math.random() * AVATAR_COLOR_IDS.length)]!,
      createdAt: t,
      updatedAt: t,
      lastSeenAt: t,
      stats: emptyStats(),
      achievements: {},
    };
    this.profiles.set(id, profile);
    this.scheduleSave();
    return profile;
  }

  get(id: string): StoredProfile | undefined {
    return this.profiles.get(id);
  }

  /** Valid session but unknown profile (e.g. memory mode after restart) → recreate under the same id. */
  ensure(id: string): StoredProfile {
    return this.profiles.get(id) ?? this.createGuest(id);
  }

  update(id: string, patch: ProfilePatch): StoredProfile {
    const profile = this.ensure(id);
    if (patch.displayName !== undefined) profile.displayName = patch.displayName;
    if (patch.avatar !== undefined) profile.avatar = patch.avatar;
    if (patch.color !== undefined) profile.color = patch.color;
    profile.updatedAt = this.now();
    this.scheduleSave();
    return profile;
  }

  touch(id: string): void {
    const p = this.profiles.get(id);
    if (p) p.lastSeenAt = this.now();
  }

  toView(profile: StoredProfile): ProfileView {
    return {
      id: profile.id,
      displayName: profile.displayName,
      avatar: profile.avatar,
      color: profile.color,
      createdAt: profile.createdAt,
      stats: { ...profile.stats },
      achievements: { ...profile.achievements },
    };
  }

  // ───────────── matches ─────────────

  /**
   * Records a finished match, updates both players' stats and returns any
   * achievements newly unlocked, keyed by player id.
   */
  recordMatch(record: MatchRecord, maxDeficit: Record<string, number>): Record<string, AchievementId[]> {
    if (this.matchIndex.has(record.id)) return {};
    this.matches.unshift(record);
    this.matchIndex.set(record.id, record);
    if (this.matches.length > MAX_MATCHES) {
      for (const old of this.matches.splice(MAX_MATCHES)) this.matchIndex.delete(old.id);
    }

    const unlocked: Record<string, AchievementId[]> = {};
    for (const player of record.players) {
      const profile = this.ensure(player.id);
      const s = profile.stats;
      const won = record.winnerId === player.id;
      const draw = record.winnerId === null;
      const perfect = player.stats.solved === HIDDEN_WORDS;

      s.gamesPlayed += 1;
      if (won) s.wins += 1;
      else if (draw) s.draws += 1;
      else s.losses += 1;
      s.currentStreak = won ? s.currentStreak + 1 : 0;
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      s.totalScore += player.score;
      s.bestScore = Math.max(s.bestScore, player.score);
      if (perfect) s.perfectGames += 1;
      s.hintsUsed += player.stats.hintsUsed;
      s.wordsSolved += player.stats.solved;
      s.wrongGuesses += player.stats.wrongGuesses;

      const fairWin = won && record.endReason === "COMPLETED";
      const checks: Record<AchievementId, boolean> = {
        FIRST_WIN: s.wins >= 1,
        NO_HINTS: fairWin && player.stats.hintsUsed === 0,
        PERFECT_CHAIN: perfect,
        SPEED_DEMON: perfect && player.stats.avgSolveMs !== null && player.stats.avgSolveMs < SPEED_DEMON_AVG_MS,
        COMEBACK: fairWin && (maxDeficit[player.id] ?? 0) >= COMEBACK_DEFICIT,
        HAT_TRICK: s.currentStreak >= 3,
        REGULAR: s.gamesPlayed >= 10,
        WORD_MASTER: s.wins >= 100,
      };
      const fresh = ACHIEVEMENT_IDS.filter((id) => checks[id] && !profile.achievements[id]);
      for (const id of fresh) profile.achievements[id] = record.playedAt;
      if (fresh.length) unlocked[player.id] = fresh;
      profile.updatedAt = this.now();
    }

    this.scheduleSave();
    return unlocked;
  }

  getMatch(id: string): MatchRecord | undefined {
    return this.matchIndex.get(id);
  }

  getHistory(playerId: string, limit = 20): MatchRecord[] {
    const out: MatchRecord[] = [];
    for (const m of this.matches) {
      if (m.players.some((p) => p.id === playerId)) out.push(m);
      if (out.length >= limit) break;
    }
    return out;
  }

  leaderboard(scope: LeaderboardScope, viewerId: string | null, limit = 50): LeaderboardRow[] {
    type Agg = { games: number; wins: number; score: number };
    const agg = new Map<string, Agg>();

    if (scope === "weekly" || scope === "monthly") {
      const days = scope === "weekly" ? 7 : 30;
      const since = this.now() - days * 24 * 60 * 60_000;
      for (const m of this.matches) {
        if (m.playedAt < since) break; // newest first
        for (const p of m.players) {
          const a = agg.get(p.id) ?? { games: 0, wins: 0, score: 0 };
          a.games += 1;
          a.score += p.score;
          if (m.winnerId === p.id) a.wins += 1;
          agg.set(p.id, a);
        }
      }
    } else {
      let allowed: Set<string> | null = null;
      if (scope === "friends") {
        allowed = new Set(viewerId ? [viewerId] : []);
        if (viewerId) {
          for (const m of this.matches) {
            if (m.players.some((p) => p.id === viewerId)) for (const p of m.players) allowed.add(p.id);
          }
        }
      }
      for (const p of this.profiles.values()) {
        if (p.stats.gamesPlayed === 0) continue;
        if (allowed && !allowed.has(p.id)) continue;
        agg.set(p.id, { games: p.stats.gamesPlayed, wins: p.stats.wins, score: p.stats.totalScore });
      }
    }

    const rows = [...agg.entries()]
      .map(([id, a]) => {
        const profile = this.profiles.get(id);
        if (!profile) return null;
        return {
          player: { id, displayName: profile.displayName, avatar: profile.avatar, color: profile.color },
          games: a.games,
          wins: a.wins,
          winRate: a.games ? a.wins / a.games : 0,
          score: a.score,
        };
      })
      .filter((r): r is Omit<LeaderboardRow, "rank"> => r !== null)
      .sort((x, y) => y.wins - x.wins || y.winRate - x.winRate || y.score - x.score);

    return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  counts() {
    return { profiles: this.profiles.size, matches: this.matches.length };
  }

  // ───────────── persistence ─────────────

  private scheduleSave() {
    if (this.persistence.kind === "memory" || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
    this.saveTimer.unref?.();
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const snapshot: Snapshot = {
      schema: 1,
      savedAt: this.now(),
      profiles: [...this.profiles.values()],
      matches: this.matches,
    };
    try {
      this.persistence.save(snapshot);
    } catch (err) {
      console.error("[profile-store] failed to save snapshot", err);
    }
  }
}
