"use client";

import { create } from "zustand";
import type { PlayerView, RoomView } from "@/types/game";

export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline";

export interface GameFailure {
  code: string;
  message: string;
}

interface GameState {
  room: RoomView | null;
  /** serverTime ≈ Date.now() + clockOffset */
  clockOffset: number;
  clockSynced: boolean;
  connection: ConnectionStatus;
  failure: GameFailure | null;

  /** Apply an authoritative snapshot; older versions are ignored. */
  applySnapshot: (view: RoomView) => void;
  setClock: (offset: number) => void;
  setConnection: (status: ConnectionStatus) => void;
  setFailure: (failure: GameFailure | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  room: null,
  clockOffset: 0,
  clockSynced: false,
  connection: "connecting",
  failure: null,

  applySnapshot: (view) => {
    const current = get().room;
    if (current && current.code === view.code && view.version < current.version) return;
    const patch: Partial<GameState> = { room: view, failure: null };
    // Rough offset until a proper ping-based sync lands.
    if (!get().clockSynced) patch.clockOffset = view.serverNow - Date.now();
    set(patch);
  },
  setClock: (offset) => set({ clockOffset: offset, clockSynced: true }),
  setConnection: (connection) => set({ connection }),
  setFailure: (failure) => set({ failure }),
  reset: () => set({ room: null, failure: null, connection: "connecting" }),
}));

// ───────────── derived selectors ─────────────

export function selectMe(room: RoomView | null): PlayerView | null {
  return room?.players.find((p) => p.id === room.meId) ?? null;
}

export function selectOpponent(room: RoomView | null): PlayerView | null {
  return room?.players.find((p) => p.id !== room.meId) ?? null;
}

export function serverNow(offset: number): number {
  return Date.now() + offset;
}
