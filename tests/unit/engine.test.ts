import { describe, expect, it } from "vitest";
import { DEFAULT_TIMINGS } from "@/constants/game";
import { TOTAL_TURNS } from "@/server/game/engine";
import { GameError } from "@/server/game/errors";
import { canTransition, TRANSITIONS } from "@/server/game/state-machine";
import { ALICE, ALICE_CHAIN, BOB, BOB_CHAIN, currentTurn, makeEngine, playingRoom } from "../helpers/engine";

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

describe("state machine", () => {
  it("only allows declared transitions", () => {
    expect(canTransition("LOBBY", "SETUP")).toBe(true);
    expect(canTransition("LOBBY", "PLAYING")).toBe(false);
    expect(canTransition("PLAYING", "LOBBY")).toBe(false);
    expect(TRANSITIONS.CLOSED).toHaveLength(0);
  });
});

describe("lobby and setup", () => {
  it("moves LOBBY → SETUP → COUNTDOWN → PLAYING", () => {
    const engine = makeEngine();
    const room = engine.createGame("ABCDE", ALICE, 0);
    expect(room.phase).toBe("LOBBY");

    engine.joinGame(room, BOB, 0);
    engine.setPlayerReady(room, ALICE.id, true, 0);
    expect(room.phase).toBe("LOBBY");
    engine.setPlayerReady(room, BOB.id, true, 0);
    expect(room.phase).toBe("SETUP");

    engine.submitChain(room, ALICE.id, ALICE_CHAIN, 0);
    expect(room.phase).toBe("SETUP");
    const events = engine.submitChain(room, BOB.id, BOB_CHAIN, 0);
    expect(room.phase).toBe("COUNTDOWN");
    expect(events.map((e) => e.type)).toContain("game.countdown");

    // Countdown is server-timed.
    expect(engine.tick(room, room.countdownEndsAt! - 1)).toEqual([]);
    const started = engine.tick(room, room.countdownEndsAt!);
    expect(room.phase).toBe("PLAYING");
    expect(started.map((e) => e.type)).toEqual(["game.start", "turn.start"]);
  });

  it("rejects a third player, late joiners and duplicate locks", () => {
    const { engine, room } = playingRoom();
    const carol = { ...BOB, id: "00000000-0000-4000-8000-00000000000c" };
    expectCode(() => engine.joinGame(room, carol, 0), "GAME_IN_PROGRESS");

    const lobby = engine.createGame("FGHJK", ALICE, 0);
    engine.joinGame(lobby, BOB, 0);
    expectCode(() => engine.joinGame(lobby, carol, 0), "ROOM_FULL");

    engine.setPlayerReady(lobby, ALICE.id, true, 0);
    engine.setPlayerReady(lobby, BOB.id, true, 0);
    engine.submitChain(lobby, ALICE.id, ALICE_CHAIN, 0);
    expectCode(() => engine.submitChain(lobby, ALICE.id, ALICE_CHAIN, 0), "INVALID_STATE");
    engine.unlockChain(lobby, ALICE.id);
    engine.submitChain(lobby, ALICE.id, ALICE_CHAIN, 0);
  });

  it("treats re-joining as a reconnect", () => {
    const { engine, room, now } = playingRoom();
    engine.setConnected(room, BOB.id, false, now);
    const events = engine.joinGame(room, BOB, now + 10);
    expect(events).toEqual([{ type: "player.reconnected", playerId: BOB.id }]);
    expect(room.players.find((p) => p.id === BOB.id)!.connected).toBe(true);
  });
});

