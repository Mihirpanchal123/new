import { DEFAULT_TIMINGS } from "@/constants/game";
import { SCORING } from "@/constants/scoring";
import type { AvatarColor, AvatarId } from "@/constants/profile";
import { GameEngine } from "@/server/game/engine";
import type { ServerRoom } from "@/server/game/types";
import type { PublicProfile } from "@/types/game";

export const ALICE: PublicProfile = { id: "00000000-0000-4000-8000-00000000000a", displayName: "Alice", avatar: "bolt" as AvatarId, color: "violet" as AvatarColor };
export const BOB: PublicProfile = { id: "00000000-0000-4000-8000-00000000000b", displayName: "Bob", avatar: "cat" as AvatarId, color: "coral" as AvatarColor };

export const ALICE_CHAIN = ["coffee", "bean", "plant", "farm", "market"];
export const BOB_CHAIN = ["rain", "cloud", "water", "river", "ocean"];

export function makeEngine() {
  let n = 0;
  return new GameEngine({
    timings: { ...DEFAULT_TIMINGS },
    scoring: { ...SCORING },
    idFactory: () => `id-${++n}`,
  });
}

/** Room with both players joined, ready, chains locked and the countdown finished. */
export function playingRoom(engine = makeEngine(), start = 1_000_000) {
  let now = start;
  const room = engine.createGame("ABCDE", ALICE, now);
  engine.joinGame(room, BOB, now);
  engine.setPlayerReady(room, ALICE.id, true, now);
  engine.setPlayerReady(room, BOB.id, true, now);
  engine.submitChain(room, ALICE.id, ALICE_CHAIN, now);
  engine.submitChain(room, BOB.id, BOB_CHAIN, now);
  now = room.countdownEndsAt!;
  engine.tick(room, now);
  return { engine, room, now };
}

export function currentTurn(room: ServerRoom) {
  const turn = room.match!.turn!;
  return turn;
}
