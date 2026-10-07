import type { Metadata } from "next";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Terms", description: "The rules for using Word Duel." };

export default function TermsPage() {
  return (
    <Prose title="Terms of use" updated="October 2026">
      <p>By playing Word Duel you agree to these simple rules.</p>
      <h2>Play nice</h2>
      <ul>
        <li>Keep display names and words friendly. Offensive content is filtered and may be removed.</li>
        <li>Don&apos;t try to cheat, disrupt games or overload the service.</li>
      </ul>
      <h2>The service</h2>
      <p>
        Word Duel is provided as-is. Games can occasionally be interrupted (for example during updates), and we may
        reset stats or leaderboards when needed.
      </p>
    </Prose>
  );
}
