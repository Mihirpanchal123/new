"use client";

import { create } from "zustand";
import { INITIAL_VOICE_STATE, type VoiceSession, type VoiceState } from "@/lib/realtime/voice";

interface VoiceStore extends VoiceState {
  /** The live session for the current room, if any. */
  session: VoiceSession | null;
  attach: (session: VoiceSession | null) => void;
  sync: (state: VoiceState) => void;
}

/** UI mirror of the room's voice session. The session itself owns the media. */
export const useVoiceStore = create<VoiceStore>()((set) => ({
  ...INITIAL_VOICE_STATE,
  session: null,
  attach: (session) => set({ ...INITIAL_VOICE_STATE, session }),
  sync: (state) => set(state),
}));
