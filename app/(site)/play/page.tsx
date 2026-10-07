import type { Metadata } from "next";
import { PlayHub } from "@/components/play/play-hub";

export const metadata: Metadata = {
  title: "Play",
  description: "Create a private Word Duel room or join a friend's game with a code.",
};

export default function PlayPage() {
  return <PlayHub />;
}
