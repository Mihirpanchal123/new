import { DEFAULT_CHAIN_LENGTH, type GameSettings, MAX_IDLE_TURNS, MAX_PLAYERS, type Timings } from "@/constants/game";
import type { ScoringConfig } from "@/constants/scoring";
import { calculateScore } from "@/lib/game/scoring";
import { normalizeGuess } from "@/lib/validation/words";
import type { PlayerMatchStats, PublicProfile, TurnOutcome } from "@/types/game";
import type { GameEvent, GuessAckData, SkipAckData } from "@/types/realtime";
import { GameError } from "./errors";
import { assertPhase, transition } from "./state-machine";
import type { BoardWord, ServerMatch, ServerPlayer, ServerRoom, ServerTurn } from "./types";

const defaultId = () => globalThis.crypto.randomUUID();

export interface EngineOptions {
  timings: Timings;
  scoring: ScoringConfig;
  idFactory?: () => string;
}

export interface ActionResult<T> {
  events: GameEvent[];
  data: T;
}

/**
 * All game rules live here. Methods mutate the given room and return the
 * events that happened. The engine has no timers and no I/O — time is always
 * passed in — which makes every rule deterministic and unit-testable.
 * RoomManager owns scheduling, persistence hooks and broadcasting.
 */
export class GameEngine {
  readonly timings: Timings;
  readonly scoring: ScoringConfig;
  private readonly newId: () => string;

  constructor(opts: EngineOptions) {
    this.timings = opts.timings;
    this.scoring = opts.scoring;
    this.newId = opts.idFactory ?? defaultId;
  }

  defaultSettings(): GameSettings {
    return { chainLength: DEFAULT_CHAIN_LENGTH, turnMs: this.timings.turnMs };
  }

  // ───────────────────────────── Rooms ─────────────────────────────

  createGame(code: string, host: PublicProfile, now: number, settings?: GameSettings): ServerRoom {
    return {
      id: this.newId(),
      code,
      createdAt: now,
      updatedAt: now,
      version: 1,
      phase: "LOBBY",
      hostId: host.id,
      settings: { ...(settings ?? this.defaultSettings()) },
      players: [newPlayer(host, now)],
      countdownEndsAt: null,
      match: null,
      matchCount: 0,
      rematch: null,
      closedReason: null,
      completedAt: null,
    };
  }

  /** Join, or re-join if already a member (reconnects are just joins). */
  joinGame(room: ServerRoom, profile: PublicProfile, now: number): GameEvent[] {
    const existing = findPlayer(room, profile.id);
    if (existing && !existing.left) {
      return this.setConnected(room, profile.id, true, now);
    }
    if (room.phase === "CLOSED") throw new GameError("ROOM_EXPIRED");
    if (room.phase === "COMPLETE") throw new GameError("GAME_OVER");
    if (room.phase !== "LOBBY") throw new GameError("GAME_IN_PROGRESS");
    const active = room.players.filter((p) => !p.left);
    if (active.length >= MAX_PLAYERS) throw new GameError("ROOM_FULL");

    room.players = room.players.filter((p) => p.id !== profile.id);
    room.players.push(newPlayer(profile, now));
    return [{ type: "room.joined", player: toPublic(profile) }];
  }

  updateProfile(room: ServerRoom, profile: PublicProfile): GameEvent[] {
    const player = findPlayer(room, profile.id);
    if (!player) return [];
    player.displayName = profile.displayName;
    player.avatar = profile.avatar;
    player.color = profile.color;
    return [];
  }

  setConnected(room: ServerRoom, playerId: string, connected: boolean, now: number): GameEvent[] {
    const player = findPlayer(room, playerId);
    if (!player || player.left || player.connected === connected) return [];
    player.connected = connected;
    if (connected) {
      player.disconnectedAt = null;
      return [{ type: "player.reconnected", playerId }];
    }
    player.disconnectedAt = now;
    return [{ type: "player.disconnected", playerId, graceEndsAt: now + this.timings.disconnectGraceMs }];
  }

