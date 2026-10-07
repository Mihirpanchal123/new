"use client";

import { Ghost, MonitorSmartphone, SearchX, ShieldAlert, Users, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { reclaimSession } from "./hooks/use-room-connection";

const COPY: Record<string, { title: string; icon: ReactNode }> = {
  ROOM_NOT_FOUND: { title: "Game not found", icon: <SearchX className="size-9" /> },
  ROOM_EXPIRED: { title: "This game has ended", icon: <Ghost className="size-9" /> },
  ROOM_FULL: { title: "This duel is full", icon: <Users className="size-9" /> },
  GAME_IN_PROGRESS: { title: "Duel already started", icon: <Users className="size-9" /> },
  GAME_OVER: { title: "This duel is over", icon: <Ghost className="size-9" /> },
  SESSION_REPLACED: { title: "Open somewhere else", icon: <MonitorSmartphone className="size-9" /> },
  UNAUTHORIZED: { title: "Session expired", icon: <ShieldAlert className="size-9" /> },
};

/** Friendly dead-end with a clear way forward. */
export function GameFailure({ code, message }: { code: string; message: string }) {
  const copy = COPY[code] ?? { title: "Something went wrong", icon: <WifiOff className="size-9" /> };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <motion.div
        initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="grid size-20 place-items-center rounded-[1.6rem] bg-surface text-muted shadow-card"
      >
        {copy.icon}
      </motion.div>
      <div>
        <h1 className="font-display text-3xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-muted">{message}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {code === "SESSION_REPLACED" ? (
          <Button size="lg" onClick={reclaimSession}>
            Play here instead
          </Button>
        ) : (
          <Link
            href="/create"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand font-display text-lg font-semibold text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)] active:translate-y-[3px] active:shadow-none"
          >
            Start a new game
          </Link>
        )}
        <Link
          href="/join"
          className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-border bg-surface font-display font-semibold"
        >
          Join with a code
        </Link>
      </div>
    </div>
  );
}

export function GameSkeleton({ label = "Joining game…" }: { label?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pt-6" aria-busy aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-xl bg-surface-3" />
        <div className="h-5 w-28 animate-pulse rounded-lg bg-surface-3" />
        <div className="ml-auto h-5 w-20 animate-pulse rounded-lg bg-surface-3" />
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-surface-3/70" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-3/60" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
      <p className="mt-2 text-center font-display font-semibold text-muted">{label}</p>
    </div>
  );
}
