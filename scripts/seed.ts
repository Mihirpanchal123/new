/**
 * Development seed: creates Alex, Sam, Jordan and Taylor and plays a batch of
 * simulated matches through the real GameEngine, so profiles, history,
 * achievements and leaderboards have realistic data.
 *
 *   npm run seed            # writes to DATA_FILE (default .data/word-duel.json)
 *
 * Stop the dev server first — it would overwrite the file on its next save.
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_TIMINGS } from "@/constants/game";
import type { AvatarColor, AvatarId } from "@/constants/profile";
import { SCORING } from "@/constants/scoring";
import { GameEngine } from "@/server/game/engine";
import { buildMatchRecord } from "@/server/game/records";
import { JsonFilePersistence } from "@/server/services/persistence";
import { ProfileStore } from "@/server/services/profile-store";

const DATA_FILE = process.env.DATA_FILE || ".data/word-duel.json";

const PLAYERS: { name: string; avatar: AvatarId; color: AvatarColor; skill: number }[] = [
  { name: "Alex", avatar: "rocket", color: "violet", skill: 0.85 },
  { name: "Sam", avatar: "cat", color: "coral", skill: 0.7 },
  { name: "Jordan", avatar: "brain", color: "mint", skill: 0.6 },
  { name: "Taylor", avatar: "moon", color: "sky", skill: 0.45 },
];

const CHAINS = [
  ["coffee", "bean", "plant", "farm", "market"],
  ["space", "rocket", "fuel", "engine", "power"],
  ["rain", "cloud", "water", "river", "ocean"],
  ["pizza", "cheese", "mouse", "trap", "door"],
  ["winter", "snow", "ball", "dance", "party"],
  ["guitar", "string", "kite", "wind", "mill"],
  ["apple", "tree", "house", "garden", "flower"],
  ["moon", "night", "star", "light", "bulb"],
];

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

const store = new ProfileStore(new JsonFilePersistence(DATA_FILE));
const engine = new GameEngine({ timings: { ...DEFAULT_TIMINGS }, scoring: { ...SCORING } });

const profiles = PLAYERS.map((p) => {
  const prof = store.createGuest(randomUUID());
  store.update(prof.id, { displayName: p.name, avatar: p.avatar, color: p.color });
  return { ...p, id: prof.id };
});

const DAY = 24 * 60 * 60_000;
let matches = 0;
for (let i = 0; i < 24; i++) {
  const a = pick(profiles);
  let b = pick(profiles);
  while (b.id === a.id) b = pick(profiles);
  // Spread games over the last ~6 weeks so weekly/monthly boards differ.
  let now = Date.now() - Math.floor(rand() * 42 * DAY);

  const pub = (p: (typeof profiles)[number]) => ({ id: p.id, displayName: p.name, avatar: p.avatar, color: p.color });
  const room = engine.createGame(`SEED${i}`.slice(0, 5), pub(a), now);
  engine.joinGame(room, pub(b), now);
  engine.setPlayerReady(room, a.id, true, now);
  engine.setPlayerReady(room, b.id, true, now);
  engine.submitChain(room, a.id, pick(CHAINS), now);
  engine.submitChain(room, b.id, pick(CHAINS), now);
  now = room.countdownEndsAt!;
  engine.tick(room, now);

  while (room.phase === "PLAYING") {
    const turn = room.match!.turn!;
    const skill = turn.guesserId === a.id ? a.skill : b.skill;
    const answer = room.match!.chains[turn.ownerId]![turn.position]!;
    const word = room.match!.boards[turn.guesserId]![turn.position]!;
    const t = turn.startedAt + 2_000 + Math.floor(rand() * 10_000);
    // Each letter already showing makes the word easier.
    if (rand() < skill + word.revealed * 0.1) {
      if (rand() > skill) engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: "nope" }, t);
      engine.submitGuess(room, turn.guesserId, { turnId: turn.id, guess: answer }, t + 500);
    } else if (rand() < 0.7 && word.revealed < answer.length) {
      engine.skipTurn(room, turn.guesserId, { turnId: turn.id, expectedRevealed: word.revealed }, t);
    } else {
      engine.tick(room, turn.endsAt! + DEFAULT_TIMINGS.latencyGraceMs + 1);
    }
    engine.tick(room, room.match!.turn?.resultEndsAt ?? t);
  }

  const record = buildMatchRecord(room);
  if (record) {
    store.recordMatch(record, room.match!.maxDeficit);
    matches++;
  }
}

store.flush();
console.log(`Seeded ${profiles.length} players and ${matches} matches into ${DATA_FILE}`);