  leaveGame(room: ServerRoom, playerId: string, now: number): GameEvent[] {
    const player = requirePlayer(room, playerId);
    const events: GameEvent[] = [{ type: "player.left", playerId }];

    switch (room.phase) {
      case "LOBBY":
      case "SETUP":
      case "COUNTDOWN": {
        // No match has started — just free the seat.
        room.players = room.players.filter((p) => p.id !== playerId);
        room.countdownEndsAt = null;
        if (room.players.length === 0) {
          return [...events, ...this.close(room, "Everyone left the room.")];
        }
        for (const p of room.players) {
          p.ready = false;
          p.chain = null;
        }
        if (room.hostId === playerId) room.hostId = room.players[0]!.id;
        if (room.phase !== "LOBBY") transition(room, "LOBBY");
        return events;
      }
      case "PLAYING": {
        player.left = true;
        player.connected = false;
        const opponent = otherPlayer(room, playerId);
        events.push(...this.completeGame(room, now, "FORFEIT", opponent?.id ?? null));
        return events;
      }
      case "COMPLETE": {
        player.left = true;
        player.connected = false;
        if (room.rematch) {
          room.rematch = null;
          events.push({ type: "rematch.cancelled", playerId });
        }
        if (room.players.every((p) => p.left)) events.push(...this.close(room, "Everyone left the room."));
        return events;
      }
      default:
        throw new GameError("ROOM_EXPIRED");
    }
  }

  // ───────────────────────────── Lobby & setup ─────────────────────────────

  /** Host-only, lobby-only. Un-readies everyone so both players agree to the new rules. */
  updateSettings(room: ServerRoom, playerId: string, settings: GameSettings): GameEvent[] {
    assertPhase(room, "LOBBY");
    requirePlayer(room, playerId);
    if (room.hostId !== playerId) throw new GameError("INVALID_STATE", "Only the host can change the game settings.");
    if (room.settings.chainLength === settings.chainLength && room.settings.turnMs === settings.turnMs) return [];
    room.settings = { chainLength: settings.chainLength, turnMs: settings.turnMs };
    for (const p of room.players) p.ready = false;
    return [{ type: "settings.updated", settings: { ...room.settings }, by: playerId }];
  }

  setPlayerReady(room: ServerRoom, playerId: string, ready: boolean, now: number): GameEvent[] {
    assertPhase(room, "LOBBY");
    const player = requirePlayer(room, playerId);
    if (player.ready === ready) return [];
    player.ready = ready;
    const events: GameEvent[] = [{ type: "player.ready", playerId, ready }];

    const active = activePlayers(room);
    if (active.length === MAX_PLAYERS && active.every((p) => p.ready)) {
      events.push(...this.startSetup(room, now));
    }
    return events;
  }

  private startSetup(room: ServerRoom, now: number): GameEvent[] {
    transition(room, "SETUP");
    room.match = null;
    room.rematch = null;
    room.countdownEndsAt = null;
    room.updatedAt = now;
    for (const p of room.players) p.chain = null;
    return [{ type: "setup.start" }];
  }

  /** `words` must already be validated & normalized by WordValidationService. */
  submitChain(room: ServerRoom, playerId: string, words: string[], now: number): GameEvent[] {
    assertPhase(room, "SETUP");
    const player = requirePlayer(room, playerId);
    if (player.chain) throw new GameError("INVALID_STATE", "Your chain is already locked in.");
    if (words.length !== room.settings.chainLength) {
      throw new GameError("INVALID_CHAIN", `This game uses ${room.settings.chainLength} words per chain.`);
    }
    player.chain = [...words];
    const events: GameEvent[] = [{ type: "chain.submitted", playerId }];

    const active = activePlayers(room);
    if (active.length === MAX_PLAYERS && active.every((p) => p.chain)) {
      transition(room, "COUNTDOWN");
      room.countdownEndsAt = now + this.timings.countdownMs;
      events.push({ type: "game.countdown", endsAt: room.countdownEndsAt });
    }
    return events;
  }

  unlockChain(room: ServerRoom, playerId: string): GameEvent[] {
    assertPhase(room, "SETUP");
    const player = requirePlayer(room, playerId);
    if (!player.chain) return [];
    player.chain = null;
    return [{ type: "chain.unlocked", playerId }];
  }

  startGame(room: ServerRoom, now: number): GameEvent[] {
    assertPhase(room, "COUNTDOWN");
    const [a, b] = activePlayers(room);
    if (!a?.chain || !b?.chain) throw new GameError("INVALID_STATE");

    // Alternate who opens each match in a room.
    const order: [string, string] = room.matchCount % 2 === 0 ? [a.id, b.id] : [b.id, a.id];
    room.matchCount += 1;
    room.countdownEndsAt = null;

    room.match = {
      id: this.newId(),
      number: room.matchCount,
      settings: { ...room.settings },
      startedAt: now,
      completedAt: null,
      order,
      turnSeq: 0,
      turn: null,
      idleTurns: 0,
      boards: { [a.id]: buildBoard(b.chain), [b.id]: buildBoard(a.chain) },
      chains: { [a.id]: [...a.chain], [b.id]: [...b.chain] },
      scores: { [a.id]: 0, [b.id]: 0 },
      maxDeficit: { [a.id]: 0, [b.id]: 0 },
      result: null,
    };
    transition(room, "PLAYING");

    return [
      { type: "game.start", matchId: room.match.id, firstPlayerId: order[0] },
      ...this.startTurn(room, 0, now),
    ];
  }

