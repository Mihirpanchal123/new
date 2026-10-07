import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardTable } from "@/components/site/leaderboard-table";
import { cn } from "@/lib/utils";
import { getContainer } from "@/server/container";
import { getSessionPlayerId } from "@/server/http";
import type { LeaderboardScope } from "@/types/game";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The top Word Duel players — all time, this week and this month.",
};
export const dynamic = "force-dynamic";

const TABS: { scope: LeaderboardScope; label: string; hint: string }[] = [
  { scope: "global", label: "Global", hint: "All-time wins across every duel." },
  { scope: "friends", label: "Friends", hint: "You and everyone you've dueled." },
  { scope: "weekly", label: "Weekly", hint: "Wins in the last 7 days." },
  { scope: "monthly", label: "Monthly", hint: "Wins in the last 30 days." },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: raw } = await searchParams;
  const tab = TABS.find((t) => t.scope === raw) ?? TABS[0]!;
  const viewerId = await getSessionPlayerId();
  const rows = getContainer().profiles.leaderboard(tab.scope, viewerId, 50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-center font-display text-4xl font-semibold">Leaderboard</h1>
      <nav aria-label="Leaderboard range" className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <Link
            key={t.scope}
            href={t.scope === "global" ? "/leaderboard" : `/leaderboard?scope=${t.scope}`}
            aria-current={t.scope === tab.scope ? "page" : undefined}
            className={cn(
              "grid h-10 place-items-center rounded-xl text-sm font-extrabold transition-colors",
              t.scope === tab.scope ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="mb-5 mt-3 text-center text-sm text-muted">{tab.hint}</p>
      <LeaderboardTable rows={rows} viewerId={viewerId} />
    </div>
  );
}
