"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MotionPreference = "system" | "reduce" | "full";

interface UiState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  motion: MotionPreference;
  hasSeenTutorial: boolean;
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