describe("turns", () => {
  it("alternates guessers and positions", () => {
    const { engine, room, now } = playingRoom();
    const order = room.match!.order;
    let t = now;
    const seen: Array<[string, number]> = [];
    for (let i = 0; i < TOTAL_TURNS; i++) {
      const turn = currentTurn(room);
      seen.push([turn.guesserId, turn.position]);
      t = turn.endsAt + DEFAULT_TIMINGS.latencyGraceMs + 1;
      engine.tick(room, t); // timeout
      t = currentTurn(room)?.resultEndsAt ?? t;
      engine.tick(room, t); // next turn
    }
    expect(seen).toEqual([
      [order[0], 1], [order[1], 1],
      [order[0], 2], [order[1], 2],
      [order[0], 3], [order[1], 3],
      [order[0], 4], [order[1], 4],
    ]);
    expect(room.phase).toBe("COMPLETE");
    expect(room.match!.result!.winnerId).toBeNull(); // 0 – 0 draw
  });

  it("scores a correct guess and enters the result phase", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    const answer = room.match!.chains[turn.ownerId]![1]!;
    const res = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer.toUpperCase() }, now + 30_000);
    expect(res.data.correct).toBe(true);
    expect(res.data.points).toBe(100);
    expect(turn.phase).toBe("RESULT");
    expect(room.match!.scores[turn.guesserId]).toBe(100);
  });

  it("penalizes wrong guesses once per distinct guess", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: "nope" }, now);
    const dup = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: "NOPE" }, now);
    expect(dup.data.duplicate).toBe(true);
    const word = room.match!.boards[turn.guesserId]![1]!;
    expect(word.wrong).toBe(1);
  });

  it("rejects guesses from the wrong player, stale turns and expired timers", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    expectCode(() => engine.submitGuess(room, turn.ownerId, { turnId: turn.id, guess: "x" }, now), "NOT_YOUR_TURN");
    expectCode(() => engine.submitGuess(room, turn.guesserId, { turnId: turn.id + 1, guess: "abc" }, now), "STALE");
    expectCode(
      () => engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: "abc" }, turn.endsAt + DEFAULT_TIMINGS.latencyGraceMs + 1),
      "TURN_EXPIRED",
    );
  });

  it("accepts a guess that lands inside the latency grace window", () => {
    const { engine, room } = playingRoom();
    const turn = currentTurn(room);
    const answer = room.match!.chains[turn.ownerId]![1]!;
    const res = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, turn.endsAt + 100);
    expect(res.data.correct).toBe(true);
  });

  it("reveals one letter per hint and fails the word when fully revealed", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    const answer = room.match!.chains[turn.ownerId]![1]!; // "bean" or "cloud"
    let revealed = 1;
    while (revealed < answer.length - 1) {
      const res = engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: revealed }, now);
      expect(res.data.letter).toBe(answer[revealed]!.toUpperCase());
      revealed++;
    }
    engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: revealed }, now);
    expect(turn.phase).toBe("RESULT");
    expect(turn.outcome).toBe("REVEALED");
    expect(room.match!.scores[turn.guesserId]).toBe(0);
  });

  it("rejects a duplicate hint request", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now);
    expectCode(() => engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now), "STALE");
    expect(room.match!.boards[turn.guesserId]![1]!.revealed).toBe(2);
  });

  it("gives 75 points for a correct guess after one hint", () => {
    const { engine, room } = playingRoom();
    const turn = currentTurn(room);
    const late = turn.endsAt; // no speed bonus
    engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, late);
    const answer = room.match!.chains[turn.ownerId]![1]!;
    expect(engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, late).data.points).toBe(75);
  });
});

describe("completion, forfeit and rematch", () => {
  function solveAll(engine: ReturnType<typeof makeEngine>, room: ReturnType<typeof playingRoom>["room"], start: number) {
    let t = start;
    while (room.phase === "PLAYING") {
      const turn = currentTurn(room);
      const answer = room.match!.chains[turn.ownerId]![turn.position]!;
      engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, turn.endsAt);
      t = turn.resultEndsAt!;
      engine.tick(room, t);
    }
    return t;
  }

  it("completes after every word and computes stats", () => {
    const { engine, room, now } = playingRoom();
    solveAll(engine, room, now);
    expect(room.phase).toBe("COMPLETE");
    const result = room.match!.result!;
    expect(result.endReason).toBe("COMPLETED");
    for (const id of [ALICE.id, BOB.id]) {
      expect(result.stats[id]!.solved).toBe(4);
      expect(result.stats[id]!.score).toBe(400);
    }
    expect(result.winnerId).toBeNull();
  });

  it("forfeits a player who stays disconnected past the grace period", () => {
    const { engine, room, now } = playingRoom();
    engine.setConnected(room, BOB.id, false, now);
    expect(engine.nextDeadline(room)).toBeLessThanOrEqual(now + DEFAULT_TIMINGS.disconnectGraceMs);
    engine.tick(room, now + DEFAULT_TIMINGS.disconnectGraceMs);
    expect(room.phase).toBe("COMPLETE");
    expect(room.match!.result!.endReason).toBe("FORFEIT");
    expect(room.match!.result!.winnerId).toBe(ALICE.id);
  });

  it("closes the room if both players vanish", () => {
    const { engine, room, now } = playingRoom();
    engine.setConnected(room, ALICE.id, false, now);
    engine.setConnected(room, BOB.id, false, now);
    engine.tick(room, now + DEFAULT_TIMINGS.disconnectGraceMs + 1);
    expect(room.phase).toBe("CLOSED");
  });

  it("an explicit leave mid-match is a forfeit", () => {
    const { engine, room, now } = playingRoom();
    engine.leaveGame(room, ALICE.id, now);
    expect(room.match!.result!.winnerId).toBe(BOB.id);
  });

  it("rematch resets to SETUP and swaps who starts", () => {
    const { engine, room, now } = playingRoom();
    const firstStarter = room.match!.order[0];
    const t = solveAll(engine, room, now);
    engine.requestRematch(room, ALICE.id, t);
    expect(room.rematch).toEqual({ requestedBy: ALICE.id });
    expectCode(() => engine.respondRematch(room, ALICE.id, true, t), "INVALID_STATE");
    engine.respondRematch(room, BOB.id, true, t);
    expect(room.phase).toBe("SETUP");
    expect(room.players.every((p) => p.chain === null)).toBe(true);

    engine.submitChain(room, ALICE.id, ALICE_CHAIN, t);
    engine.submitChain(room, BOB.id, BOB_CHAIN, t);
    engine.tick(room, room.countdownEndsAt!);
    expect(room.match!.order[0]).not.toBe(firstStarter);
    expect(room.match!.number).toBe(2);
  });

  it("a declined rematch clears the request", () => {
    const { engine, room, now } = playingRoom();
    const t = solveAll(engine, room, now);
    engine.requestRematch(room, ALICE.id, t);
    engine.respondRematch(room, BOB.id, false, t);
    expect(room.rematch).toBeNull();
    expect(room.phase).toBe("COMPLETE");
  });
});
