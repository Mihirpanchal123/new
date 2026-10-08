"use client";

import { useEffect } from "react";
import { gameEvents, getSocket } from "@/lib/realtime/client";
import { VoiceSession, voiceSupported } from "@/lib/realtime/voice";
import { useVoiceStore } from "@/stores/voice-store";
import type { VoiceSignal } from "@/types/realtime";

/**
 * Owns the room's voice session for as long as the game screen is mounted,
 * so a call carries over from lobby to setup to the duel and results.
 */
export function useVoiceChat(code: string, meId: string | null) {
  useEffect(() => {
    if (!meId || !voiceSupported()) return;
    const socket = getSocket();
    const session = new VoiceSession(code, meId, (state) => useVoiceStore.getState().sync(state));
    useVoiceStore.getState().attach(session);

    const onSignal = (payload: { code: string; from: string; signal: VoiceSignal }) => {
      if (payload.code === code && payload.from !== meId) session.handleSignal(payload.from, payload.signal);
    };
    const onConnect = () => session.announce();
    const offEvents = gameEvents.on(({ roomCode, event }) => {
      if (roomCode !== code) return;
      if ((event.type === "player.disconnected" || event.type === "player.left") && event.playerId !== meId) {
        session.peerGone();
      }
      if (event.type === "player.reconnected" && event.playerId !== meId) session.announce();
      if (event.type === "room.joined" && event.player.id !== meId) session.announce();
      if (event.type === "room.closed") session.leave();
    });

    socket.on("voice:signal", onSignal);
    socket.on("connect", onConnect);
    return () => {
      socket.off("voice:signal", onSignal);
      socket.off("connect", onConnect);
      offEvents();
      session.dispose();
      if (useVoiceStore.getState().session === session) useVoiceStore.getState().attach(null);
    };
  }, [code, meId]);
}
