import { Crown, EyeOff, Flame, Link2, Lock, TrendingUp, Trophy, Users, Zap } from "lucide-react";
import type { AchievementDefinition } from "@/constants/achievements";
import { cn, formatDate } from "@/lib/utils";

const ICONS = {
  trophy: Trophy,
  "eye-off": EyeOff,
  link: Link2,
  zap: Zap,
  "trending-up": TrendingUp,
  flame: Flame,
  users: Users,
  crown: Crown,
} as const;

export function AchievementCard({ achievement, unlockedAt }: { achievement: AchievementDefinition; unlockedAt?: number }) {
  const Icon = ICONS[achievement.icon];
  const unlocked = unlockedAt !== undefined;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-3",
        unlocked ? "border-hint/40 bg-hint-soft" : "border-dashed border-border bg-surface/60",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl",
          unlocked ? "bg-hint-bright text-[#2a1a00] shadow-[0_3px_0_0_#d9901a]" : "bg-surface-2 text-muted",
        )}
      >
        {unlocked ? <Icon className="size-6" aria-hidden /> : <Lock className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className={cn("font-display font-semibold", !unlocked && "text-muted")}>{achievement.title}</p>
        <p className="text-sm text-muted">{achievement.description}</p>
        <p className="sr-only">{unlocked ? "Unlocked" : "Locked"}</p>
        {unlocked && <p className="text-xs font-bold text-hint dark:text-hint-bright">Unlocked {formatDate(unlockedAt)}</p>}
      </div>
    </div>
  );
}
