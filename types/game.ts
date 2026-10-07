/**
 * Client-facing view types. Everything in this file may be sent to a browser,
 * so nothing here may ever carry an answer the viewer is not entitled to see.
 * Serialization lives in server/game/serialize.ts.
 */
import type { AchievementId } from "@/constants/achievements";
import type { AvatarColor, AvatarId } from "@/constants/profile";

export type RoomPhase =
  | "LOBBY" // waiting for players / ready-up
  | "SETUP" // both players building their chains
  | "COUNTDOWN" // 3, 2, 1, DUEL!
  | "PLAYING" // alternating turns
  | "COMPLETE" // results + rematch
  | "CLOSED"; // room is gone

export type TurnPhase = "GUESSING" | "RESULT";

export type WordStatus =
  | "GIVEN" // first word, always visible
  | "LOCKED" // not reached yet — first letter only
  | "ACTIVE" // currently being guessed
  | "SOLVED"
  | "FAILED"; // timed out or fully revealed by hints

export type TurnOutcome = "SOLVED" | "REVEALED" | "TIMEOUT";

export type EndReason = "COMPLETED" | "FORFEIT";

export interface PublicProfile {
  id: string;
  displayName: string;
  avatar: AvatarId;
  color: AvatarColor;
}

export interface PlayerView extends PublicProfile {
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  /** When the reconnection grace period ends, if disconnected. */
  graceEndsAt: number | null;
  left: boolean;
  chainSubmitted: boolean;
}

export interface WordCardView {
  position: number;
  length: number;
  /** One entry per character. `null` = still hidden from the guesser. */
  letters: (string | null)[];
  /** How many letters the guesser can see. */
  revealedCount: number;
  status: WordStatus;
  hintsUsed: number;
  wrongGuesses: number;
  points: number;
}

export interface TurnView {
  id: number;
  round: number;
  guesserId: string;
  ownerId: string;
  position: number;
  phase: TurnPhase;
  startedAt: number;
  endsAt: number;
  resultEndsAt: number | null;
  outcome: TurnOutcome | null;
  /** Wrong guesses made this turn (visible to both players — makes spectating fun). */
  recentGuesses: string[];
}

export interface PlayerMatchStats {
  score: number;
  solved: number;
  failed: number;
  hintsUsed: number;
  wrongGuesses: number;
  avgSolveMs: number | null;
  fastestSolveMs: number | null;
}

export interface MatchResultView {
  winnerId: string | null;
  endReason: EndReason;
  stats: Record<string, PlayerMatchStats>;
  /** Both full chains — safe once the match is over. */
  chains: Record<string, string[]>;
}

export interface MatchView {
  id: string;
  number: number;
  totalRounds: number;
  firstPlayerId: string;
  turn: TurnView | null;
  /** The opponent's chain, as I (the guesser) am allowed to see it. */
  opponentBoard: WordCardView[];
  /** My own chain, with the opponent's progress against it. Letters are always full. */
  myBoard: WordCardView[];
  scores: Record<string, number>;
  result: MatchResultView | null;
}

export interface RoomView {
  /** Monotonic per room; clients ignore snapshots older than what they have. */
  version: number;
  serverNow: number;
  code: string;
  phase: RoomPhase;
  meId: string;
  hostId: string;
  players: PlayerView[];
  countdownEndsAt: number | null;
  /** My own submitted words (only ever my own). */
  myChain: string[] | null;
  match: MatchView | null;
  rematch: { requestedBy: string } | null;
  turnDurationMs: number;
  countdownDurationMs: number;
  closedReason: string | null;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalScore: number;
  bestScore: number;
  perfectGames: number;
  hintsUsed: number;
  wordsSolved: number;
  wrongGuesses: number;
  currentStreak: number;
  bestStreak: number;
}

export interface ProfileView extends PublicProfile {
  createdAt: number;
  stats: PlayerStats;
  achievements: Partial<Record<AchievementId, number>>;
}

export interface MatchWordRecord {
  word: string;
  position: number;
  outcome: TurnOutcome;
  points: number;
  hints: number;
  wrong: number;
  timeMs: number;
}

export interface MatchRecordPlayer extends PublicProfile {
  score: number;
  /** The chain this player created. */
  chain: string[];
  stats: PlayerMatchStats;
  /** How this player did guessing the opponent's words. */
  words: MatchWordRecord[];
}

export interface MatchRecord {
  id: string;
  roomCode: string;
  playedAt: number;
  durationMs: number;
  endReason: EndReason;
  winnerId: string | null;
  players: [MatchRecordPlayer, MatchRecordPlayer];
}

export type LeaderboardScope = "global" | "friends" | "weekly" | "monthly";

export interface LeaderboardRow {
  rank: number;
  player: PublicProfile;
  games: number;
  wins: number;
  winRate: number;
  score: number;
}
