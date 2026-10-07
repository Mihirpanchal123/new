import type { Metadata } from "next";
import { Tutorial } from "@/components/tutorial/tutorial";

export const metadata: Metadata = {
  title: "How to play",
  description: "Build a chain of 5 connected words, then guess your opponent's chain one letter at a time. Learn Word Duel in 30 seconds.",
};

export default function HowToPlayPage() {
  return <Tutorial />;
}
