"use client";

import { ArrowLeft, Check, Hourglass, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { describeSettings, type GameSettings } from "@/constants/game";
import { command } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";
import { selectMe, selectOpponent } from "@/stores/game-store";
import { useUiStore } from "@/stores/ui-store";
import type { PlayerView, RoomView } from "@/types/game";
import { ConnectionIndicator } from "../game/connection-indicator";
import { VoiceControl } from "../game/voice-control";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Badge, Card } from "../ui/primitives";
import { GameSettingsPicker } from "./game-settings-picker";
import { CopyCodeButton, RoomCode, ShareRoomButton } from "./room-code";

function PlayerSlot({ player, isMe }: { player: PlayerView | null; isMe?: boolean }) {
  return (
    <Card className={cn("flex flex-col items-center gap-3 px-3 py-5 text-center", !player && "border-dashed bg-surface/50 shadow-none")}>
      <AnimatePresence mode="wait">
        {player ? (
          <motion.div
            key={player.id}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <PlayerAvatar avatar={player.avatar} color={player.color} size="lg" bob online={player.connected} active={player.ready} />
            <div className="min-w-0 max-w-full">
              <p className="truncate font-display text-lg font-semibold">{player.displayName}</p>
              <p className="text-xs font-bold text-muted">{isMe ? "You" : player.isHost ? "Host" : "Challenger"}</p>
            </div>
            <Badge tone={player.ready ? "success" : "neutral"}>
              {player.ready ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
              {player.ready ? "Ready" : player.connected ? "Waiting" : "Offline"}
            </Badge>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <motion.div
              className="grid size-20 place-items-center rounded-[1.4rem] border-2 border-dashed border-border-strong text-muted"
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <UserPlus className="size-8" aria-hidden />
            </motion.div>
            <p className="font-display text-lg font-semibold text-muted">Open seat</p>
            <Badge>Invite a friend</Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function Lobby({ room }: { room: RoomView }) {
  const router = useRouter();
  const me = selectMe(room)!;
  const opponent = selectOpponent(room);
  const [pending, setPending] = useState<"ready" | "leave" | null>(null);

  async function toggleReady() {
    setPending("ready");
    const res = await command("player:ready", { code: room.code, ready: !me.ready });
    setPending(null);
    if (!res.ok) toast.error(res.message);
  }

  async function changeSettings(settings: GameSettings) {
    useUiStore.getState().set({ gameSettings: settings });
    const res = await command("room:settings", { code: room.code, settings });
    if (!res.ok) toast.error(res.message);
  }

  async function leave() {
    setPending("leave");
    await command("room:leave", { code: room.code });
    router.push("/play");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leave} loading={pending === "leave"}>
          <ArrowLeft className="size-4" aria-hidden /> Leave
        </Button>
        <div className="flex items-center gap-1.5">
          {opponent && <VoiceControl opponentName={opponent.displayName} />}
          <ConnectionIndicator />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 pb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            {opponent ? "Duel ready to go" : "Waiting for your opponent…"}
          </h1>
          <p className="mt-2 text-muted">
            {opponent ? "Both players ready up to start building chains." : "Share the code — the game starts when they join."}
          </p>
        </motion.div>

        <Card className="flex flex-col items-center gap-5 px-4 py-6">
          <RoomCode code={room.code} />
          <div className="grid w-full max-w-sm grid-cols-2 gap-2.5">
            <CopyCodeButton code={room.code} />
            <ShareRoomButton code={room.code} />
          </div>
        </Card>

        <Card className="flex flex-col gap-3 px-4 py-5">
          <div className="flex flex-col px-1">
            <h2 className="font-display text-lg font-semibold">Game settings</h2>
            <span className="text-xs font-bold text-muted">
              {me.isHost ? "Changing these un-readies both players" : "Only the host can change these"}
            </span>
          </div>
          <GameSettingsPicker value={room.settings} onChange={(s) => void changeSettings(s)} disabled={!me.isHost} />
          <p className="sr-only" aria-live="polite">
            {describeSettings(room.settings)}
          </p>
        </Card>

        <div className="relative grid grid-cols-2 gap-3">
          <PlayerSlot player={me} isMe />
          <PlayerSlot player={opponent} />
          <span className="absolute left-1/2 top-[34%] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[var(--bg)] bg-surface-3 font-display text-sm font-bold text-muted">
            VS
          </span>
        </div>

        {!opponent && (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted">
            <Hourglass className="size-4 animate-pulse" aria-hidden />
            Rooms stay open while you wait.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:-mx-6 sm:px-6">
        <Button
          size="xl"
          variant={me.ready ? "secondary" : "primary"}
          className="w-full"
          onClick={toggleReady}
          loading={pending === "ready"}
        >
          {me.ready ? (
            <>
              <Check className="size-6 text-success" aria-hidden />
              {opponent ? `Ready! Waiting for ${opponent.displayName}…` : "Ready! Waiting for a challenger…"}
            </>
          ) : (
            "I'm ready"
          )}
        </Button>
        {me.ready && <p className="mt-2 text-center text-xs font-semibold text-muted">Tap again to un-ready.</p>}
      </div>
    </div>
  );
}
