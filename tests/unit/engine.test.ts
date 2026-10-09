import { describe, expect, it } from "vitest";
import { DEFAULT_TIMINGS, MAX_IDLE_TURNS } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
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
  /** Let the current turn time out and move on to the next one. */
  function timeOut(engine: ReturnType<typeof makeEngine>, room: ReturnType<typeof playingRoom>["room"]) {
    const turn = currentTurn(room);
    engine.tick(room, turn.endsAt! + DEFAULT_TIMINGS.latencyGraceMs + 1);
    engine.tick(room, turn.resultEndsAt!);
  }

  it("alternates guessers; a timed-out word stays with its guesser, no penalty", () => {
    const { engine, room } = playingRoom();
    const order = room.match!.order;
    const seen: Array<[string, number]> = [];
    for (let i = 0; i < 4; i++) {
      const turn = currentTurn(room);
      seen.push([turn.guesserId, turn.position]);
      timeOut(engine, room);
    }
    expect(seen).toEqual([
      [order[0], 1], [order[1], 1],
      [order[0], 1], [order[1], 1],
    ]);
    expect(room.match!.scores).toEqual({ [ALICE.id]: 0, [BOB.id]: 0 });
    expect(room.match!.boards[order[0]]![1]!.revealed).toBe(1);
  });

  it("passes the turn after a solve, and the solver moves on to their next word", () => {
    const { engine, room, now } = playingRoom();
    const first = currentTurn(room);
    const answer = room.match!.chains[first.ownerId]![1]!;
    engine.submitGuess(room, first.guesserId, { turnId: first.id, guess: answer }, now);
    engine.tick(room, first.resultEndsAt!);
    expect(currentTurn(room).guesserId).toBe(first.ownerId);
    timeOut(engine, room);
    expect(currentTurn(room)).toMatchObject({ guesserId: first.guesserId, position: 2 });
  });

  it("settles an idle game on points after too many timeouts in a row", () => {
    const { engine, room } = playingRoom();
    for (let i = 0; i < MAX_IDLE_TURNS; i++) timeOut(engine, room);
    expect(room.phase).toBe("COMPLETE");
    expect(room.match!.result).toMatchObject({ endReason: "COMPLETED", winnerId: null });
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
      () => engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: "abc" }, turn.endsAt! + DEFAULT_TIMINGS.latencyGraceMs + 1),
      "TURN_EXPIRED",
    );
  });

  it("accepts a guess that lands inside the latency grace window", () => {
    const { engine, room } = playingRoom();
    const turn = currentTurn(room);
    const answer = room.match!.chains[turn.ownerId]![1]!;
    const res = engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, turn.endsAt! + 100);
    expect(res.data.correct).toBe(true);
  });

  it("a skip reveals one letter, costs points and passes the turn — the word waits", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    const answer = room.match!.chains[turn.ownerId]![1]!;
    const res = engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now);
    expect(res.data).toEqual({ revealedCount: 2, letter: answer[1]!.toUpperCase() });
    expect(res.events.map((e) => e.type)).toEqual(["hint.revealed", "turn.complete", "score.updated"]);
    // The answer must not travel with a skip — both players receive this event.
    expect(res.events.find((e) => e.type === "turn.complete")).toMatchObject({ outcome: "SKIPPED", word: null, points: -SCORING.skipPenalty });
    expect(turn.phase).toBe("RESULT");
    expect(room.match!.scores[turn.guesserId]).toBe(-SCORING.skipPenalty);

    engine.tick(room, turn.resultEndsAt!);
    expect(currentTurn(room).guesserId).toBe(turn.ownerId);
    timeOut(engine, room);
    // Back to the skipper, same word, one more letter showing.
    expect(currentTurn(room)).toMatchObject({ guesserId: turn.guesserId, position: 1 });
    expect(room.match!.boards[turn.guesserId]![1]!).toMatchObject({ status: "ACTIVE", revealed: 2, hints: 1 });
  });

  it("rejects a duplicate skip", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now);
    expectCode(() => engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now), "STALE");
    expect(room.match!.boards[turn.guesserId]![1]!.revealed).toBe(2);
    expect(room.match!.scores[turn.guesserId]).toBe(-SCORING.skipPenalty);
  });

  it("can't skip once every letter is showing", () => {
    const { engine, room } = playingRoom();
    const word = room.match!.boards[currentTurn(room).guesserId]![1]!;
    word.revealed = word.answer.length;
    const turn = currentTurn(room);
    expectCode(() => engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: word.revealed }, turn.startedAt), "INVALID_STATE");
  });

  it("a solve after skips is worth full points — the skips were already paid for", () => {
    const { engine, room } = playingRoom();
    const turn = currentTurn(room);
    engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, turn.startedAt);
    engine.tick(room, turn.resultEndsAt!);
    timeOut(engine, room);
    const back = currentTurn(room);
    const answer = room.match!.chains[back.ownerId]![1]!;
    expect(engine.submitGuess(room, back.guesserId, { turnId: back.id, guess: answer }, back.endsAt!).data.points).toBe(100);
    expect(room.match!.scores[back.guesserId]).toBe(100 - SCORING.skipPenalty);
  });
});

describe("completion, forfeit and rematch", () => {
  function solveAll(engine: ReturnType<typeof makeEngine>, room: ReturnType<typeof playingRoom>["room"], start: number) {
    let t = start;
    while (room.phase === "PLAYING") {
      const turn = currentTurn(room);
      const answer = room.match!.chains[turn.ownerId]![turn.position]!;
      engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, turn.endsAt!);
      t = turn.resultEndsAt!;
      engine.tick(room, t);
    }
    return t;
  }

  it("the first to crack the whole chain wins and the rest are marked missed", () => {
    const { engine, room, now } = playingRoom();
    const [starter, second] = room.match!.order;
    solveAll(engine, room, now);
    expect(room.phase).toBe("COMPLETE");
    const result = room.match!.result!;
    expect(result.endReason).toBe("COMPLETED");
    expect(result.winnerId).toBe(starter);
    expect(result.stats[starter]).toMatchObject({ solved: 4, failed: 0, score: 400 });
    expect(result.stats[second]).toMatchObject({ solved: 3, failed: 1, score: 300 });
  });

  it("finishing first beats a higher score", () => {
    const { engine, room } = playingRoom();
    const [starter, second] = room.match!.order;
    // The starter skips a lot and falls far behind on points…
    room.match!.scores[starter] = -500;
    let guard = 0;
    while (room.phase === "PLAYING" && guard++ < 50) {
      const turn = currentTurn(room);
      const answer = room.match!.chains[turn.ownerId]![turn.position]!;
      // …while the second player only ever times out.
      if (turn.guesserId === starter) engine.submitGuess(room, starter, { turnId: turn.id, guess: answer }, turn.endsAt!);
      else engine.tick(room, turn.endsAt! + DEFAULT_TIMINGS.latencyGraceMs + 1);
      engine.tick(room, currentTurn(room).resultEndsAt!);
    }
    expect(room.match!.result!.winnerId).toBe(starter);
    expect(room.match!.scores[starter]).toBeLessThan(room.match!.scores[second]!);
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