  // ───────────────────────────── Turns ─────────────────────────────

  private startTurn(room: ServerRoom, index: number, now: number): GameEvent[] {
    const match = requireMatch(room);
    const round = Math.floor(index / MAX_PLAYERS) + 1;
    const guesserId = match.order[index % MAX_PLAYERS]!;
    const ownerId = match.order[(index + 1) % MAX_PLAYERS]!;
    // Each player works down the chain in order; a skipped word stays theirs until solved.
    const word = (match.boards[guesserId] ?? []).find((w) => w.status !== "GIVEN" && w.status !== "SOLVED");
    if (!word) throw new GameError("INVALID_STATE");
    const position = word.position;
    word.status = "ACTIVE";

    match.turnSeq += 1;
    match.turn = {
      id: match.turnSeq,
      index,
      round,
      guesserId,
      ownerId,
      position,
      phase: "GUESSING",
      startedAt: now,
      endsAt: match.settings.turnMs === null ? null : now + match.settings.turnMs,
      resultEndsAt: null,
      outcome: null,
      recentGuesses: [],
    };
    return [{ type: "turn.start", turnId: match.turnSeq, round, guesserId, position, endsAt: match.turn.endsAt }];
  }

  private requireGuessingTurn(room: ServerRoom, playerId: string, turnId: number, now: number) {
    assertPhase(room, "PLAYING");
    requirePlayer(room, playerId);
    const match = requireMatch(room);
    const turn = match.turn;
    if (!turn || turn.guesserId !== playerId) throw new GameError("NOT_YOUR_TURN");
    if (turn.id !== turnId || turn.phase !== "GUESSING") throw new GameError("STALE");
    if (turn.endsAt !== null && now > turn.endsAt + this.timings.latencyGraceMs) throw new GameError("TURN_EXPIRED");
    return { match, turn, word: boardWord(match, playerId, turn.position) };
  }

  submitGuess(
    room: ServerRoom,
    playerId: string,
    input: { turnId: number; guess: string },
    now: number,
  ): ActionResult<GuessAckData> {
    const { match, turn, word } = this.requireGuessingTurn(room, playerId, input.turnId, now);
    const guess = normalizeGuess(input.guess);
    if (!guess) throw new GameError("INVALID_INPUT", "Letters only, please.");

    if (guess === word.answer) {
      // Untimed games have no speed bonus (turnMs 0).
      const { total } = calculateScore(
        {
          wrongGuesses: word.wrong,
          elapsedMs: turnTime(match, turn, now),
          turnMs: match.settings.turnMs ?? 0,
        },
        this.scoring,
      );
      const events: GameEvent[] = [
        { type: "guess.result", turnId: turn.id, guesserId: playerId, position: turn.position, guess, correct: true, points: total },
        ...this.resolveTurn(room, match, turn, word, "SOLVED", total, now),
      ];
      return { events, data: { correct: true, duplicate: false, points: total } };
    }

    // Repeating the same wrong guess is a no-op, not a second penalty.
    if (word.guesses.includes(guess)) {
      return { events: [], data: { correct: false, duplicate: true, points: 0 } };
    }
    word.wrong += 1;
    word.guesses.push(guess);
    turn.recentGuesses = [...turn.recentGuesses, guess].slice(-5);
    return {
      events: [
        { type: "guess.result", turnId: turn.id, guesserId: playerId, position: turn.position, guess, correct: false, points: 0 },
      ],
      data: { correct: false, duplicate: false, points: 0 },
    };
  }

