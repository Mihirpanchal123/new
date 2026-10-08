"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { PlayerView } from "@/types/game";
import { PlayerAvatar } from "../player/player-avatar";

/** Number that counts up/down smoothly to its target. */
export function ScoreDisplay({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return (
    <motion.span className={cn("font-display font-bold tabular", className)} aria-label={`${value} points`}>
      {rounded}
    </motion.span>
  );
}

function Side({
  player,
  score,
  active,
  isMe,
  align,
}: {
  player: PlayerView;
  score: number;
  active: boolean;
  isMe: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3", align === "right" && "flex-row-reverse text-right")}>
      <PlayerAvatar avatar={player.avatar} color={player.color} size="sm" active={active} online={player.connected && !player.left} />
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold leading-tight sm:text-base">
          {player.displayName}
          {isMe && <span className="ml-1 hidden text-xs font-bold text-muted min-[420px]:inline">(you)</span>}
        </p>
        <ScoreDisplay value={score} className="text-xl leading-none sm:text-2xl" />
      </div>
    </div>
  );
}

/** Me vs opponent with live scores. Works down to 320px. */
export function PlayerHeader({
  me,
  opponent,
  scores,
  activeId,
  showYou = true,
}: {
  me: PlayerView;
  opponent: PlayerView;
  scores: Record<string, number>;
  activeId: string | null;
  /** Off for one-screen games, where neither side is "you". */
  showYou?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Side player={me} score={scores[me.id] ?? 0} active={activeId === me.id} isMe={showYou} align="left" />
      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-1 font-display text-xs font-bold text-muted">VS</span>
      <Side player={opponent} score={scores[opponent.id] ?? 0} active={activeId === opponent.id} isMe={false} align="right" />
    </div>
  );
}
