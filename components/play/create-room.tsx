"use client";

import { Swords } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { command, getSocket } from "@/lib/realtime/client";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "../ui/button";

/** Creates a room as soon as the page loads, then jumps into its lobby. */
export function CreateRoom() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const create = useCallback(async () => {
    setError(null);
    const profile = await useSessionStore.getState().load();
    if (!profile) {
      setError("We couldn't start your session. Check your connection and try again.");
      return;
    }
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
      const connected = await new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
          socket.off("connect", onOk);
          socket.off("connect_error", onErr);
          clearTimeout(timer);
          resolve(ok);
        };
        const onOk = () => done(true);
        const onErr = () => done(false);
        const timer = setTimeout(() => done(false), 8000);
        socket.once("connect", onOk);
        socket.once("connect_error", onErr);
      });
      if (!connected) {
        setError("Couldn't reach the game server. Try again in a moment.");
        return;
      }
    }
    const res = await command("room:create", {});
    if (res.ok) router.replace(`/game/${res.data.code}`);
    else setError(res.message);
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void create();
  }, [create]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        className="grid size-24 place-items-center rounded-[2rem] bg-brand text-brand-ink shadow-[0_6px_0_0_var(--brand-deep)]"
        animate={error ? { rotate: 0 } : { rotate: [0, -8, 8, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 1.2, repeat: error ? 0 : Infinity }}
      >
        <Swords className="size-11" aria-hidden />
      </motion.div>
      {error ? (
        <>
          <div>
            <h1 className="font-display text-3xl font-semibold">Hmm, that didn&apos;t work</h1>
            <p className="mt-2 text-muted" role="alert">{error}</p>
          </div>
          <Button size="lg" onClick={() => void create()}>
            Try again
          </Button>
        </>
      ) : (
        <div aria-live="polite">
          <h1 className="font-display text-3xl font-semibold">Setting up your duel…</h1>
          <p className="mt-2 text-muted">Grabbing a fresh game code.</p>
        </div>
      )}
    </div>
  );
}
