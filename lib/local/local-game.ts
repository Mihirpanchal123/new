"use client";

import { create } from "zustand";
import { DEFAULT_TIMINGS, type GameSettings, hiddenWordsFor } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
import { gameEvents } from "@/lib/realtime/events";
import { GameEngine } from "@/server/game/engine";
import { GameError } from "@/server/game/errors";
import { maskedCard } from "@/server/game/serialize";
import type { ServerRoom } from "@/server/game/types";
import type {
  MatchResultView,
  PlayerView,
  PublicProfile,
  RoomPhase,
  TurnView,
  WordCardView,
} from "@/types/game";
import type { AckResult, GameEvent, GuessAckData, SkipAckData } from "@/types/realtime";

/**
 * One-screen ("pass and play") games. Runs the exact same GameEngine as the
 * server, but in the browser: no socket, no server, nothing recorded to
 * profiles. Both players share the screen, so every chain is shown masked —
 * nobody's secret words are ever displayed until they are guessed.
 */

export type Seat = 0 | 1;

export type LocalStep =
  | { kind: "setup" }
  | { kind: "handoff"; seat: Seat }
  | { kind: "chain"; seat: Seat }
  | { kind: "game" };

export interface LocalMatchView {
  id: string;
  number: number;
  settings: GameSettings;
  totalWords: number;
  turn: TurnView | null;
  /** Keyed by GUESSER id: the other player's chain, masked to what's been revealed. */
  boards: Record<string, WordCardView[]>;
  scores: Record<string, number>;
  result: MatchResultView | null;
}

export interface LocalView {
  version: number;
  phase: RoomPhase;
  /** Seat order. */
  players: [PlayerView, PlayerView];
  countdownEndsAt: number | null;
  match: LocalMatchView | null;
}

export const LOCAL_CODE = "LOCAL";
const STORAGE_KEY = "word-duel:local";
export const LOCAL_IDS = ["local-p1", "local-p2"] as const;

