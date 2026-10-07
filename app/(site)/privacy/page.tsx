import type { Metadata } from "next";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Privacy", description: "How Word Duel handles your data." };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="October 2026">
      <p>Word Duel is designed to need as little information about you as possible.</p>
      <h2>What we store</h2>
      <ul>
        <li>A random guest ID in a cookie, so you keep your name, avatar and stats between visits.</li>
        <li>The display name, avatar and colour you choose.</li>
        <li>Finished match records: player names, scores, the words used, and per-word results.</li>
      </ul>
      <h2>What we don&apos;t</h2>
      <ul>
        <li>No email, password or real name is required to play.</li>
        <li>No advertising trackers.</li>
      </ul>
      <h2>Your choices</h2>
      <p>
        Clearing your browser cookies starts a fresh guest profile. Match recaps are reachable only through their
        unguessable link and are not indexed by search engines.
      </p>
    </Prose>
  );
}
