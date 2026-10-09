import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { latest, rawClient, startTestServer, waitFor, type TestClient, type TestServer } from "../helpers/realtime";
import { ALICE_CHAIN, BOB_CHAIN } from "../helpers/engine";

let server: TestServer;

beforeEach(async () => {
  server = await startTestServer({ countdownMs: 60, resultMs: 60, turnMs: 3_000, disconnectGraceMs: 400 });
});
afterEach(async () => {
  await server.close();
});

async function duel(): Promise<{ a: TestClient; b: TestClient; code: string }> {
  const a = await server.client();
  const b = await server.client();
  const created = await a.emitWithAck("room:create", {});
  if (!created.ok) throw new Error(created.message);
  const code = created.data.code;
  expect((await a.emitWithAck("room:join", { code })).ok).toBe(true);
  expect((await b.emitWithAck("room:join", { code })).ok).toBe(true);
  await a.emitWithAck("player:ready", { code, ready: true });
  await b.emitWithAck("player:ready", { code, ready: true });
  expect((await a.emitWithAck("chain:submit", { code, words: ALICE_CHAIN })).ok).toBe(true);
  expect((await b.emitWithAck("chain:submit", { code, words: BOB_CHAIN })).ok).toBe(true);
  await waitFor(() => latest(a).phase === "PLAYING" && latest(b).phase === "PLAYING");
  return { a, b, code };
}

function guesserOf(a: TestClient, b: TestClient) {
  const turn = latest(a).match!.turn!;
  return turn.guesserId === a.playerId ? { guesser: a, other: b, turn } : { guesser: b, other: a, turn };
}

describe("realtime: connection", () => {
  it("rejects connections without a valid signed session", async () => {
    const sock = rawClient(server.url, "wd_session=00000000-0000-4000-8000-000000000000.forged");
    const err = await new Promise<Error>((resolve) => sock.once("connect_error", resolve));
    expect(err.message).toBe("UNAUTHORIZED");
    sock.disconnect();
  });

  it("validates payloads and returns friendly errors", async () => {
    const a = await server.client();
    const bad = await a.emitWithAck("room:join", { code: "nope!" });
    expect(bad).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    const missing = await a.emitWithAck("room:join", { code: "ZZZZZ" });
    expect(missing).toMatchObject({ ok: false, error: "ROOM_NOT_FOUND" });
  });

  it("rejects bad chains with per-word errors", async () => {
    const a = await server.client();
    const b = await server.client();
    const { data } = (await a.emitWithAck("room:create", {})) as { data: { code: string } };
    await a.emitWithAck("room:join", { code: data.code });
    await b.emitWithAck("room:join", { code: data.code });
    await a.emitWithAck("player:ready", { code: data.code, ready: true });
    await b.emitWithAck("player:ready", { code: data.code, ready: true });
    const res = await a.emitWithAck("chain:submit", { code: data.code, words: ["sun", "sun", "x", "ok ok", "moon"] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.fieldErrors ?? {}).sort()).toEqual(["1", "2", "3"]);
  });
});

describe("realtime: synchronization & secrecy", () => {
  it("sends each player a different, correctly masked view", async () => {
    const { a, b } = await duel();
    const av = latest(a);
    const bv = latest(b);
    expect(av.myChain).toEqual(ALICE_CHAIN);
    expect(bv.myChain).toEqual(BOB_CHAIN);
    expect(av.match!.opponentBoard[0]!.letters.join("")).toBe("RAIN");
    expect(av.match!.opponentBoard[1]!.letters).toEqual(["C", null, null, null, null]);

    // No packet Alice ever received contains Bob's hidden words.
    const everything = a.raw.join("\n").toLowerCase();
    for (const secret of BOB_CHAIN.slice(1)) {
      expect(everything).not.toContain(`"${secret}"`);
      expect(everything).not.toContain(secret.toUpperCase().split("").join('","').toLowerCase());
    }
  });

  it("broadcasts guesses, hints and scores to both players", async () => {
    const { a, b, code } = await duel();
    const { guesser, other, turn } = guesserOf(a, b);
    const answer = (guesser === a ? BOB_CHAIN : ALICE_CHAIN)[turn.position]!;

    const wrong = await guesser.emitWithAck("guess:submit", { code, turnId: turn.id, guess: "zzzz", actionId: "wrong-guess-1" });
    expect(wrong).toMatchObject({ ok: true, data: { correct: false } });
    await waitFor(() => latest(other).match!.turn!.recentGuesses.includes("zzzz"));

    const right = await guesser.emitWithAck("guess:submit", { code, turnId: turn.id, guess: answer, actionId: "right-guess-1" });
    expect(right).toMatchObject({ ok: true, data: { correct: true } });
    const points = right.ok ? right.data.points : 0;

    await waitFor(() => latest(other).match!.scores[guesser.playerId] === points);
    expect(other.events.some((e) => e.event.type === "guess.result" && e.event.correct)).toBe(true);
  });

  it("rejects actions from the player whose turn it isn't", async () => {
    const { a, b, code } = await duel();
    const { other, turn } = guesserOf(a, b);
    const res = await other.emitWithAck("guess:submit", { code, turnId: turn.id, guess: "rain", actionId: "cheat-attempt-1" });
    expect(res).toMatchObject({ ok: false, error: "NOT_YOUR_TURN" });
  });
});

