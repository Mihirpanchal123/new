"use client";

import { create } from "zustand";
import { setRealtimeToken } from "@/lib/realtime/client";
import type { ProfileView } from "@/types/game";

type Status = "idle" | "loading" | "ready" | "error";

interface SessionState {
  profile: ProfileView | null;
  status: Status;
  error: string | null;
  /** Fetches (or creates) the guest session. De-duplicates concurrent calls. */
  load: (force?: boolean) => Promise<ProfileView | null>;
  update: (patch: Partial<Pick<ProfileView, "displayName" | "avatar" | "color">>) => Promise<{ ok: boolean; error?: string }>;
}

let inflight: Promise<ProfileView | null> | null = null;

export const useSessionStore = create<SessionState>()((set, get) => ({
  profile: null,
  status: "idle",
  error: null,

  load: async (force = false) => {
    if (!force && get().status === "ready") return get().profile;
    if (inflight) return inflight;
    set({ status: get().profile ? "ready" : "loading", error: null });
    inflight = (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 429 ? "Too many requests — try again shortly." : "Couldn't start your session.");
        const data = (await res.json()) as { profile: ProfileView; token: string };
        setRealtimeToken(data.token);
        set({ profile: data.profile, status: "ready" });
        return data.profile;
      } catch (err) {
        set({ status: "error", error: (err as Error).message });
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  update: async (patch) => {
    try {
      const res = await fetch("/api/session", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { profile?: ProfileView; error?: string };
      if (!res.ok || !data.profile) return { ok: false, error: data.error ?? "Couldn't save your profile." };
      set({ profile: data.profile });
      return { ok: true };
    } catch {
      return { ok: false, error: "You seem to be offline." };
    }
  },
}));