  /**
   * Give up the turn: reveal the next letter of the current word, pay the skip
   * penalty, and hand the turn to the opponent. The word stays yours to solve.
   */
  skipTurn(
    room: ServerRoom,
    playerId: string,
    input: { turnId: number; expectedRevealed: number },
    now: number,
  ): ActionResult<SkipAckData> {
    const { match, turn, word } = this.requireGuessingTurn(room, playerId, input.turnId, now);
    // Guards against double-clicks and stale clients revealing two letters.
    if (input.expectedRevealed !== word.revealed) throw new GameError("STALE");
    if (word.revealed >= word.answer.length) {
      throw new GameError("INVALID_STATE", "Every letter is showing — type the word!");
    }

    const index = word.revealed;
    word.revealed += 1;
    word.hints += 1;
    const letter = word.answer[index]!.toUpperCase();
    const events: GameEvent[] = [
      {
        type: "hint.revealed",
        turnId: turn.id,
        guesserId: playerId,
        position: turn.position,
        index,
        letter,
        revealedCount: word.revealed,
      },
      ...this.resolveTurn(room, match, turn, word, "SKIPPED", -this.scoring.skipPenalty, now),
    ];
    return { events, data: { revealedCount: word.revealed, letter } };
  }

  handleTimeout(room: ServerRoom, now: number): GameEvent[] {
    const match = requireMatch(room);
    const turn = match.turn;
    if (!turn || turn.phase !== "GUESSING") return [];
    const word = boardWord(match, turn.guesserId, turn.position);
    return [
      { type: "turn.timeout", turnId: turn.id, guesserId: turn.guesserId, position: turn.position },
      ...this.resolveTurn(room, match, turn, word, "TIMEOUT", 0, now),
    ];
  }

  private resolveTurn(
    room: ServerRoom,
    match: ServerMatch,
    turn: ServerTurn,
    word: BoardWord,
    outcome: TurnOutcome,
    points: number,
    now: number,
  ): GameEvent[] {
    word.outcome = outcome;
    word.timeMs += turnTime(match, turn, now);
    if (outcome === "SOLVED") {
      word.status = "SOLVED";
      word.revealed = word.answer.length;
      word.points = points;
    }
    match.idleTurns = outcome === "TIMEOUT" ? (match.idleTurns ?? 0) + 1 : 0;

    turn.phase = "RESULT";
    turn.outcome = outcome;
    turn.resultEndsAt = now + this.timings.resultMs;

    match.scores[turn.guesserId] = (match.scores[turn.guesserId] ?? 0) + points;
    for (const id of match.order) {
      const opp = match.order.find((o) => o !== id)!;
      const deficit = (match.scores[opp] ?? 0) - (match.scores[id] ?? 0);
      match.maxDeficit[id] = Math.max(match.maxDeficit[id] ?? 0, deficit);
    }

    return [
      {
        type: "turn.complete",
        turnId: turn.id,
        guesserId: turn.guesserId,
        position: turn.position,
        outcome,
        points,
        // Unsolved words stay secret — this event goes to both players.
        word: outcome === "SOLVED" ? word.answer : null,
      },
      { type: "score.updated", scores: { ...match.scores } },
    ];
  }

  advanceTurn(room: ServerRoom, now: number): GameEvent[] {
    const match = requireMatch(room);
    const turn = match.turn;
    if (!turn || turn.phase !== "RESULT") return [];
    // First to crack the whole chain wins outright, whatever the score.
    const finished = (match.boards[turn.guesserId] ?? []).every((w) => w.status === "GIVEN" || w.status === "SOLVED");
    if (turn.outcome === "SOLVED" && finished) return this.completeGame(room, now, "COMPLETED", turn.guesserId);
    // Nobody is playing (e.g. both walked away from a timed game): settle it on points.
    if ((match.idleTurns ?? 0) >= MAX_IDLE_TURNS) return this.completeGame(room, now, "COMPLETED");
    return this.startTurn(room, turn.index + 1, now);
  }

  // ───────────────────────────── Completion ─────────────────────────────

