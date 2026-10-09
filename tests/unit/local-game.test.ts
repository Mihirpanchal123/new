import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMINGS } from "@/constants/game";
import { useLocalGame } from "@/lib/local/local-game";
import { gameEvents } from "@/lib/realtime/events";
import type { PublicProfile } from "@/types/game";

const P1: PublicProfile = { id: "local-p1", displayName: "Ana", avatar: "rocket", color: "violet" };
const P2: PublicProfile = { id: "local-p2", displayName: "Ben", avatar: "cat", color: "coral" };
const CHAIN_1 = ["coffee", "bean", "plant", "farm"];
const CHAIN_2 = ["rain", "cloud", "water", "river"];

const store = () => useLocalGame.getState();

beforeEach(() => {
  vi.useFakeTimers();
  store().quit();
});
afterEach(() => {
  store().quit();
  vi.useRealTimers();
});

describe("one-screen game", () => {
  it("walks setup → handoffs → chains → countdown → play → results", async () => {
    const events: string[] = [];
    const off = gameEvents.on((e) => events.push(e.event.type));

    store().start([P1, P2], { chainLength: 4, turnMs: null });
    expect(store().step).toEqual({ kind: "handoff", seat: 0 });
    store().reveal(0);
    expect(store().step).toEqual({ kind: "chain", seat: 0 });

    // Wrong length is rejected; the step doesn't advance.
    expect(store().submitChain(0, ["coffee", "bean"]).ok).toBe(false);
    expect(store().submitChain(0, CHAIN_1).ok).toBe(true);
    expect(store().step).toEqual({ kind: "handoff", seat: 1 });
    store().reveal(1);
    expect(store().submitChain(1, CHAIN_2).ok).toBe(true);
    expect(store().step).toEqual({ kind: "game" });
    expect(store().view!.phase).toBe("COUNTDOWN");

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.countdownMs + 10);
    expect(store().view!.phase).toBe("PLAYING");

    // Both chains are masked on the shared screen: only the first word and first letters.
    const boards = store().view!.match!.boards;
    expect(boards[P1.id]!.map((c) => c.letters.join("")).slice(1)).toEqual(["C", "W", "R"]);
    expect(boards[P2.id]![1]!.letters).toEqual(["B", null, null, null]);

    const chains: Record<string, string[]> = { [P1.id]: CHAIN_1, [P2.id]: CHAIN_2 };
    let turns = 0;
    while (store().view!.phase === "PLAYING") {
      const turn = store().view!.match!.turn!;
      expect(turn.endsAt).toBeNull(); // untimed
      if (turns === 0) {
        // Ana opens with a skip: one more letter, and the turn goes to Ben.
        const skip = await store().skip(turn.id, 1);
        expect(skip).toMatchObject({ ok: true, data: { revealedCount: 2 } });
      } else {
        const answer = chains[turn.ownerId]![turn.position]!;
        const wrong = await store().guess(turn.id, "zzz");
        expect(wrong).toMatchObject({ ok: true, data: { correct: false } });
        const right = await store().guess(turn.id, answer);
        expect(right).toMatchObject({ ok: true, data: { correct: true } });
      }
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.resultMs + 10);
      turns++;
    }
    // Ana's skip cost her a turn, so Ben cracks his 3 words first.
    expect(turns).toBe(6);
    const view = store().view!;
    expect(view.phase).toBe("COMPLETE");
    expect(view.match!.result!.chains[P1.id]).toEqual(CHAIN_1);
    expect(view.match!.result!.winnerId).toBe(P2.id);
    expect(events).toContain("game.complete");
    off();

    // Play again keeps players and settings and goes back to chain writing.
    store().playAgain();
    expect(store().step).toEqual({ kind: "handoff", seat: 0 });
    expect(store().view!.phase).toBe("SETUP");
  });

  it("times out turns when a timer is set", async () => {
    store().start([P1, P2], { chainLength: 4, turnMs: 15_000 });
    store().submitChain(0, CHAIN_1);
    store().submitChain(1, CHAIN_2);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.countdownMs + 10);
    const first = store().view!.match!.turn!;
    expect(first.endsAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(15_000 + DEFAULT_TIMINGS.latencyGraceMs + 20);
    expect(store().view!.match!.turn!.outcome).toBe("TIMEOUT");
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMINGS.resultMs + 10);
    expect(store().view!.match!.turn!.id).toBe(first.id + 1);
  });
});
