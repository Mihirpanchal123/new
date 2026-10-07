"use client";

import { Bird, Brain, Cat, Crown, Flame, Ghost, Moon, Rocket, Sparkles, Star, Target, Zap, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { AVATAR_COLORS, AVATAR_LABELS, type AvatarColor, type AvatarId } from "@/constants/profile";
import { cn } from "@/lib/utils";

export const AVATAR_ICONS: Record<AvatarId, LucideIcon> = {
  bolt: Zap,
  flame: Flame,
  moon: Moon,
  brain: Brain,
  target: Target,
  rocket: Rocket,
  ghost: Ghost,
  cat: Cat,
  bird: Bird,
  crown: Crown,
  star: Star,
  sparkles: Sparkles,
};

const SIZES = {
  xs: "size-7 rounded-lg [&_svg]:size-4",
  sm: "size-10 rounded-xl [&_svg]:size-5",
  md: "size-14 rounded-2xl [&_svg]:size-7",
  lg: "size-20 rounded-[1.4rem] [&_svg]:size-10",
  xl: "size-28 rounded-[1.8rem] [&_svg]:size-14",
};

interface Props {
  avatar: AvatarId;
  color: AvatarColor;
  size?: keyof typeof SIZES;
  /** Glowing ring — e.g. it's this player's turn. */
  active?: boolean;
  /** Presence dot. undefined = hide. */
  online?: boolean;
  /** Gentle idle bob (lobby, waiting). */
  bob?: boolean;
  className?: string;
  label?: string;
}

export function PlayerAvatar({ avatar, color, size = "md", active, online, bob, className, label }: Props) {
  const Icon = AVATAR_ICONS[avatar] ?? Star;
  const hex = AVATAR_COLORS[color] ?? AVATAR_COLORS.violet;
  return (
    <motion.span
      role="img"
      aria-label={label ?? `${AVATAR_LABELS[avatar]} avatar`}
      className={cn("relative inline-grid shrink-0 place-items-center text-white", SIZES[size], className)}
      style={{
        background: `linear-gradient(160deg, color-mix(in oklab, ${hex} 85%, white) 0%, ${hex} 55%, color-mix(in oklab, ${hex} 80%, black) 100%)`,
        boxShadow: active
          ? `0 0 0 3px var(--bg), 0 0 0 6px ${hex}, 0 8px 24px -6px ${hex}`
          : `inset 0 -3px 0 rgba(0,0,0,0.18), 0 6px 16px -8px ${hex}`,
      }}
      animate={bob ? { y: [0, -4, 0] } : undefined}
      transition={bob ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <Icon strokeWidth={2.4} aria-hidden />
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[2.5px] border-[var(--bg)]",
            online ? "bg-success" : "bg-muted",
          )}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </motion.span>
  );
}
