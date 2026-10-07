import { describe, expect, it } from "vitest";
import { serializeRoomFor } from "@/server/game/serialize";
import { ALICE, ALICE_CHAIN, BOB, BOB_CHAIN, currentTurn, playingRoom } from "../helpers/engine";

const opts = { now: 0, turnDurationMs: 30_000, countdownDurationMs: 3_600, graceMs: 60_000 };

describe("serializeRoomFor — secret protection", () => {
  it("never includes the opponent's hidden words", () => {
    const { room } = playingRoom();
    const aliceView = JSON.stringify(serializeRoomFor(room, ALICE.id, opts));
    // Bob's first word is public; the rest must not appear anywhere in Alice's payload.
    expect(aliceView).toContain("RAIN".split("").join('","'));
    for (const secret of BOB_CHAIN.slice(1)) {
      expect(aliceView.toLowerCase()).not.toContain(`"${secret}"`);
      expect(aliceView).not.toContain(secret.toUpperCase().split("").join('","'));
    }
  });

  it("shows exactly the revealed letters of the active word", () => {
    const { engine, room, now } = playingRoom();
    const turn = currentTurn(room);
    engine.requestHint(room, turn.guesserId, { turnId: turn.id, expectedRevealed: 1 }, now);
    const view = serializeRoomFor(room, turn.guesserId, opts);
    const card = view.match!.opponentBoard[1]!;
    expect(card.letters.filter((l) => l !== null)).toHaveLength(2);
    expect(card.letters.slice(2).every((l) => l === null)).toBe(true);
  });

  it("gives each player their own chain and nothing else", () => {
    const { room } = playingRoom();
    const view = serializeRoomFor(room, ALICE.id, opts);
    expect(view.myChain).toEqual(ALICE_CHAIN);
    expect(view.match!.myBoard.map((w) => w.letters.join("").toLowerCase())).toEqual(ALICE_CHAIN);
    expect(view.match!.result).toBeNull();
  });

  it("reveals both chains once the match is complete", () => {
    const { engine, room, now } = playingRoom();
    engine.leaveGame(room, BOB.id, now);
    const view = serializeRoomFor(room, ALICE.id, opts);
    expect(view.match!.result!.chains[BOB.id]).toEqual(BOB_CHAIN);
    expect(view.match!.opponentBoard.every((w) => w.letters.every((l) => l !== null))).toBe(true);
  });

  it("gives a non-member no board data", () => {
    const { room } = playingRoom();
    const view = serializeRoomFor(room, "00000000-0000-4000-8000-0000000000ff", opts);
    expect(view.match!.opponentBoard).toEqual([]);
    expect(view.match!.myBoard).toEqual([]);
    expect(view.myChain).toBeNull();
  });
});
