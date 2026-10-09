import { Check, Clock, Lightbulb, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/player/player-avatar";
import { Badge, Card } from "@/components/ui/primitives";
import { ShareButton } from "@/components/ui/share-button";
import { cn, formatSeconds } from "@/lib/utils";
import { getContainer } from "@/server/container";
import type { MatchRecordPlayer } from "@/types/game";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f-]{36}$/;

async function load(params: Promise<{ gameId: string }>) {
  const { gameId } = await params;
  if (!ID.test(gameId)) return null;
  return getContainer().profiles.getMatch(gameId) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const match = await load(params);
  if (!match) return { title: "Match not found", robots: { index: false } };
  const [a, b] = match.players;
  return {
    title: `${a.displayName} vs ${b.displayName}`,
    description: `${a.displayName} ${a.score} – ${b.score} ${b.displayName}. Think you can do better?`,
    robots: { index: false },
  };
}

function PlayerColumn({ player, opponent, won }: { player: MatchRecordPlayer; opponent: MatchRecordPlayer; won: boolean }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <PlayerAvatar avatar={player.avatar} color={player.color} size="md" active={won} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-semibold">{player.displayName}</p>
          <p className="text-sm font-semibold text-muted">guessing {opponent.displayName}&apos;s chain</p>
        </div>
        <span className="font-display text-3xl font-bold tabular">{player.score}</span>
      </div>
      <p className="mb-2 rounded-xl bg-surface-2 px-3 py-2 font-display font-bold uppercase tracking-wide text-muted">
        {opponent.chain[0]} <span className="text-xs normal-case">(start)</span>
      </p>
      <ol className="flex flex-col gap-1.5">
        {player.words.map((w) => (
          <li
            key={w.position}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2",
              w.outcome === "SOLVED" ? "bg-success-soft" : "bg-danger-soft",
            )}
          >
            {w.outcome === "SOLVED" ? (
              <Check className="size-4 shrink-0 text-success" strokeWidth={3} aria-label="Solved" />
            ) : (
              <X className="size-4 shrink-0 text-danger" strokeWidth={3} aria-label="Not cracked" />
            )}
            <span className="min-w-0 flex-1 truncate font-display font-bold uppercase tracking-wide">{w.word}</span>
            <span className="hidden items-center gap-1 text-xs font-bold text-muted min-[380px]:inline-flex">
              <Lightbulb className="size-3.5" aria-hidden />
              {w.hints}
            </span>
            <span className="hidden items-center gap-1 text-xs font-bold text-muted min-[380px]:inline-flex">
              <Clock className="size-3.5" aria-hidden />
              {formatSeconds(w.timeMs)}
            </span>
            <span className="w-9 text-right font-display font-bold tabular">+{w.points}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function ResultPage({ params }: { params: Promise<{ gameId: string }> }) {
  const match = await load(params);
  if (!match) notFound();
  const [a, b] = match.players;
  const winner = match.players.find((p) => p.id === match.winnerId) ?? null;
  const shareText = winner
    ? `⚔️ ${winner.displayName} won a Word Duel ${a.score}–${b.score}!\n\nThink you can do better?`
    : `🤝 ${a.displayName} and ${b.displayName} tied a Word Duel ${a.score}–${b.score}!`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Badge tone={winner ? "hint" : "brand"}>{match.endReason === "FORFEIT" ? "Won by forfeit" : "Match recap"}</Badge>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          {winner ? `${winner.displayName} wins!` : "A perfect tie"}
        </h1>
        <p className="font-display text-2xl font-bold tabular text-muted">
          {a.score} <span className="text-base">vs</span> {b.score}
        </p>
        <p className="text-sm text-muted">
          {new Date(match.playedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
          {Math.round(match.durationMs / 1000)}s
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PlayerColumn player={a} opponent={b} won={match.winnerId === a.id} />
        <PlayerColumn player={b} opponent={a} won={match.winnerId === b.id} />
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ShareButton text={shareText} path={`/results/${match.id}`} label="Share result" size="lg" />
        <Link
          href="/play"
          className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand px-8 font-display text-lg font-semibold text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)] active:translate-y-[3px] active:shadow-none"
        >
          Start your own duel
        </Link>
      </div>
    </div>
  );
}
