import { Gamepad2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AchievementCard } from "@/components/player/achievement-card";
import { EditProfileButton, EnsureSession } from "@/components/player/profile-actions";
import { PlayerAvatar } from "@/components/player/player-avatar";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from "@/constants/achievements";
import { cn, formatDate, formatPercent } from "@/lib/utils";
import { getContainer } from "@/server/container";
import { getSessionPlayerId } from "@/server/http";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{label}</span>
      <span className="font-display text-3xl font-bold tabular">{value}</span>
    </Card>
  );
}

export default async function ProfilePage() {
  const playerId = await getSessionPlayerId();
  const { profiles } = getContainer();
  const profile = playerId ? profiles.get(playerId) : undefined;

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EnsureSession hasSession={false} />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  const s = profile.stats;
  const history = profiles.getHistory(profile.id, 15);
  const avg = s.gamesPlayed ? Math.round(s.totalScore / s.gamesPlayed) : 0;
  const unlockedCount = Object.keys(profile.achievements).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <EnsureSession hasSession />
      <section className="flex items-center gap-4">
        <PlayerAvatar avatar={profile.avatar} color={profile.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold">{profile.displayName}</h1>
          <p className="text-sm font-semibold text-muted">Playing since {formatDate(profile.createdAt)} · Guest</p>
        </div>
        <EditProfileButton />
      </section>

      <section aria-labelledby="stats">
        <h2 id="stats" className="sr-only">Stats</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Games" value={s.gamesPlayed} />
          <Stat label="Wins" value={s.wins} />
          <Stat label="Win rate" value={s.gamesPlayed ? formatPercent(s.wins / s.gamesPlayed) : "—"} />
          <Stat label="Best score" value={s.bestScore} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Losses" value={s.losses} />
          <Stat label="Avg. score" value={avg} />
          <Stat label="Perfect games" value={s.perfectGames} />
          <Stat label="Hints used" value={s.hintsUsed} />
        </div>
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 font-display text-2xl font-semibold">Recent matches</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={<Gamepad2 className="size-7" />}
            title="No matches yet"
            action={
              <Link href="/play" className="mt-1 font-bold text-brand underline-offset-4 hover:underline">
                Play your first duel →
              </Link>
            }
          >
            Your duels will show up here once you finish one.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((m) => {
              const me = m.players.find((p) => p.id === profile.id)!;
              const opp = m.players.find((p) => p.id !== profile.id)!;
              const result = m.winnerId === null ? "DRAW" : m.winnerId === profile.id ? "WIN" : "LOSS";
              return (
                <li key={m.id}>
                  <Link
                    href={`/results/${m.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                  >
                    <PlayerAvatar avatar={opp.avatar} color={opp.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{opp.displayName}</p>
                      <p className="text-xs font-semibold text-muted">{formatDate(m.playedAt)}</p>
                    </div>
                    <span className="font-display font-bold tabular">
                      {me.score} – {opp.score}
                    </span>
                    <Badge tone={result === "WIN" ? "success" : result === "LOSS" ? "danger" : "neutral"} className="w-14 justify-center">
                      {result}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="achievements">
        <h2 id="achievements" className="mb-3 flex items-baseline gap-2 font-display text-2xl font-semibold">
          Achievements
          <span className={cn("text-base font-bold", unlockedCount ? "text-hint dark:text-hint-bright" : "text-muted")}>
            {unlockedCount}/{ACHIEVEMENT_IDS.length}
          </span>
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ACHIEVEMENT_IDS.map((id) => (
            <AchievementCard key={id} achievement={ACHIEVEMENTS[id]} unlockedAt={profile.achievements[id]} />
          ))}
        </div>
      </section>
    </div>
  );
}
