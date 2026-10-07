import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameClient } from "@/components/game/game-client";
import { roomCodeSchema } from "@/lib/validation/schemas";

// Private rooms: generic metadata only, never indexed, nothing about players or words.
export const metadata: Metadata = {
  title: "Duel in progress",
  description: "You've been invited to a Word Duel.",
  robots: { index: false, follow: false },
  openGraph: { title: "Join my Word Duel 🎮", description: "Think alike. Guess faster." },
};

export default async function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  const parsed = roomCodeSchema.safeParse(roomCode);
  if (!parsed.success) redirect(`/join?code=${encodeURIComponent(roomCode.slice(0, 10))}`);
  if (parsed.data !== roomCode) redirect(`/game/${parsed.data}`);
  return <GameClient code={parsed.data} />;
}