describe("realtime: duplicate events", () => {
  it("replaying the same actionId does not double-apply", async () => {
    const { a, b, code } = await duel();
    const { guesser, turn } = guesserOf(a, b);
    const payload = { code, turnId: turn.id, expectedRevealed: 1, actionId: "same-action-id" };
    const [r1, r2] = await Promise.all([guesser.emitWithAck("turn:skip", payload), guesser.emitWithAck("turn:skip", payload)]);
    expect(r1).toEqual(r2);
    await waitFor(() => latest(guesser).match!.opponentBoard[turn.position]!.revealedCount === 2);
    expect(latest(guesser).match!.opponentBoard[turn.position]!.hintsUsed).toBe(1);
    expect(latest(guesser).match!.scores[guesser.playerId]).toBe(-25);
  });

  it("a double-clicked skip (new actionId, stale count) reveals only one letter", async () => {
    const { a, b, code } = await duel();
    const { guesser, turn } = guesserOf(a, b);
    const [r1, r2] = await Promise.all([
      guesser.emitWithAck("turn:skip", { code, turnId: turn.id, expectedRevealed: 1, actionId: "dbl-click-1" }),
      guesser.emitWithAck("turn:skip", { code, turnId: turn.id, expectedRevealed: 1, actionId: "dbl-click-2" }),
    ]);
    expect([r1.ok, r2.ok].sort()).toEqual([false, true]);
    expect([r1, r2].find((r) => !r.ok)).toMatchObject({ error: "STALE" });
  });
});

describe("realtime: disconnect & reconnect", () => {
  it("tells the opponent, then restores full state on reconnect", async () => {
    const { a, b, code } = await duel();
    const before = latest(b);
    b.disconnect();
    await waitFor(() => a.events.find((e) => e.event.type === "player.disconnected"));
    expect(latest(a).players.find((p) => p.id === b.playerId)!.connected).toBe(false);

    const b2 = await server.client(b.playerId);
    const rejoin = await b2.emitWithAck("room:join", { code });
    expect(rejoin.ok).toBe(true);
    if (rejoin.ok) {
      expect(rejoin.data.phase).toBe("PLAYING");
      expect(rejoin.data.myChain).toEqual(BOB_CHAIN);
      expect(rejoin.data.match!.id).toBe(before.match!.id);
      expect(rejoin.data.version).toBeGreaterThan(before.version);
    }
    await waitFor(() => a.events.find((e) => e.event.type === "player.reconnected"));
  });

  it("forfeits a player who doesn't come back within the grace period", async () => {
    const { a, b } = await duel();
    b.disconnect();
    await waitFor(() => latest(a).phase === "COMPLETE", 3000);
    expect(latest(a).match!.result).toMatchObject({ winnerId: a.playerId, endReason: "FORFEIT" });
  });

  it("a second tab takes over the session without marking the player offline", async () => {
    const { a, b, code } = await duel();
    const replaced = new Promise<void>((resolve) => b.once("session:replaced", () => resolve()));
    const b2 = await server.client(b.playerId);
    await replaced;
    await b2.emitWithAck("room:join", { code });
    await new Promise((r) => setTimeout(r, 100));
    expect(latest(a).players.find((p) => p.id === b.playerId)!.connected).toBe(true);
  });
});

