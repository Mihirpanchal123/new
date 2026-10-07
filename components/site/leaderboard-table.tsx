import { Trophy } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import type { LeaderboardRow } from "@/types/game";
import { PlayerAvatar } from "../player/player-avatar";
import { EmptyState } from "../ui/primitives";

const MEDALS = ["bg-[#ffc247] text-[#3a2600]", "bg-[#cfd3dc] text-[#2a2d36]", "bg-[#e3a06b] text-[#3a1d05]"];

export function LeaderboardTable({ rows, viewerId, compact }: { rows: LeaderboardRow[]; viewerId?: string | null; compact?: boolean }) {
  if (!rows.length) {
    return (
      <EmptyState icon={<Trophy className="size-7" />} title="No duels yet">
        Finished games show up here. Be the first on the board!
      </EmptyState>
    );
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-card">
      <table className="w-full text-left">
        <caption className="sr-only">Leaderboard</caption>
        <thead>
          <tr className="border-b border-border text-xs font-extrabold uppercase tracking-wider text-muted">
            <th scope="col" className="w-12 py-3 pl-4">#</th>
            <th scope="col" className="py-3">Player</th>
            <th scope="col" className="py-3 pr-3 text-right">Wins</th>
            {!compact && <th scope="col" className="hidden py-3 pr-3 text-right sm:table-cell">Win rate</th>}
            <th scope="col" className="py-3 pr-4 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} className={cn("border-b border-border/60 last:border-0", r.player.id === viewerId && "bg-brand-soft")}>
              <td className="py-3 pl-4">
                <span className={cn("grid size-7 place-items-center rounded-lg text-sm font-extrabold", MEDALS[r.rank - 1] ?? "text-muted")}>
                  {r.rank}
                </span>
              </td>
              <td className="py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar avatar={r.player.avatar} color={r.player.color} size="xs" />
                  <span className="truncate font-bold">
                    {r.player.displayName}
                    {r.player.id === viewerId && <span className="ml-1 text-xs text-muted">(you)</span>}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-3 text-right font-display font-bold tabular">{r.wins}</td>
              {!compact && <td className="hidden py-3 pr-3 text-right font-semibold tabular text-muted sm:table-cell">{formatPercent(r.winRate)}</td>}
              <td className="py-3 pr-4 text-right font-display font-bold tabular">{r.score.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
