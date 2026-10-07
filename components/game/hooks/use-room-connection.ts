"use client";

import { useEffect } from "react";
import { command, gameEvents, getSocket } from "@/lib/realtime/client";
import { useGameStore } from "@/stores/game-store";
import { useSessionStore } from "@/stores/session-store";
import type { RoomView } from "@/types/game";
import type { GameEventEnvelope } from "@/types/realtime";

/** Grace for StrictMode/fast remounts before telling the server we left the screen. */
const UNWATCH_DELAY_MS = 400;
let pendingUnwatch: { code: string; timer: ReturnType<typeof setTimeout> } | null = null;

/**
 * Connects to the realtime server, joins/re-syncs the room on every
 * (re)connect, keeps the store fed with authoritative snapshots and forwards
 * transient events to the event bus. Server state always wins.
 */
export function useRoomConnection(code: string) {
  useEffect(() => {
    let cancelled = false;
    let authRetries = 0;
    const socket = getSocket();
    const game = useGameStore.getState();

    if (pendingUnwatch?.code === code) {
      clearTimeout(pendingUnwatch.timer);
      pendingUnwatch = null;
    } else {
      game.reset();
    }

    const join = async () => {
      const res = await command("room:join", { code });
      if (cancelled) return;
      if (res.ok) {
        useGameStore.getState().applySnapshot(res.data);
      } else if (socket.connected) {
        useGameStore.getState().setFailure({ code: res.error, message: res.message });
      }
    };

    /** Estimate server clock offset from the lowest-latency of a few pings. */
    const syncClock = async () => {
      let best: { rtt: number; offset: number } | null = null;
      for (let i = 0; i < 4 && !cancelled && socket.connected; i++) {
        const sent = Date.now();
        try {
          const res = await socket.timeout(2000).emitWithAck("clock:ping", { clientSentAt: sent });
          const recv = Date.now();
          const rtt = recv - sent;
          const offset = res.serverNow - (sent + rtt / 2);
          if (!best || rtt < best.rtt) best = { rtt, offset };
        } catch {
          break;
        }
      }
      if (best && !cancelled) useGameStore.getState().setClock(best.offset);
    };

    const onConnect = () => {
      authRetries = 0;
      useGameStore.getState().setConnection("online");
      void join();
      void syncClock();
    };
    const onDisconnect = (reason: string) => {
      useGameStore.getState().setConnection(reason === "io client disconnect" ? "offline" : "reconnecting");
    };
    const onConnectError = async (err: Error) => {
      if (err.message === "UNAUTHORIZED" && authRetries < 2) {
        authRetries++;
        await useSessionStore.getState().load(true);
        if (!cancelled) socket.connect();
        return;
      }
      useGameStore.getState().setConnection(navigator.onLine ? "reconnecting" : "offline");
    };
    const onState = (view: RoomView) => {
      if (view.code === code) useGameStore.getState().applySnapshot(view);
    };
    const onEvent = (env: GameEventEnvelope) => {
      if (env.roomCode === code) gameEvents.emit(env);
    };
    const onReplaced = () => {
      useGameStore.getState().setFailure({
        code: "SESSION_REPLACED",
        message: "This game is open in another tab or device.",
      });
    };
    const onOffline = () => useGameStore.getState().setConnection("offline");
    const onOnline = () => {
      useGameStore.getState().setConnection("reconnecting");
      if (!socket.connected) socket.connect();
    };
    // Coming back to a backgrounded tab: make sure we're current.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) socket.connect();
      else void join();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("room:state", onState);
    socket.on("game:event", onEvent);
    socket.on("session:replaced", onReplaced);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    void (async () => {
      const profile = await useSessionStore.getState().load();
      if (cancelled) return;
      if (!profile) {
        useGameStore.getState().setFailure({ code: "SERVER_ERROR", message: "We couldn't start your session." });
        return;
      }
      if (socket.connected) onConnect();
      else {
        useGameStore.getState().setConnection("connecting");
        socket.connect();
      }
    })();

    return () => {
      cancelled = true;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:state", onState);
      socket.off("game:event", onEvent);
      socket.off("session:replaced", onReplaced);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);

      if (pendingUnwatch) clearTimeout(pendingUnwatch.timer);
      pendingUnwatch = {
        code,
        timer: setTimeout(() => {
          pendingUnwatch = null;
          if (socket.connected) socket.emit("room:unwatch", { code });
        }, UNWATCH_DELAY_MS),
      };
    };
  }, [code]);
}

/** Re-take the session after another tab took over. */
export function reclaimSession() {
  const socket = getSocket();
  useGameStore.getState().setFailure(null);
  if (!socket.connected) socket.connect();
}
