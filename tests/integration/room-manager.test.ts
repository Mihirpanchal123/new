import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMINGS } from "@/constants/game";

const HIDDEN_WORDS = 4;
import { createContainer, type Container } from "@/server/container";
import { GameError } from "@/server/game/errors";
import type { RoomBroadcaster } from "@/server/game/room-manager";
import type { GameEvent } from "@/types/realtime";
import { ALICE_CHAIN, BOB_CHAIN } from "../helpers/engine";

function setup() {
  const c = createContainer({
    config: {
      isProduction: false,
      timings: { ...DEFAULT_TIMINGS },
      scoring: { basePoints: 100, hintPenalty: 25, wrongGuessPenalty: 5, minCorrectPoints: 10, speedBonusMax: 20, failedPoints: 0 },
      sessionSecret: "test",
      adminToken: null,
      adminShowSecrets: false,
      persistence: "memory",
      dataFile: "",
      corsOrigins: [],
    },
  });
  const events: GameEvent[] = [];
  let snapshots = 0;
  const broadcaster: RoomBroadcaster = {
    emitState: () => {
      snapshots++;
    },
    emitEvents: (_room, evs) => {
      events.push(...evs);
    },
  };
  c.rooms.setBroadcaster(broadcaster);
  const alice = c.profiles.createGuest();
  const bob = c.profiles.createGuest();
  return { c, events, alice, bob, snapshots: () => snapshots };
}

async function lockChains(c: Container, code: string, aliceId: string, bobId: string) {
  for (const [id, chain] of [
    [aliceId, ALICE_CHAIN],
    [bobId, BOB_CHAIN],
  ] as const) {
    const v = await c.wordValidation.validateChain(chain);
    expect(v.valid).toBe(true);
    c.rooms.apply(code, (r, now) => c.engine.submitChain(r, id, v.words, now));
  }
}

describe("RoomManager integration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates and joins a room with a unique 5-char code", () => {
    const { c, alice, bob } = setup();
    const room = c.rooms.createRoom(alice);
    expect(room.code).toMatch(/^[A-Z2-9]{5}$/);
    c.rooms.apply(room.code, (r, now) => c.engine.joinGame(r, bob, now));
    expect(c.rooms.summary(room.code, bob.id)).toMatchObject({ playerCount: 2, isMember: true, joinable: true });
    expect(c.rooms.summary(room.code, "someone-else")).toMatchObject({ joinable: false });
    expect(() => c.rooms.getRoom("ZZZZZ")).toThrowError(GameError);
  });

  it("plays a whole match: timers, hints, scoring, records and achievements", async () => {
    const { c, events, alice, bob } = setup();
    const { code } = c.rooms.createRoom(alice);
    c.rooms.apply(code, (r, now) => c.engine.joinGame(r, bob, now));
    c.rooms.apply(code, (r, now) => c.engine.setPlayerReady(r, alice.id, true, now));
    c.rooms.apply(code, (r, now) => c.engine.setPlayerReady(r, bob.id, true, now));
    await lockChains(c, code, alice.id, bob.id);
    expect(c.rooms.getRoom(code).phase).toBe("COUNTDOWN");

    // The server timer starts the game — no client involvement.
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.countdownMs + 10);
    const room = c.rooms.getRoom(code);
    expect(room.phase).toBe("PLAYING");

    let first = true;
    while (room.phase === "PLAYING") {
      const turn = room.match!.turn!;
      const answer = room.match!.chains[turn.ownerId]![turn.position]!;
      if (turn.guesserId === alice.id) {
        // Alice: one hint then correct.
        c.rooms.mutate(code, (r, now) => c.engine.requestHint(r, alice.id, { turnId: turn.id, expectedRevealed: 1 }, now));
        c.rooms.mutate(code, (r, now) => c.engine.submitGuess(r, alice.id, { turnId: turn.id, guess: answer }, now));
      } else if (first) {
        // Bob lets his first word time out.
        first = false;
        await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.turnMs + DEFAULT_TIMINGS.latencyGraceMs + 20);
        expect(turn.outcome).toBe("TIMEOUT");
      } else {
        c.rooms.mutate(code, (r, now) => c.engine.submitGuess(r, bob.id, { turnId: turn.id, guess: answer }, now));
      }
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.resultMs + 10);
    }

    expect(room.phase).toBe("COMPLETE");
    const result = room.match!.result!;
    expect(result.stats[alice.id]!.solved).toBe(HIDDEN_WORDS);
    expect(result.stats[alice.id]!.hintsUsed).toBe(HIDDEN_WORDS);
    expect(result.stats[bob.id]!.solved).toBe(HIDDEN_WORDS - 1);

    const record = c.profiles.getMatch(room.match!.id)!;
    expect(record).toBeDefined();
    expect(record.players.map((p) => p.chain)).toEqual(expect.arrayContaining([ALICE_CHAIN, BOB_CHAIN]));

    const winnerId = result.winnerId!;
    const winner = c.profiles.get(winnerId)!;
    expect(winner.stats.wins).toBe(1);
    expect(winner.achievements.FIRST_WIN).toBeDefined();
    expect(events.some((e) => e.type === "achievement.unlocked" && e.playerId === winnerId)).toBe(true);
    expect(c.profiles.leaderboard("global", null)[0]!.player.id).toBe(winnerId);
    expect(c.profiles.getHistory(alice.id)).toHaveLength(1);
  });

  it("a forfeit ends the match and blocks a rematch with the leaver", async () => {
    const { c, alice, bob } = setup();
    const { code } = c.rooms.createRoom(alice);
    c.rooms.apply(code, (r, now) => c.engine.joinGame(r, bob, now));
    c.rooms.apply(code, (r, now) => c.engine.setPlayerReady(r, alice.id, true, now));
    c.rooms.apply(code, (r, now) => c.engine.setPlayerReady(r, bob.id, true, now));
    await lockChains(c, code, alice.id, bob.id);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.countdownMs + 10);
    c.rooms.apply(code, (r, now) => c.engine.leaveGame(r, bob.id, now));
    const room = c.rooms.getRoom(code);
    expect(room.match!.result!.endReason).toBe("FORFEIT");
    expect(room.match!.result!.winnerId).toBe(alice.id);
    expect(() => c.rooms.apply(code, (r, now) => c.engine.requestRematch(r, alice.id, now))).toThrowError(/left/);
  });

  it("closes abandoned rooms in the sweeper and reports the code as expired", () => {
    const { c, alice } = setup();
    const { code } = c.rooms.createRoom(alice);
    c.rooms.apply(code, (r, now) => c.engine.setConnected(r, alice.id, false, now));
    vi.setSystemTime(Date.now() + 11 * 60_000);
    c.rooms.sweep();
    expect(c.rooms.findRoom(code)).toBeUndefined();
    expect(() => c.rooms.getRoom(code)).toThrowError(expect.objectContaining({ code: "ROOM_EXPIRED" }));
  });

  it("bumps the version and broadcasts on every change", () => {
    const { c, alice, bob, snapshots } = setup();
    const room = c.rooms.createRoom(alice);
    const v0 = room.version;
    c.rooms.apply(room.code, (r, now) => c.engine.joinGame(r, bob, now));
    c.rooms.apply(room.code, (r, now) => c.engine.setPlayerReady(r, alice.id, true, now));
    expect(room.version).toBe(v0 + 2);
    expect(snapshots()).toBe(2);
  });
});
