# Word Duel

**Think alike. Guess faster.**

A realtime, two-player word game. Each player builds a chain of five connected words (COFFEE → BEAN → PLANT → FARM → MARKET). Players then take turns cracking each other's chain: the first word is visible, and the rest show only their first letter. Hints reveal more letters, but each one lowers the word's value. Highest score wins.

Mobile-first, guest-friendly (no sign-up), server-authoritative, and **no database required**.

---

## Features

- **Instant rooms**: 5-character codes (no ambiguous characters), copy code, native share sheet, and invite links (`/game/CODE`) that join directly.
- **Guest profiles**: name, 12 avatars and 8 colours, kept via a signed cookie.
- **Lobby**: live presence, ready-up, open seat, and a "GO!" transition.
- **Chain builder**: step indicator, live validation, example chains, lock/edit, and a draft that survives a refresh.
- **"3 · 2 · 1 · DUEL!"** countdown, synced to the server clock.
- **Game board**: alternating 30-second turns over 4 rounds, flip-in letter tiles, hints with a tap-twice confirm before revealing the last letter, wrong-guess shake, particle bursts, a floating "+points" and animated score counters. While your opponent guesses, you watch their wrong attempts live.
- **Scoring**: 100 / 75 / 50 / 25 by hints used, −5 per distinct wrong guess (floor of 10), a speed bonus of up to +20, and 0 for a timeout or a fully revealed word. All values are configurable.
- **Disconnects**: the opponent sees a reconnect countdown, a refresh restores the exact state, and a forfeit happens after the grace period. A second tab takes over the session cleanly.
- **Results**: win, loss or draw screen, both chains revealed, stat comparison, rematch (request / accept / decline / cancel), sharing, and a permanent match recap page.
- **Profile**: stats, recent matches, and 8 achievements (locked and unlocked states).
- **Leaderboard**: Global, Friends (people you've dueled), Weekly and Monthly.
- **Sound**: every effect is synthesized with Web Audio (no asset files), plus an optional ambient music loop. There are also haptics, and settings for sound, music, vibration, notifications, motion and theme (System / Light / Dark).
- **Accessibility**: keyboard navigation, visible focus, ARIA live game status, screen-reader text for every word card, reduced-motion support, and colour is never the only signal.
- **Admin panel** (`/admin`, token-protected): live rooms inspector, players online, recent errors and suspicious activity.
- **PWA-ready** manifest and icons; OG and Twitter metadata; game rooms are `noindex` with generic metadata.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 6 |
| Styling | Tailwind CSS 4.3, design tokens in CSS variables, Radix primitives (Dialog, Switch) |
| Motion | Motion for React 14 |
| State | Zustand 5 (game, session, settings stores) |
| Validation | Zod 4 |
| Realtime | Socket.IO 4.8 on the same Node server as Next.js |
| Persistence | In-memory, with an optional JSON snapshot (no DB) |
| Tests | Vitest 5 (unit / integration / realtime), Playwright 1.63 (E2E) |

## Quick start

```bash
npm install
cp .env.example .env.local     # optional in development
npm run dev                    # http://localhost:3000
```

Open two browsers (or a normal and a private window), click **Play now → Create game** in one, and join with the code in the other.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Custom server (Next.js + Socket.IO) in dev mode; restarts when `server/**` changes |
| `npm run build` | Production build |
| `npm run start` | Production server (`NODE_ENV=production`) |
| `npm run lint` | ESLint (flat config, Next core-web-vitals + TS) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit, integration and realtime tests (Vitest) |
| `npm run test:e2e` | Builds, boots the real server, and runs Playwright on mobile (Pixel 7) and desktop |
| `npm run seed` | Seeds Alex, Sam, Jordan and Taylor with 24 simulated matches (stop the server first) |
| `npm run check` | lint + typecheck + test + build |

> **No database, so no migrations.** `db:migrate` and `db:seed` from the original spec don't apply. `npm run seed` fills the JSON snapshot instead.

## Environment variables

See `.env.example`. All are optional in development.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOSTNAME` | `3000` / `localhost` | Where the server listens |
| `SESSION_SECRET` | dev fallback | **Required in production.** HMAC key for guest session cookies |
| `ADMIN_TOKEN` | *(empty: admin disabled)* | Enables `/admin` |
| `ADMIN_SHOW_SECRETS` | `false` | Show chains in the admin inspector (ignored in production) |
| `PERSISTENCE` | `file` | `file` = JSON snapshot, `memory` = nothing written |
| `DATA_FILE` | `.data/word-duel.json` | Snapshot location |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URL for metadata and sitemap |
| `NEXT_PUBLIC_REALTIME_URL` | *(same origin)* | Point the client at a separate realtime host |
| `REALTIME_CORS_ORIGINS` | *(none)* | Allowed origins when the realtime host is cross-origin |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | `none` | `console` logs analytics events |
| `WD_TURN_MS`, `WD_RESULT_MS`, `WD_COUNTDOWN_MS`, `WD_DISCONNECT_GRACE_MS` | 30000 / 2600 / 3600 / 60000 | Timing overrides (used by E2E tests) |

## Architecture

```
app/                     Routes (Server Components by default)
  (site)/                Pages with header/footer: home, play, create, join, results/[gameId],
                         profile, leaderboard, how-to-play, settings, admin, about, privacy, terms
  game/[roomCode]/       The game itself, full-screen with no site chrome
  api/session            GET (create/restore guest) · PATCH (profile)
  api/rooms/[code]       Join pre-check (exists / full / started)
  api/health             Liveness and stats
components/
  game/                  GameClient, GameBoard, WordChain/WordCard, GuessBar, Timer, PlayerHeader,
                         GameStatus, CountdownOverlay, ResultsScreen, RematchDialog, ConnectionIndicator
  game/hooks/            useRoomConnection, useCountdown, useGameEvents, useGameFeedback
  lobby/                 Lobby, ChainSetup, RoomCode / Copy / Share
  player/ ui/ animations/ home/ play/ tutorial/ settings/ site/
constants/               game.ts, scoring.ts, profile.ts, achievements.ts (all tunables)
lib/                     game/ (mask, scoring), validation/, realtime/client, sound/, analytics/, share, haptics
server/
  game/engine.ts         GameEngine: every rule, pure and clock-injected
  game/state-machine.ts  Legal phase transitions (anything else throws)
  game/serialize.ts      The ONLY way state leaves the server (per-viewer masking)
  game/room-manager.ts   Rooms, codes, one timer per room, expiry, broadcast, match records
  realtime/socket-server Auth → Zod → rate limit → idempotency → engine → ack
  services/              ProfileStore, persistence, WordValidationService, RateLimiter, Logger, session
  container.ts           Process-wide singleton shared by Socket.IO and Next route code
server.ts                One HTTP server: Next.js handler + Socket.IO
stores/                  game-store, session-store, ui-store (Zustand)
types/                   game.ts (view types), realtime.ts (typed event contracts)
tests/                   unit/ integration/ realtime/ e2e/
```

### Game flow and state machine

```
LOBBY ──both ready──▶ SETUP ──both chains locked──▶ COUNTDOWN ──timer──▶ PLAYING ──8 turns / forfeit──▶ COMPLETE
  ▲                     │  ▲                          │                                                 │
  └──player leaves──────┘  └─────────────── rematch accepted ─────────────────────────────────────────┘
any ──▶ CLOSED (empty, abandoned, expired)
```

Inside `PLAYING`, each of the 8 turns (4 rounds × 2 players, alternating) goes `GUESSING` (30s) → `RESULT` (~2.6s) → next turn. The first guesser alternates between rematches.

### Realtime model

- **Snapshots are the truth.** After every change the server pushes a per-viewer `room:state` with a monotonic `version`. Clients ignore older versions, so stale or out-of-order packets can't corrupt state.
- **Events are for feel.** `game:event` (a typed discriminated union: `guess.result`, `hint.revealed`, `turn.timeout`, `player.disconnected`, `rematch.requested`, …) drives sounds, animations and toasts only.
- **Commands are intents.** The client sends `guess:submit { turnId, guess, actionId }`, never scores, timers or indices. Every command is acked with a typed `AckResult`.
- **Reconnect.** On every (re)connect the client re-joins, which is a reconnect for existing members, and receives a full snapshot. A clock-ping exchange estimates the server offset for smooth countdowns.

### Server authority and security

- **Secrets never leave the server early.** `serializeRoomFor()` sends the opponent's words as `letters: (string | null)[]` with exactly the revealed letters. Tests assert that no packet ever contains a hidden word.
- **Identity.** Guest sessions are an HMAC-signed `playerId` in an httpOnly cookie, checked on every socket handshake.
- **Validation.** Every payload is parsed with Zod. Words are normalized, restricted to letters, length-limited, profanity-filtered and de-duplicated on the server.
- **Authority.** Turn ownership, the timer (with a 400ms latency grace), hint counts, scores and winners are all computed by the engine.
- **Duplicates.** Retries with the same `actionId` return the cached result (registered synchronously, so even same-tick duplicates are safe). Hints carry `expectedRevealed`, so double-clicks reveal one letter.
- **Abuse.** Token-bucket rate limits cover create, join, guess, hint, rematch, chain, profile and session. Suspicious activity (invalid payloads, wrong-turn attempts, rate limiting, failed admin logins) is logged and shown in `/admin`.
- **Atomicity.** Node is single-threaded and every engine action is synchronous, so a guess, its score update and the turn transition apply atomically with respect to timers and the other player.

### Persistence (no database)

Live rooms are in memory. Profiles, stats, achievements and match history live in `ProfileStore`, which is snapshotted to `DATA_FILE` (debounced, atomic temp-file + rename) and flushed on shutdown. The `PersistenceAdapter` interface is the seam for Postgres, Redis or SQLite later.

## Testing

```bash
npm test          # 58 tests: masking, scoring, validation, engine transitions & timers,
                  # serialization secrecy, RoomManager flows, live Socket.IO (auth, sync,
                  # leaks, duplicates, disconnect/reconnect/forfeit, session takeover, rematch)
npm run test:e2e  # Playwright on Pixel 7 + desktop: full duel → results → rematch → profile;
                  # refresh mid-game restores state; join-code errors
```

## Deployment

Word Duel needs a **long-running Node process** for WebSockets and in-memory game state. Railway, Render, Fly.io, a VPS or a container all work:

```bash
npm ci && npm run build
SESSION_SECRET=… NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 npm run start
```

Mount a volume at `.data/` (or set `DATA_FILE`) to keep profiles across deploys.

**Vercel:** serverless functions can't hold WebSockets or shared memory. To use Vercel for the web tier, run `server.ts` on a Node host as the realtime service, point `NEXT_PUBLIC_REALTIME_URL` at it and set `REALTIME_CORS_ORIGINS`. You'd also need a shared store (implement `PersistenceAdapter` on Redis or Postgres), because profile routes on Vercel wouldn't see the realtime server's memory.

## Known limitations

- **Single instance.** Rooms live in one process's memory, so a restart ends in-progress games (profiles and history survive via the snapshot). Horizontal scaling needs Redis-backed rooms and the Socket.IO Redis adapter.
- **Guest-only accounts.** A profile is tied to a cookie, and clearing cookies starts fresh. There's no login or cross-device account yet; the session layer is where it would go.
- **Basic word validation.** It checks format, length, duplicates and profanity, but not dictionary or semantic relatedness. `WordValidationService` accepts pluggable validators that fail open.
- **Friends leaderboard** means "players you've dueled". There's no friend graph.
- **No service worker / offline shell.** The game requires a connection by design.

## Next recommended improvements

1. Redis room store + Socket.IO adapter for multiple instances.
2. Real accounts (passkeys or magic link) that claim the guest profile.
3. Public matchmaking queue and an AI opponent.
4. Dictionary and semantic validators plugged into `WordValidationService`.
5. Emoji reactions during turns (add a `reaction.sent` event to the `GameEvent` union).
6. Daily challenge chain, categories and difficulty levels; ELO ranking.