describe("realtime: rematch", () => {
  it("rematch request → accept returns both players to chain setup", async () => {
    const { a, b, code } = await duel();
    // Play it out quickly by solving every word.
    for (;;) {
      const view = latest(a);
      if (view.phase === "COMPLETE") break;
      const turn = view.match?.turn;
      if (turn?.phase === "GUESSING") {
        const guesser = turn.guesserId === a.playerId ? a : b;
        const chain = guesser === a ? BOB_CHAIN : ALICE_CHAIN;
        await guesser.emitWithAck("guess:submit", { code, turnId: turn.id, guess: chain[turn.position]!, actionId: `solve-turn-${turn.id}` });
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(latest(a).match!.result!.winnerId).toBeDefined();

    await a.emitWithAck("rematch:request", { code });
    await waitFor(() => latest(b).rematch?.requestedBy === a.playerId);
    expect((await b.emitWithAck("rematch:respond", { code, accept: true })).ok).toBe(true);
    await waitFor(() => latest(a).phase === "SETUP" && latest(b).phase === "SETUP");
    expect(latest(a).myChain).toBeNull();
  });
});

describe("realtime: game settings", () => {
  it("creates with settings, lets only the host change them, and enforces chain length", async () => {
    const a = await server.client();
    const b = await server.client();
    const created = await a.emitWithAck("room:create", { settings: { chainLength: 6, turnMs: null } });
    if (!created.ok) throw new Error(created.message);
    const code = created.data.code;
    const joined = await a.emitWithAck("room:join", { code });
    expect(joined.ok && joined.data.settings).toEqual({ chainLength: 6, turnMs: null });
    await b.emitWithAck("room:join", { code });

    const denied = await b.emitWithAck("room:settings", { code, settings: { chainLength: 4, turnMs: 15_000 } });
    expect(denied).toMatchObject({ ok: false, error: "INVALID_STATE" });
    const bad = await a.emitWithAck("room:settings", { code, settings: { chainLength: 12, turnMs: null } });
    expect(bad).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect((await a.emitWithAck("room:settings", { code, settings: { chainLength: 4, turnMs: 15_000 } })).ok).toBe(true);
    await waitFor(() => latest(b).settings.chainLength === 4);
    expect(b.events.some((e) => e.event.type === "settings.updated")).toBe(true);

    await a.emitWithAck("player:ready", { code, ready: true });
    await b.emitWithAck("player:ready", { code, ready: true });
    const wrong = await a.emitWithAck("chain:submit", { code, words: ALICE_CHAIN });
    expect(wrong).toMatchObject({ ok: false, error: "INVALID_CHAIN" });
    expect((await a.emitWithAck("chain:submit", { code, words: ALICE_CHAIN.slice(0, 4) })).ok).toBe(true);
    expect((await b.emitWithAck("chain:submit", { code, words: BOB_CHAIN.slice(0, 4) })).ok).toBe(true);
    await waitFor(() => latest(a).phase === "PLAYING");
    expect(latest(a).match!.totalWords).toBe(3);
    expect(latest(a).match!.turn!.endsAt).not.toBeNull();
  });
});

describe("realtime: voice signaling", () => {
  /** voice:signal is fire-and-forget for clients, but the server still acks when asked — handy for asserting rejections. */
  const signal = (c: TestClient, payload: unknown) =>
    (c as unknown as { emitWithAck: (e: string, p: unknown) => Promise<{ ok: boolean; error?: string }> }).emitWithAck(
      "voice:signal",
      payload,
    );

  it("relays signals to the opponent only, tagged with the sender", async () => {
    const a = await server.client();
    const b = await server.client();
    const c = await server.client();
    const { data } = (await a.emitWithAck("room:create", {})) as { data: { code: string } };
    await a.emitWithAck("room:join", { code: data.code });
    await b.emitWithAck("room:join", { code: data.code });

    const received: unknown[] = [];
    const leaked: unknown[] = [];
    b.on("voice:signal", (p) => received.push(p));
    c.on("voice:signal", (p) => leaked.push(p));

    const res = await signal(a, { code: data.code, signal: { type: "join", reply: false, muted: false } });
    expect(res.ok).toBe(true);
    await waitFor(() => received.length === 1);
    expect(received[0]).toEqual({ code: data.code, from: a.playerId, signal: { type: "join", reply: false, muted: false } });

    // Not in the room → rejected and nothing relayed.
    const outsider = await signal(c, { code: data.code, signal: { type: "leave" } });
    expect(outsider).toMatchObject({ ok: false, error: "NOT_IN_ROOM" });
    expect(leaked).toHaveLength(0);
  });

  it("rejects malformed signals", async () => {
    const a = await server.client();
    const { data } = (await a.emitWithAck("room:create", {})) as { data: { code: string } };
    await a.emitWithAck("room:join", { code: data.code });
    const res = await signal(a, { code: data.code, signal: { type: "description", description: { type: "offer", sdp: "x".repeat(50_000) } } });
    expect(res).toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });
});
