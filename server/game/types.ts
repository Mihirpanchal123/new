import type { GameSettings } from "@/constants/game";
import type {
  EndReason,
  PlayerMatchStats,
  PublicProfile,
  RoomPhase,
  TurnOutcome,
  TurnPhase,
  WordStatus,
} from "@/types/game";

/** Server-only state. Never serialize these objects directly to a client. */

export interface ServerPlayer extends PublicProfile {
  joinedAt: number;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  /** Explicitly left / forfeited; kept so results can still show them. */
  left: boolean;
  /** Normalized, validated, locked-in chain. SECRET. */
  chain: string[] | null;
}

export interface BoardWord {
  position: number;
  /** SECRET until solved / failed / match over. */
  answer: string;
  revealed: number;
  status: WordStatus;
  hints: number;
  wrong: number;
  points: number;
  guesses: string[];
  /** Time spent on this word's turn, set when it resolves. */
  timeMs: number;
  outcome: TurnOutcome | null;
}

export interface ServerTurn {
  id: number;
  /** 0-based index into the overall turn sequence. */
  index: number;
  round: number;
  guesserId: string;
  ownerId: string;
  position: number;
  phase: TurnPhase;
  startedAt: number;
  /** null when the room plays untimed turns. */
  endsAt: number | null;
  resultEndsAt: number | null;
  outcome: TurnOutcome | null;
  recentGuesses: string[];
}

export interface ServerMatchResult {
  winnerId: string | null;
  endReason: EndReason;
  stats: Record<string, PlayerMatchStats>;
}

export interface ServerMatch {
  id: string;
  number: number;
  /** Settings frozen when the match started. */
  settings: GameSettings;
  startedAt: number;
  completedAt: number | null;
  /** [first guesser, second guesser] */
  order: [string, string];
  turnSeq: number;
  turn: ServerTurn | null;
  /** Keyed by GUESSER id: the opponent's chain they are working through. */
  boards: Record<string, BoardWord[]>;
  /** Keyed by OWNER id. SECRET. */
  chains: Record<string, string[]>;
  scores: Record<string, number>;
  /** Largest amount each player trailed by at any point (for COMEBACK). */
  maxDeficit: Record<string, number>;
  result: ServerMatchResult | null;
}

export interface ServerRoom {
  id: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  phase: RoomPhase;
  hostId: string;
  /** Chosen by the host in the lobby; applies to the next match. */
  settings: GameSettings;
  players: ServerPlayer[];
  countdownEndsAt: number | null;
  match: ServerMatch | null;
  /** Matches started in this room (drives who goes first). */
  matchCount: number;
  rematch: { requestedBy: string } | null;
  closedReason: string | null;
  completedAt: number | null;
}
