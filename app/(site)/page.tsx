import { Brain, Eye, Lightbulb, Link2, Smartphone, Swords, Timer, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { GameplayPreview } from "@/components/home/gameplay-preview";
import { LeaderboardTable } from "@/components/site/leaderboard-table";
import { Card, SectionHeading } from "@/components/ui/primitives";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Link2, title: "Build a chain", text: "Pick 4–8 words, each one connected to the last. COFFEE → BEAN → PLANT…" },
  { icon: Eye, title: "Crack theirs", text: "You see their first word and one letter of each of the rest. Guess what comes next." },
  { icon: Lightbulb, title: "Solve or skip", text: "Stuck? Skip: you get a letter for 25 points and the turn passes. First to crack the chain wins." },
];

const FEATURES = [
  { icon: Zap, title: "Real-time duels", text: "Every guess, skip and point syncs instantly." },
  { icon: Timer, title: "30-second turns", text: "Quick rounds keep the pressure on." },
  { icon: Users, title: "No sign-up", text: "Pick a name and avatar — you're in." },
  { icon: Smartphone, title: "Made for phones", text: "Play the whole game one-handed." },
  { icon: Trophy, title: "Stats & achievements", text: "Track wins, streaks and perfect chains." },
  { icon: Swords, title: "Instant rematch", text: "One tap to run it back." },
];

const CTA_PRIMARY =
  "inline-flex h-16 items-center justify-center gap-2 rounded-[1.25rem] bg-brand px-10 font-display text-xl font-semibold text-brand-ink shadow-[0_5px_0_0_var(--brand-deep)] transition-[transform,box-shadow] hover:brightness-110 active:translate-y-[4px] active:shadow-[0_1px_0_0_var(--brand-deep)]";
const CTA_SECONDARY =
  "inline-flex h-16 items-center justify-center gap-2 rounded-[1.25rem] border-2 border-border bg-surface px-8 font-display text-xl font-semibold shadow-[0_4px_0_0_var(--border)] transition-[transform,box-shadow] hover:border-border-strong active:translate-y-[3px] active:shadow-none";

function TitleTiles() {
  const word = ["W", "O", "R", "D"];
  const duel = ["D", "U", "E", "L"];
  const tile = "grid size-12 place-items-center rounded-xl font-display text-3xl font-bold sm:size-16 sm:text-5xl";
  return (
    <h1 className="flex flex-col items-center gap-2 lg:items-start" aria-label="Word Duel">
      <span className="flex gap-1.5 sm:gap-2" aria-hidden>
        {word.map((l, i) => (
          <span key={i} className={`${tile} bg-brand text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)]`} style={{ rotate: `${(i - 1.5) * 2}deg` }}>
            {l}
          </span>
        ))}
      </span>
      <span className="flex gap-1.5 sm:gap-2" aria-hidden>
        {duel.map((l, i) => (
          <span key={i} className={`${tile} bg-[#ffc247] text-[#2a1a00] shadow-[0_4px_0_0_#d9901a]`} style={{ rotate: `${(1.5 - i) * 2}deg` }}>
            {l}
          </span>
        ))}
      </span>
    </h1>
  );
}

export default async function HomePage() {
  const top = getContainer().profiles.leaderboard("global", null, 5);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <TitleTiles />
          <p className="mt-6 font-display text-2xl font-semibold sm:text-3xl">Can you guess what they&apos;re thinking?</p>
          <p className="mt-3 max-w-md text-lg text-muted">
            A two-player word race. Build a chain of connected words, then crack your friend&apos;s chain one letter at a time.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/play" className={CTA_PRIMARY}>
              Play now
            </Link>
            <Link href="/how-to-play" className={CTA_SECONDARY}>
              How to play
            </Link>
          </div>
          <Link href="/join" className="mt-5 font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
            Got a code? Join a game →
          </Link>
        </div>
        <div className="flex justify-center lg:justify-end">
          <GameplayPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="how">
        <SectionHeading eyebrow="How it works" title={<span id="how">Three steps. One chain. One winner.</span>} />
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-sm font-bold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Why it's fun + example */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center" aria-labelledby="why">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand">Why it&apos;s fun</p>
          <h2 id="why" className="font-display text-3xl font-semibold sm:text-4xl">It&apos;s really a game about how your friends think.</h2>
          <ul className="mt-6 flex flex-col gap-4">
            {[
              { icon: Brain, text: "Every chain is a little window into someone's brain. RAIN → CLOUD makes sense. RAIN → BOW? Maybe." },
              { icon: Swords, text: "Write a chain that's fair but sneaky. Too obvious and they'll fly through it." },
              { icon: Zap, text: "Rounds take seconds. One more game is always on the table." },
            ].map((b) => (
              <li key={b.text} className="flex gap-3">
                <b.icon className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden />
                <span className="text-ink-2">{b.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <Card className="p-5 sm:p-6">
          <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Example duel</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { who: "Alex", words: ["COFFEE", "BEAN", "PLANT", "FARM", "MARKET"] },
              { who: "Sam", words: ["RAIN", "CLOUD", "WATER", "RIVER", "OCEAN"] },
            ].map((c) => (
              <div key={c.who}>
                <p className="mb-2 font-bold">{c.who}</p>
                <ol className="flex flex-col gap-1.5">
                  {c.words.map((w, i) => (
                    <li key={w} className="rounded-xl bg-surface-2 px-3 py-2 font-display font-bold tracking-wide">
                      {i === 0 ? w : `${w[0]}${"•".repeat(w.length - 1)}`}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="features">
        <SectionHeading eyebrow="Features" title={<span id="features">Built like a game, not a website</span>} />
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <Card className="h-full p-4 sm:p-5">
                <f.icon className="mb-3 size-6 text-brand" aria-hidden />
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Leaderboard preview */}
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6" aria-labelledby="leaders">
        <SectionHeading eyebrow="Leaderboard" title={<span id="leaders">Top duelists</span>} />
        <LeaderboardTable rows={top} compact />
        <div className="mt-4 text-center">
          <Link href="/leaderboard" className="font-bold text-brand underline-offset-4 hover:underline">
            See full leaderboard →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Card className="flex flex-col items-center gap-5 px-6 py-12 text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Your friend is one link away.</h2>
          <p className="max-w-md text-muted">Create a room, send the code, start dueling. No downloads, no accounts.</p>
          <Link href="/play" className={CTA_PRIMARY}>
            Start a duel
          </Link>
        </Card>
      </section>
    </>
  );
}
