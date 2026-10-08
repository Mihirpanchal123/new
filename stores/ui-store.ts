"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameSettings } from "@/constants/game";

export type MotionPreference = "system" | "reduce" | "full";

interface UiState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  motion: MotionPreference;
  hasSeenTutorial: boolean;
  /** Last game settings this device chose (null = server default); new rooms and local games start from these. */
  gameSettings: GameSettings | null;
  set: (patch: Partial<Omit<UiState, "set">>) => void;
}

/** Local, per-device preferences. Never game state. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: false,
      hapticsEnabled: true,
      notificationsEnabled: true,
      motion: "system",
      hasSeenTutorial: false,
      gameSettings: null,
      set: (patch) => set(patch),
    }),
    {
      name: "word-duel:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
