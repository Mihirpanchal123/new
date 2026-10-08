import type { MatchRecord, MatchRecordPlayer, TurnOutcome } from "@/types/game";
import type { ServerRoom } from "./types";

/** Snapshot a finished match into a permanent, shareable record. */
export function buildMatchRecord(room: ServerRoom): MatchRecord | null {
  const match = room.match;
  if (!match?.result || match.completedAt === null) return null;

  const players = match.order.map((id): MatchRecordPlayer => {
    const p = room.players.find((pl) => pl.id === id)!;
    const board = match.boards[id] ?? [];
    return {
      id,
      displayName: p.displayName,
      avatar: p.avatar,
      color: p.color,
      score: match.scores[id] ?? 0,
      chain: [...(match.chains[id] ?? [])],
      stats: { ...match.result!.stats[id]! },
      words: board
        .filter((w) => w.status !== "GIVEN")
        .map((w) => ({
          word: w.answer,
          position: w.position,
          outcome: (w.outcome ?? "TIMEOUT") as TurnOutcome,
          points: w.points,
          hints: w.hints,
          wrong: w.wrong,
          timeMs: w.timeMs,
        })),
    };
  }) as [MatchRecordPlayer, MatchRecordPlayer];

  return {
    id: match.id,
    roomCode: room.code,
    playedAt: match.completedAt,
    durationMs: match.completedAt - match.startedAt,
    endReason: match.result.endReason,
    winnerId: match.result.winnerId,
    settings: { ...match.settings },
    players,
  };
}
