import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import { DEFAULT_TIMINGS, type Timings } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
import { createContainer, type Container } from "@/server/container";
import { attachRealtime, type GameServer } from "@/server/realtime/socket-server";
import { signSession } from "@/server/services/session";
import type { RoomView } from "@/types/game";
import type { ClientToServerEvents, GameEventEnvelope, ServerToClientEvents } from "@/types/realtime";

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents> & {
  playerId: string;
  states: RoomView[];
  events: GameEventEnvelope[];
  /** Every raw packet payload received, for leak checks. */
  raw: string[];
};

export interface TestServer {
  url: string;
  container: Container;
  http: HttpServer;
  io: GameServer;
  client(playerId?: string): Promise<TestClient>;
  close(): Promise<void>;
}

const SECRET = "realtime-test-secret";

export async function startTestServer(timings: Partial<Timings> = {}): Promise<TestServer> {
  const container = createContainer({
    config: {
      isProduction: false,
      timings: { ...DEFAULT_TIMINGS, ...timings },
      scoring: { ...SCORING },
      sessionSecret: SECRET,
      adminToken: null,
      adminShowSecrets: false,
      persistence: "memory",
      dataFile: "",
      corsOrigins: [],
    },
  });
  const http = createServer();
  const io: GameServer = new Server(http, { path: "/socket.io" });
  const rt = attachRealtime(io, container);
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const clients: Socket[] = [];

  return {
    url,
    container,
    http,
    io,
    async client(playerId?: string) {
      const id = playerId ?? container.profiles.createGuest().id;
      const socket = ioClient(url, {
        path: "/socket.io",
        transports: ["websocket"],
        extraHeaders: { cookie: `wd_session=${signSession(id, SECRET)}` },
        reconnection: false,
        forceNew: true,
      }) as TestClient;
      socket.playerId = id;
      socket.states = [];
      socket.events = [];
      socket.raw = [];
      socket.on("room:state", (s) => socket.states.push(s));
      socket.on("game:event", (e) => socket.events.push(e));
      socket.onAny((_event, ...args) => socket.raw.push(JSON.stringify(args)));
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
      });
      return socket;
    },
    async close() {
      for (const c of clients) c.disconnect();
      rt.close();
      container.rooms.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

export function rawClient(url: string, cookie: string) {
  return ioClient(url, { path: "/socket.io", transports: ["websocket"], extraHeaders: { cookie }, reconnection: false, forceNew: true });
}

/** Resolve once `fn` returns something truthy, polling briefly. */
export async function waitFor<T>(fn: () => T | undefined | false | null, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
}

export function latest(c: TestClient): RoomView {
  const s = c.states.at(-1);
  if (!s) throw new Error("no state yet");
  return s;
}