let idSeq = 0;
// crypto.randomUUID is missing on plain-http LAN addresses, so don't rely on it.
const localId = () => `local-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

const engine = new GameEngine({ timings: { ...DEFAULT_TIMINGS }, scoring: { ...SCORING }, idFactory: localId });

let timer: ReturnType<typeof setTimeout> | undefined;

interface LocalState {
  players: [PublicProfile, PublicProfile];
  settings: GameSettings | null;
  step: LocalStep;
  view: LocalView | null;
  restored: boolean;

  restore: () => void;
  start: (players: [PublicProfile, PublicProfile], settings: GameSettings) => void;
  reveal: (seat: Seat) => void;
  submitChain: (seat: Seat, words: string[]) => AckResult;
  guess: (turnId: number, guess: string) => Promise<AckResult<GuessAckData>>;
  skip: (turnId: number, expectedRevealed: number) => Promise<AckResult<SkipAckData>>;
  playAgain: () => void;
  backToSetup: () => void;
  quit: () => void;
}

/** The mutable engine room lives outside React state; `view` is its immutable snapshot. */
let room: ServerRoom | null = null;

export const useLocalGame = create<LocalState>()((set, get) => {
  function commit(events: GameEvent[]) {
    if (!room) return;
    const now = Date.now();
    room.version += 1;
    room.updatedAt = now;
    set({ view: toView(room) });
    for (const event of events) gameEvents.emit({ roomCode: LOCAL_CODE, version: room.version, event });
    persist();
    schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!room) return;
    const deadline = engine.nextDeadline(room);
    if (deadline === null) return;
    timer = setTimeout(tick, Math.max(0, deadline - Date.now()) + 5);
  }

  function tick() {
    timer = undefined;
    if (!room) return;
    const events = engine.tick(room, Date.now());
    if (events.length) commit(events);
    else schedule();
  }

  function persist() {
    try {
      const { players, settings, step } = get();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ players, settings, step, room }));
    } catch {
      /* private mode etc. — the game still works, it just won't survive a refresh */
    }
  }

  function run<T>(fn: (r: ServerRoom, now: number) => { events: GameEvent[]; data: T }): AckResult<T> {
    if (!room) return { ok: false, error: "INVALID_STATE", message: "No game in progress." };
    try {
      const { events, data } = fn(room, Date.now());
      commit(events);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof GameError) return { ok: false, error: err.code, message: err.message, fieldErrors: err.fieldErrors };
      console.error("[local-game]", err);
      return { ok: false, error: "SERVER_ERROR", message: "Something went wrong." };
    }
  }

  return {
    players: [
      { id: LOCAL_IDS[0], displayName: "Player 1", avatar: "rocket", color: "violet" },
      { id: LOCAL_IDS[1], displayName: "Player 2", avatar: "cat", color: "coral" },
    ],
    settings: null,
    step: { kind: "setup" },
    view: null,
    restored: false,

    restore() {
      if (get().restored) return;
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Pick<LocalState, "players" | "settings" | "step">> & { room?: ServerRoom | null }) : null;
        if (saved?.players && saved.step) {
          room = saved.room ?? null;
          set({ players: saved.players, settings: saved.settings ?? null, step: saved.step, view: room ? toView(room) : null });
          if (room) tick();
        }
      } catch {
        /* corrupt save — start fresh */
      }
      set({ restored: true });
    },

    start(players, settings) {
      const now = Date.now();
      room = engine.createGame(LOCAL_CODE, players[0], now, settings);
      engine.joinGame(room, players[1], now);
      engine.setPlayerReady(room, players[0].id, true, now);
      const events = engine.setPlayerReady(room, players[1].id, true, now);
      set({ players, settings, step: { kind: "handoff", seat: 0 } });
      commit(events);
    },

    reveal(seat) {
      set({ step: { kind: "chain", seat } });
      persist();
    },

    submitChain(seat, words) {
      const playerId = get().players[seat].id;
      const res = run((r, now) => ({ events: engine.submitChain(r, playerId, words, now), data: null }));
      if (res.ok) {
        set({ step: seat === 0 ? { kind: "handoff", seat: 1 } : { kind: "game" } });
        persist();
      }
      return res;
    },

    async guess(turnId, guess) {
      return run((r, now) => {
        const guesserId = r.match?.turn?.guesserId ?? "";
        return engine.submitGuess(r, guesserId, { turnId, guess }, now);
      });
    },

    async skip(turnId, expectedRevealed) {
      return run((r, now) => {
        const guesserId = r.match?.turn?.guesserId ?? "";
        return engine.skipTurn(r, guesserId, { turnId, expectedRevealed }, now);
      });
    },

    playAgain() {
      const [a, b] = get().players;
      const res = run((r, now) => ({
        events: [...engine.requestRematch(r, a.id, now), ...engine.respondRematch(r, b.id, true, now)],
        data: null,
      }));
      if (res.ok) {
        set({ step: { kind: "handoff", seat: 0 } });
        persist();
      }
    },

    backToSetup() {
      if (timer) clearTimeout(timer);
      room = null;
      set({ step: { kind: "setup" }, view: null });
      persist();
    },

    quit() {
      if (timer) clearTimeout(timer);
      room = null;
      set({ step: { kind: "setup" }, view: null });
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
});

function toView(r: ServerRoom): LocalView {
  const players = r.players.map(
    (p): PlayerView => ({
      id: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      color: p.color,
      isHost: p.id === r.hostId,
      ready: p.ready,
      connected: true,
      graceEndsAt: null,
      left: false,
      chainSubmitted: p.chain !== null,
    }),
  ) as [PlayerView, PlayerView];

  const m = r.match;
  const over = m?.result != null;
  return {
    version: r.version,
    phase: r.phase,
    players,
    countdownEndsAt: r.countdownEndsAt,
    match: m && {
      id: m.id,
      number: m.number,
      settings: { ...m.settings },
      totalWords: hiddenWordsFor(m.settings.chainLength),
      turn: m.turn && {
        id: m.turn.id,
        round: m.turn.round,
        guesserId: m.turn.guesserId,
        ownerId: m.turn.ownerId,
        position: m.turn.position,
        phase: m.turn.phase,
        startedAt: m.turn.startedAt,
        endsAt: m.turn.endsAt,
        resultEndsAt: m.turn.resultEndsAt,
        outcome: m.turn.outcome,
        recentGuesses: [...m.turn.recentGuesses],
      },
      boards: Object.fromEntries(Object.entries(m.boards).map(([id, board]) => [id, board.map((w) => maskedCard(w, over))])),
      scores: { ...m.scores },
      result: m.result && {
        winnerId: m.result.winnerId,
        endReason: m.result.endReason,
        stats: structuredClone(m.result.stats),
        chains: structuredClone(m.chains),
      },
    },
  };
}
