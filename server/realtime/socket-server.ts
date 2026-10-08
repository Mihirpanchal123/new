import type { Server, Socket } from "socket.io";
import type { z } from "zod";
import { toPublic } from "@/server/game/engine";
import { GameError } from "@/server/game/errors";
import type { RoomBroadcaster } from "@/server/game/room-manager";
import { serializeRoomFor } from "@/server/game/serialize";
import type { ServerRoom } from "@/server/game/types";
import { payloadSchemas } from "@/lib/validation/schemas";
import type {
  AckResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/types/realtime";
import type { Container } from "../container";
import type { RateAction } from "../services/rate-limit";
import { parseCookies, SESSION_COOKIE, verifySession } from "../services/session";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomChannel = (code: string) => `room:${code}`;
const IDEMPOTENCY_TTL_MS = 60_000;

/**
 * Wires Socket.IO to the RoomManager. Every inbound command is: identified
 * (signed session) → validated (Zod) → rate-limited → de-duplicated
 * (actionId) → executed by the engine → acked. Clients never send state,
 * only intents.
 */
export function attachRealtime(io: GameServer, c: Container) {
  const { rooms, profiles, logger, rateLimiter, analytics, config } = c;

  /** playerId → the one socket that currently represents them. */
  const current = new Map<string, GameSocket>();
  /** `${playerId}:${actionId}` → cached ack, so retries don't double-apply. */
  const idempotency = new Map<string, { at: number; result: Promise<AckResult<unknown>> }>();

  c.presence = {
    onlinePlayers: () => current.size,
    isOnline: (id) => current.has(id),
  };

  const broadcaster: RoomBroadcaster = {
    emitState(room: ServerRoom) {
      const now = Date.now();
      for (const p of room.players) {
        const sock = current.get(p.id);
        if (!sock || !sock.data.watching.has(room.code)) continue;
        sock.emit(
          "room:state",
          serializeRoomFor(room, p.id, {
            now,
            countdownDurationMs: config.timings.countdownMs,
            graceMs: config.timings.disconnectGraceMs,
          }),
        );
      }
    },
    emitEvents(room, events) {
      for (const event of events) {
        io.to(roomChannel(room.code)).emit("game:event", { roomCode: room.code, version: room.version, event });
      }
    },
  };
  rooms.setBroadcaster(broadcaster);

  const viewFor = (room: ServerRoom, playerId: string) =>
    serializeRoomFor(room, playerId, {
      now: Date.now(),
            countdownDurationMs: config.timings.countdownMs,
      graceMs: config.timings.disconnectGraceMs,
    });

  // ───────────── authentication ─────────────
  io.use((socket, next) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies[SESSION_COOKIE] ?? (typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null);
    const playerId = verifySession(token, config.sessionSecret);
    if (!playerId) return next(new Error("UNAUTHORIZED"));
    profiles.ensure(playerId);
    socket.data.playerId = playerId;
    socket.data.watching = new Set();
    socket.data.ip = (socket.handshake.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || socket.handshake.address;
    next();
  });

  io.on("connection", (socket: GameSocket) => {
    const playerId = socket.data.playerId;
    profiles.touch(playerId);

    // One live socket per player: a newer tab/device takes over.
    const previous = current.get(playerId);
    current.set(playerId, socket);
    if (previous && previous.id !== socket.id) {
      logger.info("realtime", "session replaced by newer connection", { playerId });
      previous.emit("session:replaced");
      previous.disconnect(true);
    }

    /**
     * Wrap a handler: validate payload, rate limit, map errors to friendly
     * acks. `fn` returns the ack data.
     */
    function handle<S extends z.ZodType, R>(
      schema: S,
      action: RateAction,
      fn: (input: z.output<S>) => R | Promise<R>,
      opts: { idempotencyKey?: (input: z.output<S>) => string } = {},
    ) {
      return async (payload: unknown, ack?: (res: AckResult<R>) => void) => {
        const reply = (res: AckResult<R>) => {
          if (typeof ack === "function") ack(res);
        };
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          logger.suspect("realtime", "invalid payload", { playerId, action });
          return reply({ ok: false, error: "INVALID_INPUT", message: "That didn't look right." });
        }
        if (!rateLimiter.consume(action, playerId)) {
          logger.suspect("realtime", "rate limited", { playerId, action });
          return reply({ ok: false, error: "RATE_LIMITED", message: "Whoa, slow down a little!" });
        }

        const idemKey = opts.idempotencyKey ? `${playerId}:${opts.idempotencyKey(parsed.data)}` : null;
        if (idemKey) {
          const cached = idempotency.get(idemKey);
          if (cached) return reply((await cached.result) as AckResult<R>);
        }

        // Registered synchronously, so a duplicate arriving in the same tick awaits this same result.
        const execution = run(parsed.data);
        if (idemKey) idempotency.set(idemKey, { at: Date.now(), result: execution });
        reply(await execution);
      };

      async function run(input: z.output<S>): Promise<AckResult<R>> {
        try {
          return { ok: true, data: await fn(input) };
        } catch (err) {
          if (err instanceof GameError) {
            if (err.code === "NOT_YOUR_TURN" || err.code === "NOT_IN_ROOM") {
              logger.suspect("realtime", `rejected: ${err.code}`, { playerId, action });
            }
            return { ok: false, error: err.code, message: err.message, fieldErrors: err.fieldErrors };
          }
          logger.error("realtime", `handler "${action}" crashed`, { err: String(err), stack: (err as Error)?.stack });
          return { ok: false, error: "SERVER_ERROR", message: "Something went wrong on our side." };
        }
      }
    }

    const watch = (code: string) => {
      socket.join(roomChannel(code));
      socket.data.watching.add(code);
    };

    socket.on("clock:ping", (payload, ack) => {
      if (typeof ack === "function") ack({ serverNow: Date.now(), clientSentAt: Number(payload?.clientSentAt) || 0 });
    });

    socket.on(
      "room:create",
      handle(payloadSchemas.create, "createRoom", ({ settings }) => {
        const profile = profiles.ensure(playerId);
        const room = rooms.createRoom(toPublic(profile), settings);
        return { code: room.code };
      }),
    );

    socket.on(
      "room:join",
      handle(payloadSchemas.code, "joinRoom", ({ code }) => {
        const profile = profiles.ensure(playerId);
        const room = rooms.getRoom(code);
        const wasMember = room.players.some((p) => p.id === playerId && !p.left);
        // Watch first so the post-join broadcast reaches this socket too.
        watch(code);
        try {
          rooms.apply(code, (r, now) => [
            ...c.engine.updateProfile(r, toPublic(profile)),
            ...c.engine.joinGame(r, toPublic(profile), now),
          ]);
        } catch (err) {
          socket.leave(roomChannel(code));
          socket.data.watching.delete(code);
          throw err;
        }
        if (!wasMember) analytics.track("game_joined", { code });
        return viewFor(rooms.getRoom(code), playerId);
      }),
    );

    socket.on("room:unwatch", (payload) => {
      const parsed = payloadSchemas.code.safeParse(payload);
      if (!parsed.success) return;
      const { code } = parsed.data;
      socket.leave(roomChannel(code));
      socket.data.watching.delete(code);
      if (rooms.findRoom(code)) {
        try {
          rooms.apply(code, (r, now) => c.engine.setConnected(r, playerId, false, now));
        } catch {
          /* room may have closed */
        }
      }
    });

    socket.on(
      "room:leave",
      handle(payloadSchemas.code, "general", ({ code }) => {
        rooms.apply(code, (r, now) => c.engine.leaveGame(r, playerId, now));
        socket.leave(roomChannel(code));
        socket.data.watching.delete(code);
        return null;
      }),
    );

    socket.on(
      "room:settings",
      handle(payloadSchemas.settings, "ready", ({ code, settings }) => {
        rooms.apply(code, (r) => c.engine.updateSettings(r, playerId, settings));
        return null;
      }),
    );

    socket.on(
      "player:ready",
      handle(payloadSchemas.ready, "ready", ({ code, ready }) => {
        rooms.apply(code, (r, now) => c.engine.setPlayerReady(r, playerId, ready, now));
        return null;
      }),
    );

    socket.on(
      "chain:submit",
      handle(payloadSchemas.chain, "chain", async ({ code, words }) => {
        const expected = rooms.getRoom(code).settings.chainLength;
        if (words.length !== expected) {
          throw new GameError("INVALID_CHAIN", `This game uses ${expected} words per chain.`);
        }
        const validation = await c.wordValidation.validateChain(words, expected);
        if (!validation.valid) {
          throw new GameError("INVALID_CHAIN", "Some of your words need a tweak.", validation.fieldErrors);
        }
        rooms.apply(code, (r, now) => c.engine.submitChain(r, playerId, validation.words, now));
        analytics.track("word_submitted", { code });
        return null;
      }),
    );

    socket.on(
      "chain:unlock",
      handle(payloadSchemas.code, "chain", ({ code }) => {
        rooms.apply(code, (r) => c.engine.unlockChain(r, playerId));
        return null;
      }),
    );

    socket.on(
      "guess:submit",
      handle(
        payloadSchemas.guess,
        "guess",
        ({ code, turnId, guess }) => {
          const result = rooms.mutate(code, (r, now) => c.engine.submitGuess(r, playerId, { turnId, guess }, now));
          analytics.track("guess_submitted", { code });
          analytics.track(result.correct ? "guess_correct" : "guess_wrong", { code });
          return result;
        },
        { idempotencyKey: (i) => `guess:${i.actionId}` },
      ),
    );

    socket.on(
      "hint:request",
      handle(
        payloadSchemas.hint,
        "hint",
        ({ code, turnId, expectedRevealed }) => {
          const result = rooms.mutate(code, (r, now) =>
            c.engine.requestHint(r, playerId, { turnId, expectedRevealed }, now),
          );
          analytics.track("hint_used", { code });
          return result;
        },
        { idempotencyKey: (i) => `hint:${i.actionId}` },
      ),
    );

    socket.on(
      "rematch:request",
      handle(payloadSchemas.code, "rematch", ({ code }) => {
        rooms.apply(code, (r, now) => c.engine.requestRematch(r, playerId, now));
        analytics.track("rematch_requested", { code });
        return null;
      }),
    );

    socket.on(
      "rematch:respond",
      handle(payloadSchemas.rematchRespond, "rematch", ({ code, accept }) => {
        rooms.apply(code, (r, now) => c.engine.respondRematch(r, playerId, accept, now));
        if (accept) analytics.track("rematch_accepted", { code });
        return null;
      }),
    );

    socket.on(
      "rematch:cancel",
      handle(payloadSchemas.code, "rematch", ({ code }) => {
        rooms.apply(code, (r) => c.engine.cancelRematch(r, playerId));
        return null;
      }),
    );

    socket.on(
      "voice:signal",
      handle(payloadSchemas.voiceSignal, "voice", ({ code, signal }) => {
        if (!socket.data.watching.has(code)) throw new GameError("NOT_IN_ROOM");
        const room = rooms.getRoom(code);
        if (!room.players.some((p) => p.id === playerId && !p.left)) throw new GameError("NOT_IN_ROOM");
        const peer = room.players.find((p) => p.id !== playerId && !p.left);
        const peerSocket = peer && current.get(peer.id);
        if (peerSocket?.data.watching.has(code)) peerSocket.emit("voice:signal", { code, from: playerId, signal });
        return null;
      }),
    );

    socket.on("disconnect", () => {
      // A replaced socket must not mark the player offline.
      if (current.get(playerId) !== socket) return;
      current.delete(playerId);
      for (const code of socket.data.watching) {
        if (!rooms.findRoom(code)) continue;
        try {
          rooms.apply(code, (r, now) => c.engine.setConnected(r, playerId, false, now));
        } catch (err) {
          logger.warn("realtime", "disconnect handling failed", { code, err: String(err) });
        }
      }
    });
  });

  // Housekeeping for idempotency cache and rate limiter.
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [k, v] of idempotency) if (v.at < cutoff) idempotency.delete(k);
    rateLimiter.prune();
  }, 30_000);
  cleanup.unref?.();

  return {
    close() {
      clearInterval(cleanup);
    },
  };
}