  completeGame(
    room: ServerRoom,
    now: number,
    endReason: "COMPLETED" | "FORFEIT",
    /** Decided by the caller (race won, forfeit); omitted = settled on points. */
    decidedWinnerId?: string | null,
  ): GameEvent[] {
    assertPhase(room, "PLAYING");
    const match = requireMatch(room);

    // A forfeit mid-turn still counts the time spent on the open word.
    if (match.turn?.phase === "GUESSING") {
      boardWord(match, match.turn.guesserId, match.turn.position).timeMs += turnTime(match, match.turn, now);
    }
    match.turn = null;
    // Whatever wasn't cracked is missed; the record and recap show it in full.
    for (const board of Object.values(match.boards)) {
      for (const w of board) {
        if (w.status === "GIVEN" || w.status === "SOLVED") continue;
        w.status = "FAILED";
        w.revealed = w.answer.length;
      }
    }

    const [p1, p2] = match.order;
    const s1 = match.scores[p1] ?? 0;
    const s2 = match.scores[p2] ?? 0;
    const winnerId = decidedWinnerId !== undefined ? decidedWinnerId : s1 === s2 ? null : s1 > s2 ? p1 : p2;

    match.completedAt = now;
    match.result = {
      winnerId,
      endReason,
      stats: { [p1]: this.calculateStats(match, p1), [p2]: this.calculateStats(match, p2) },
    };
    room.completedAt = now;
    room.rematch = null;
    for (const p of room.players) p.ready = false;
    transition(room, "COMPLETE");

    return [{ type: "game.complete", matchId: match.id, winnerId, endReason }];
  }

  calculateStats(match: ServerMatch, playerId: string): PlayerMatchStats {
    const board = match.boards[playerId] ?? [];
    const hidden = board.filter((w) => w.status !== "GIVEN");
    const solved = hidden.filter((w) => w.status === "SOLVED");
    const solveTimes = solved.map((w) => w.timeMs);
    return {
      score: match.scores[playerId] ?? 0,
      solved: solved.length,
      failed: hidden.filter((w) => w.status === "FAILED").length,
      hintsUsed: hidden.reduce((n, w) => n + w.hints, 0),
      wrongGuesses: hidden.reduce((n, w) => n + w.wrong, 0),
      avgSolveMs: solveTimes.length ? Math.round(solveTimes.reduce((a, b) => a + b, 0) / solveTimes.length) : null,
      fastestSolveMs: solveTimes.length ? Math.min(...solveTimes) : null,
    };
  }

  // ───────────────────────────── Rematch ─────────────────────────────

  requestRematch(room: ServerRoom, playerId: string, now: number): GameEvent[] {
    assertPhase(room, "COMPLETE");
    requirePlayer(room, playerId);
    const opponent = otherPlayer(room, playerId);
    if (!opponent || opponent.left) throw new GameError("OPPONENT_UNAVAILABLE", "Your opponent has left the room.");

    if (room.rematch && room.rematch.requestedBy !== playerId) {
      // Both asked — that's a yes.
      return this.respondRematch(room, playerId, true, now);
    }
    if (room.rematch) return [];
    room.rematch = { requestedBy: playerId };
    return [{ type: "rematch.requested", playerId }];
  }

  respondRematch(room: ServerRoom, playerId: string, accept: boolean, now: number): GameEvent[] {
    assertPhase(room, "COMPLETE");
    requirePlayer(room, playerId);
    if (!room.rematch || room.rematch.requestedBy === playerId) throw new GameError("INVALID_STATE");
    if (!accept) {
      room.rematch = null;
      return [{ type: "rematch.declined", playerId }];
    }
    const opponent = otherPlayer(room, playerId);
    if (!opponent || opponent.left) throw new GameError("OPPONENT_UNAVAILABLE");
    room.completedAt = null;
    return [{ type: "rematch.accepted" }, ...this.startSetup(room, now)];
  }

  cancelRematch(room: ServerRoom, playerId: string): GameEvent[] {
    assertPhase(room, "COMPLETE");
    if (room.rematch?.requestedBy !== playerId) return [];
    room.rematch = null;
    return [{ type: "rematch.cancelled", playerId }];
  }

  // ───────────────────────────── Clock ─────────────────────────────

  /** The next moment `tick` has something to do, or null. */
  nextDeadline(room: ServerRoom): number | null {
    const deadlines: number[] = [];
    if (room.phase === "COUNTDOWN" && room.countdownEndsAt) deadlines.push(room.countdownEndsAt);
    const turn = room.match?.turn;
    if (room.phase === "PLAYING" && turn) {
      if (turn.phase === "GUESSING" && turn.endsAt !== null) deadlines.push(turn.endsAt + this.timings.latencyGraceMs);
      if (turn.phase === "RESULT" && turn.resultEndsAt !== null) deadlines.push(turn.resultEndsAt);
    }
    if (room.phase !== "COMPLETE" && room.phase !== "CLOSED") {
      for (const p of room.players) {
        if (!p.connected && !p.left && p.disconnectedAt !== null) {
          deadlines.push(p.disconnectedAt + this.timings.disconnectGraceMs);
        }
      }
    }
    return deadlines.length ? Math.min(...deadlines) : null;
  }

