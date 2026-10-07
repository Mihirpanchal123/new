import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = {
  title: "About",
  description: "Word Duel is a fast, social word game for two players. Think alike. Guess faster.",
};

export default function AboutPage() {
  return (
    <Prose title="About Word Duel">
      <p>
        Word Duel is a two-player word game about how people think. Each player builds a chain of five connected
        words — <strong>COFFEE → BEAN → PLANT → FARM → MARKET</strong> — then races to crack the other player&apos;s
        chain, one letter at a time.
      </p>
      <p>
        It&apos;s built to be fast to start (no sign-up, one code to share), fair (the server keeps every secret word
        until it&apos;s revealed) and fun to replay (instant rematches, stats and achievements).
      </p>
      <h2>Fair play</h2>
      <p>
        Your opponent&apos;s words never reach your device before they&apos;re revealed. Scores, timers and turns are all
        decided by the server, so nobody can peek or fiddle with the clock.
      </p>
      <p>
        Ready? <Link href="/play">Start a duel</Link> or <Link href="/how-to-play">learn how to play</Link>.
      </p>
    </Prose>
  );
}
