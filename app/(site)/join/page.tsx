import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/play/join-form";

export const metadata: Metadata = {
  title: "Join game",
  description: "Enter a friend's 5-character code to join their Word Duel.",
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold">Join a duel</h1>
        <p className="mt-2 text-muted">Your friend can find the code in their lobby.</p>
      </div>
      <JoinForm initialCode={typeof code === "string" ? code : ""} />
      <p className="text-center text-sm text-muted">
        No code?{" "}
        <Link href="/create" className="font-bold text-brand underline-offset-4 hover:underline">
          Create your own game
        </Link>
      </p>
    </div>
  );
}
