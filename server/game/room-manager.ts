import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_TTL } from "@/constants/game";
import type { Analytics } from "@/lib/analytics";
import type { PublicProfile, RoomPhase } from "@/types/game";
import type { GameEvent } from "@/types/realtime";
import type { Logger } from "../services/logger";
import type { ProfileStore } from "../services/profile-store";
import type { ActionResult, GameEngine } from "./engine";
import { GameError } from "./errors";
import { buildMatchRecord } from "./records";
import type { ServerRoom } from "./types";

export interface RoomBroadcaster {
  /** Push the per-viewer snapshot to everyone watching the room. */
  emitState(room: ServerRoom): void;
  emitEvents(room: ServerRoom, events: GameEvent[]): void;
}

export interface RoomSummary {
  code: string;
  phase: RoomPhase;
  playerCount: number;
  isMember: boolean;
  joinable: boolean;
}

/**
 * Owns live rooms: lookup, unique codes, the single timer per room, expiry,
 * and turning engine output into broadcasts + persisted match records.
 * Node is single-threaded and every mutation here is synchronous, so each
 * action is atomic with respect to timers and other players' actions.
 */
export class RoomManager {
  private rooms = new Map<string, ServerRoom>();
  private retired = new Map<string, number>();
  private timers = new Map<string, NodeJS.Timeout>();
  private broadcaster: RoomBroadcaster | null = null;
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    readonly engine: GameEngine,
    private readonly profiles: ProfileStore,
    private readonly analytics: Analytics,
    private readonly logger: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  setBroadcaster(b: RoomBroadcaster) {
    this.broadcaster = b;
  }

  startSweeper(intervalMs = 60_000) {
    this.sweeper ??= setInterval(() => this.sweep(), intervalMs);
    this.sweeper.unref?.();
  }

  stop() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  // ───────────── lookup ─────────────

  createRoom(host: PublicProfile): ServerRoom {
    const code = this.generateCode();
    const room = this.engine.createGame(code, host, this.now());
    this.rooms.set(code, room);
    this.analytics.track("game_created", { code });
    this.logger.info("rooms", `room ${code} created`, { host: host.id });
    return room;
  }

  getRoom(code: string): ServerRoom {
    const room = this.rooms.get(code);
    if (room) return room;
    if (this.retired.has(code)) throw new GameError("ROOM_EXPIRED");
    throw new GameError("ROOM_NOT_FOUND");
  }

  findRoom(code: string): ServerRoom | undefined {
    return this.rooms.get(code);
  }

  summary(code: string, viewerId: string | null): RoomSummary | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const active = room.players.filter((p) => !p.left);
    const isMember = !!viewerId && active.some((p) => p.id === viewerId);
    return {
      code,
      phase: room.phase,
      playerCount: active.length,
      isMember,
      joinable: isMember || (room.phase === "LOBBY" && active.length < 2),
    };
  }

  isRetired(code: string): boolean {
    return this.retired.has(code);
  }

  allRooms(): ServerRoom[] {
    return [...this.rooms.values()];
  }

  roomsForPlayer(playerId: string): ServerRoom[] {
    return this.allRooms().filter((r) => r.players.some((p) => p.id === playerId && !p.left));
  }

  // ───────────── mutation ─────────────

  /**
   * Run one engine action against a room. Bumps the version, persists match
   * results, reschedules the room timer and broadcasts — in that order.
   */
  mutate<T>(code: string, action: (room: ServerRoom, now: number) => ActionResult<T>): T {
    const room = this.getRoom(code);
    const now = this.now();
    const { events, data } = action(room, now);
    this.commit(room, events, now);
    return data;
  }

  /** Convenience for actions that only return events. */
  apply(code: string, action: (room: ServerRoom, now: number) => GameEvent[]): void {
    this.mutate(code, (room, now) => ({ events: action(room, now), data: null }));
  }

  /** Engine timer callback: process whatever is due. */
  tick(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    try {
      const now = this.now();
      const events = this.engine.tick(room, now);
      if (events.length) this.commit(room, events, now);
      else this.schedule(room);
    } catch (err) {
      this.logger.error("rooms", `tick failed for ${code}`, { err: String(err) });
      this.schedule(room);
    }
  }

  private commit(room: ServerRoom, events: GameEvent[], now: number) {
    room.version += 1;
    room.updatedAt = now;

    for (const ev of events) {
      if (ev.type === "game.complete") events.push(...this.onMatchComplete(room));
      if (ev.type === "game.start") this.analytics.track("game_started", { code: room.code });
      if (ev.type === "player.disconnected") this.analytics.track("player_disconnected", { code: room.code });
    }

    this.schedule(room);
    this.broadcaster?.emitState(room);
    if (events.length) this.broadcaster?.emitEvents(room, events);

    if (room.phase === "CLOSED") this.removeRoom(room.code);
  }

  private onMatchComplete(room: ServerRoom): GameEvent[] {
    const record = buildMatchRecord(room);
    if (!record) return [];
    this.analytics.track("game_completed", {
      code: room.code,
      endReason: record.endReason,
      draw: record.winnerId === null,
    });
    const unlocked = this.profiles.recordMatch(record, room.match?.maxDeficit ?? {});
    return Object.entries(unlocked).map(([playerId, achievements]) => ({
      type: "achievement.unlocked" as const,
      playerId,
      achievements,
    }));
  }

  private schedule(room: ServerRoom) {
    const existing = this.timers.get(room.code);
    if (existing) clearTimeout(existing);
    this.timers.delete(room.code);

    const deadline = this.engine.nextDeadline(room);
    if (deadline === null) return;
    const delay = Math.max(0, deadline - this.now()) + 5;
    const timer = setTimeout(() => {
      this.timers.delete(room.code);
      this.tick(room.code);
    }, delay);
    timer.unref?.();
    this.timers.set(room.code, timer);
  }

  // ───────────── lifecycle ─────────────

  private removeRoom(code: string) {
    const t = this.timers.get(code);
    if (t) clearTimeout(t);
    this.timers.delete(code);
    this.rooms.delete(code);
    this.retired.set(code, this.now());
  }

  /** Close idle / finished / abandoned rooms and release old codes. */
  sweep(): void {
    const now = this.now();
    for (const room of this.allRooms()) {
      const nobodyHere = room.players.every((p) => !p.connected);
      const idle = now - room.updatedAt;
      let reason: string | null = null;
      if (idle > ROOM_TTL.idleMs) reason = "This room expired after being idle.";
      else if (room.phase === "COMPLETE" && room.completedAt && now - room.completedAt > ROOM_TTL.completedMs)
        reason = "This room has closed.";
      else if (nobodyHere && idle > ROOM_TTL.abandonedMs) reason = "Everyone left the room.";

      if (reason) {
        const events = this.engine.close(room, reason);
        this.commit(room, events, now);
      }
    }
    for (const [code, at] of this.retired) {
      if (now - at > ROOM_TTL.retiredCodeMs) this.retired.delete(code);
    }
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code) && !this.retired.has(code)) return code;
    }
    throw new GameError("SERVER_ERROR", "Couldn't allocate a room code. Try again.");
  }

  stats() {
    const rooms = this.allRooms();
    return {
      rooms: rooms.length,
      activeGames: rooms.filter((r) => r.phase === "PLAYING" || r.phase === "COUNTDOWN").length,
      lobbies: rooms.filter((r) => r.phase === "LOBBY" || r.phase === "SETUP").length,
      completed: rooms.filter((r) => r.phase === "COMPLETE").length,
    };
  }
}
