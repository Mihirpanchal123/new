import type { Metadata } from "next";
import { LocalGameClient } from "@/components/local/local-game-client";

export const metadata: Metadata = {
  title: "One-screen duel",
  description: "Play Word Duel with a friend on one device — pass and play.",
};

export default function LocalPage() {
  return <LocalGameClient />;
}
