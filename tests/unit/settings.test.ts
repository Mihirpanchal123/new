import { describe, expect, it } from "vitest";
import { DEFAULT_TIMINGS, type GameSettings } from "@/constants/game";
import { settingsSchema } from "@/lib/validation/schemas";
import { checkChain } from "@/lib/validation/words";
import { totalTurns } from "@/server/game/engine";
import { GameError } from "@/server/game/errors";
import { serializeRoomFor } from "@/server/game/serialize";
import { ALICE, BOB, currentTurn, makeEngine } from "../helpers/engine";

const LONG_A = ["coffee", "bean", "plant", "farm", "market", "stall", "horse", "race"];
const LONG_B = ["rain", "cloud", "water", "river", "ocean", "wave", "surf", "board"];

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameError ${code}`);
}

function startGame(settings: GameSettings, start = 1_000_000) {
  const engine = makeEngine();
  const room = engine.createGame("ABCDE", ALICE, start, settings);
  engine.joinGame(room, BOB, start);
  engine.setPlayerReady(room, ALICE.id, true, start);
  engine.setPlayerReady(room, BOB.id, true, start);
  engine.submitChain(room, ALICE.id, LONG_A.slice(0, settings.chainLength), start);
  engine.submitChain(room, BOB.id, LONG_B.slice(0, settings.chainLength), start);
  const now = room.countdownEndsAt!;
  engine.tick(room, now);
  return { engine, room, now };
}

describe("settings validation", () => {
  it("accepts 4–8 words and a timer or none", () => {
    expect(settingsSchema.safeParse({ chainLength: 4, turnMs: null }).success).toBe(true);
    expect(settingsSchema.safeParse({ chainLength: 8, turnMs: 120_000 }).success).toBe(true);
    expect(settingsSchema.safeParse({ chainLength: 3, turnMs: 30_000 }).success).toBe(false);
    expect(settingsSchema.safeParse({ chainLength: 9, turnMs: 30_000 }).success).toBe(false);
    expect(settingsSchema.safeParse({ chainLength: 5, turnMs: 100 }).success).toBe(false);
    expect(settingsSchema.safeParse({ chainLength: 5 }).success).toBe(false);
  });

  it("checks chains of any requested length", () => {
    expect(checkChain(LONG_A, 8).valid).toBe(true);
    expect(checkChain(LONG_A.slice(0, 6), 7).issues[6]).toBe("EMPTY");
  });
});

describe("lobby settings", () => {
  it("only the host may change them, only in the lobby, and it un-readies everyone", () => {
    const engine = makeEngine();
    const room = engine.createGame("ABCDE", ALICE, 0);
    expect(room.settings).toEqual({ chainLength: 5, turnMs: DEFAULT_TIMINGS.turnMs });
    engine.joinGame(room, BOB, 0);
    engine.setPlayerReady(room, BOB.id, true, 0);

    expectCode(() => engine.updateSettings(room, BOB.id, { chainLength: 6, turnMs: null }), "INVALID_STATE");
    const events = engine.updateSettings(room, ALICE.id, { chainLength: 6, turnMs: null });
    expect(events).toEqual([{ type: "settings.updated", settings: { chainLength: 6, turnMs: null }, by: ALICE.id }]);
    expect(room.players.every((p) => !p.ready)).toBe(true);
    // No-op when nothing changed.
    expect(engine.updateSettings(room, ALICE.id, { chainLength: 6, turnMs: null })).toEqual([]);

    engine.setPlayerReady(room, ALICE.id, true, 0);
    engine.setPlayerReady(room, BOB.id, true, 0);
    expect(room.phase).toBe("SETUP");
    expectCode(() => engine.updateSettings(room, ALICE.id, { chainLength: 4, turnMs: null }), "INVALID_STATE");
  });

  it("rejects chains that don't match the room's length", () => {
    const engine = makeEngine();
    const room = engine.createGame("ABCDE", ALICE, 0, { chainLength: 7, turnMs: 30_000 });
    engine.joinGame(room, BOB, 0);
    engine.setPlayerReady(room, ALICE.id, true, 0);
    engine.setPlayerReady(room, BOB.id, true, 0);
    expectCode(() => engine.submitChain(room, ALICE.id, LONG_A.slice(0, 5), 0), "INVALID_CHAIN");
    expect(engine.submitChain(room, ALICE.id, LONG_A.slice(0, 7), 0)).toHaveLength(1);
  });
});

describe("chain length", () => {
  it.each([4, 6, 8])("a %i-word game has each player guess every hidden word once", (chainLength) => {
    const { engine, room } = startGame({ chainLength, turnMs: 30_000 });
    expect(room.match!.boards[ALICE.id]).toHaveLength(chainLength);
    let turns = 0;
    let t = room.match!.turn!.startedAt;
    while (room.phase === "PLAYING") {
      const turn = currentTurn(room);
      const answer = room.match!.chains[turn.ownerId]![turn.position]!;
      engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, t + 1_000);
      t = room.match!.turn!.resultEndsAt!;
      engine.tick(room, t);
      turns++;
    }
    expect(turns).toBe(totalTurns(chainLength));
    expect(room.match!.result!.stats[ALICE.id]!.solved).toBe(chainLength - 1);
    const view = serializeRoomFor(room, ALICE.id, { now: t, countdownDurationMs: 0, graceMs: 0 });
    expect(view.match!.totalRounds).toBe(chainLength - 1);
    expect(view.match!.settings.chainLength).toBe(chainLength);
  });
});

describe("untimed turns", () => {
  it("never time out and give no speed bonus", () => {
    const { engine, room, now } = startGame({ chainLength: 5, turnMs: null });
    const turn = currentTurn(room);
    expect(turn.endsAt).toBeNull();
    expect(engine.nextDeadline(room)).toBeNull();

    // An hour later the turn is still open.
    const later = now + 60 * 60_000;
    expect(engine.tick(room, later)).toEqual([]);
    expect(currentTurn(room).phase).toBe("GUESSING");

    const answer = room.match!.chains[turn.ownerId]![turn.position]!;
    const res = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, later);
    expect(res.data).toMatchObject({ correct: true, points: 100 });
    expect(room.match!.boards[turn.guesserId]![turn.position]!.timeMs).toBe(60 * 60_000);
    // The result pause is still timed.
    expect(engine.nextDeadline(room)).toBe(currentTurn(room).resultEndsAt);
  });

  it("speed bonus still applies when timed", () => {
    const { engine, room, now } = startGame({ chainLength: 5, turnMs: 60_000 });
    const turn = currentTurn(room);
    expect(turn.endsAt).toBe(now + 60_000);
    const answer = room.match!.chains[turn.ownerId]![turn.position]!;
    const res = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, now);
    expect(res.data.points).toBe(120);
  });
});
