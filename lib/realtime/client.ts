"use client";

import { io, type Socket } from "socket.io-client";
import type { AckResult, ClientToServerEvents, ServerToClientEvents } from "@/types/realtime";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let authToken: string | null = null;

/** Token fallback for cross-origin realtime servers where cookies aren't sent. */
export function setRealtimeToken(token: string | null) {
  authToken = token;
}

export function getSocket(): GameSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL || undefined;
    socket = io(url ?? "", {
      path: "/socket.io",
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
      auth: (cb) => cb(authToken ? { token: authToken } : {}),
    });
  }
  return socket;
}

type EventName = keyof ClientToServerEvents;
type PayloadOf<E extends EventName> = Parameters<ClientToServerEvents[E]>[0];
type AckDataOf<E extends EventName> =
  Parameters<ClientToServerEvents[E]> extends [unknown, (res: AckResult<infer T>) => void] ? T : never;

/**
 * Emit a command and await the server's ack. Never throws: timeouts and
 * disconnects resolve to a friendly error result.
 */
export async function command<E extends EventName>(
  event: E,
  payload: PayloadOf<E>,
  timeoutMs = 8000,
): Promise<AckResult<AckDataOf<E>>> {
  const s = getSocket();
  if (!s.connected) {
    return { ok: false, error: "SERVER_ERROR", message: "You're offline — reconnecting…" };
  }
  try {
    // socket.io's typings can't express our generic map; the contract is enforced by the types above.
    const emitter = s.timeout(timeoutMs) as unknown as {
      emitWithAck: (e: string, p: unknown) => Promise<AckResult<AckDataOf<E>>>;
    };
    return await emitter.emitWithAck(event, payload);
  } catch {
    return { ok: false, error: "SERVER_ERROR", message: "Connection hiccup — please try again." };
  }
}

export { gameEvents } from "./events";
