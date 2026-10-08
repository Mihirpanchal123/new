import { getMaskedLetters } from "@/lib/game/mask";
import type { MatchResultView, MatchView, PlayerView, RoomView, WordCardView } from "@/types/game";
import type { BoardWord, ServerRoom } from "./types";

/**
 * The ONLY way room state leaves the server. Produces the view a specific
 * player is entitled to see:
 *  - their own chain in full,
 *  - the opponent's chain masked to exactly the letters revealed so far,
 *  - both chains in full only once the match is over.
 */
export function serializeRoomFor(
  room: ServerRoom,
  viewerId: string,
  opts: { now: number; countdownDurationMs: number; graceMs: number },
): RoomView {
  const viewer = room.players.find((p) => p.id === viewerId);
  const players: PlayerView[] = room.players.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    avatar: p.avatar,
    color: p.color,
    isHost: p.id === room.hostId,
    ready: p.ready,
    connected: p.connected,
    graceEndsAt: !p.connected && p.disconnectedAt !== null ? p.disconnectedAt + opts.graceMs : null,
    left: p.left,
    chainSubmitted: p.chain !== null,
  }));

  return {
    version: room.version,
    serverNow: opts.now,
    code: room.code,
    phase: room.phase,
    meId: viewerId,
    hostId: room.hostId,
    players,
    countdownEndsAt: room.countdownEndsAt,
    myChain: viewer?.chain ? [...viewer.chain] : null,
    match: serializeMatch(room, viewerId),
    rematch: room.rematch ? { ...room.rematch } : null,
    settings: { ...room.settings },
    countdownDurationMs: opts.countdownDurationMs,
    closedReason: room.closedReason,
  };
}

function serializeMatch(room: ServerRoom, viewerId: string): MatchView | null {
  const match = room.match;
  if (!match) return null;
  const opponentId = match.order.find((id) => id !== viewerId) ?? null;
  const isParticipant = match.order.includes(viewerId);
  const over = match.result !== null;

  const turn = match.turn
    ? {
        id: match.turn.id,
        round: match.turn.round,
        guesserId: match.turn.guesserId,
        ownerId: match.turn.ownerId,
        position: match.turn.position,
        phase: match.turn.phase,
        startedAt: match.turn.startedAt,
        endsAt: match.turn.endsAt,
        resultEndsAt: match.turn.resultEndsAt,
        outcome: match.turn.outcome,
        recentGuesses: [...match.turn.recentGuesses],
      }
    : null;

  let result: MatchResultView | null = null;
  if (match.result) {
    result = {
      winnerId: match.result.winnerId,
      endReason: match.result.endReason,
      stats: structuredClone(match.result.stats),
      chains: structuredClone(match.chains),
    };
  }

  return {
    id: match.id,
    number: match.number,
    settings: { ...match.settings },
    totalRounds: match.settings.chainLength - 1,
    firstPlayerId: match.order[0],
    turn,
    // Board I am guessing = the opponent's chain → masked.
    opponentBoard: isParticipant ? (match.boards[viewerId] ?? []).map((w) => maskedCard(w, over)) : [],
    // Board the opponent is guessing = my chain → I already know every letter.
    myBoard: isParticipant && opponentId ? (match.boards[opponentId] ?? []).map(ownCard) : [],
    scores: { ...match.scores },
    result,
  };
}

export function maskedCard(word: BoardWord, matchOver: boolean): WordCardView {
  const fullyKnown = matchOver || word.status === "GIVEN" || word.status === "SOLVED" || word.status === "FAILED";
  const visible = fullyKnown ? word.answer.length : word.revealed;
  return {
    position: word.position,
    length: word.answer.length,
    letters: getMaskedLetters(word.answer, visible),
    revealedCount: visible,
    status: word.status,
    hintsUsed: word.hints,
    wrongGuesses: word.wrong,
    points: word.points,
  };
}

function ownCard(word: BoardWord): WordCardView {
  return {
    position: word.position,
    length: word.answer.length,
    letters: Array.from(word.answer.toUpperCase()),
    revealedCount: word.revealed,
    status: word.status,
    hintsUsed: word.hints,
    wrongGuesses: word.wrong,
    points: word.points,
  };
}