  /** Process everything that is due at `now`. Safe to call at any time. */
  tick(room: ServerRoom, now: number): GameEvent[] {
    const events: GameEvent[] = [];
    // Each step can unlock the next (timeout → result → next turn), so loop.
    for (let guard = 0; guard < 20; guard++) {
      const step = this.tickOnce(room, now);
      if (!step.length) break;
      events.push(...step);
    }
    return events;
  }

  private tickOnce(room: ServerRoom, now: number): GameEvent[] {
    // Disconnect grace expiry.
    if (room.phase !== "COMPLETE" && room.phase !== "CLOSED") {
      const expired = room.players.find(
        (p) => !p.connected && !p.left && p.disconnectedAt !== null && now >= p.disconnectedAt + this.timings.disconnectGraceMs,
      );
      if (expired) return this.expireDisconnected(room, expired, now);
    }

    if (room.phase === "COUNTDOWN" && room.countdownEndsAt && now >= room.countdownEndsAt) {
      return this.startGame(room, now);
    }

    const turn = room.match?.turn;
    if (room.phase === "PLAYING" && turn) {
      if (turn.phase === "GUESSING" && turn.endsAt !== null && now > turn.endsAt + this.timings.latencyGraceMs) {
        return this.handleTimeout(room, now);
      }
      if (turn.phase === "RESULT" && turn.resultEndsAt !== null && now >= turn.resultEndsAt) {
        return this.advanceTurn(room, now);
      }
    }
    return [];
  }

  private expireDisconnected(room: ServerRoom, player: ServerPlayer, now: number): GameEvent[] {
    if (room.phase === "PLAYING") {
      const opponent = otherPlayer(room, player.id);
      if (!opponent || !opponent.connected) {
        return this.close(room, "Both players disconnected.");
      }
      player.left = true;
      return [{ type: "player.left", playerId: player.id }, ...this.completeGame(room, now, "FORFEIT", opponent.id)];
    }
    return this.leaveGame(room, player.id, now);
  }

  close(room: ServerRoom, reason: string): GameEvent[] {
    if (room.phase === "CLOSED") return [];
    room.phase = "CLOSED"; // every phase may close
    room.closedReason = reason;
    room.countdownEndsAt = null;
    if (room.match) room.match.turn = null;
    return [{ type: "room.closed", reason }];
  }
}

// ───────────────────────────── helpers ─────────────────────────────

function newPlayer(profile: PublicProfile, now: number): ServerPlayer {
  return {
    ...toPublic(profile),
    joinedAt: now,
    ready: false,
    connected: true,
    disconnectedAt: null,
    left: false,
    chain: null,
  };
}

export function toPublic(p: PublicProfile): PublicProfile {
  return { id: p.id, displayName: p.displayName, avatar: p.avatar, color: p.color };
}

/** Time spent on a turn, capped at the turn length when timed. */
function turnTime(match: ServerMatch, turn: ServerTurn, now: number): number {
  const elapsed = Math.max(0, now - turn.startedAt);
  return match.settings.turnMs === null ? elapsed : Math.min(elapsed, match.settings.turnMs);
}

function buildBoard(chain: string[]): BoardWord[] {
  return chain.map((answer, position) => ({
    position,
    answer,
    revealed: position === 0 ? answer.length : 1,
    status: position === 0 ? "GIVEN" : "LOCKED",
    hints: 0,
    wrong: 0,
    points: 0,
    guesses: [],
    timeMs: 0,
    outcome: null,
  }));
}

export function findPlayer(room: ServerRoom, playerId: string): ServerPlayer | undefined {
  return room.players.find((p) => p.id === playerId);
}

function requirePlayer(room: ServerRoom, playerId: string): ServerPlayer {
  const p = findPlayer(room, playerId);
  if (!p || p.left) throw new GameError("NOT_IN_ROOM");
  return p;
}

function otherPlayer(room: ServerRoom, playerId: string): ServerPlayer | undefined {
  return room.players.find((p) => p.id !== playerId);
}

function activePlayers(room: ServerRoom): ServerPlayer[] {
  return room.players.filter((p) => !p.left);
}

function requireMatch(room: ServerRoom): ServerMatch {
  if (!room.match) throw new GameError("INVALID_STATE");
  return room.match;
}

function boardWord(match: ServerMatch, guesserId: string, position: number): BoardWord {
  const word = match.boards[guesserId]?.[position];
  if (!word) throw new GameError("INVALID_STATE");
  return word;
}
