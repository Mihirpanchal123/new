"use client";

import { Hash, Pencil, Plus, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session-store";
import { PlayerAvatar } from "../player/player-avatar";
import { ProfileEditor } from "../player/profile-editor";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Card, Skeleton } from "../ui/primitives";

const CHOICES = [
  {
    href: "/create",
    icon: Plus,
    title: "Create game",
    text: "Get a code and invite a friend.",
    tone: "bg-brand text-brand-ink shadow-[0_5px_0_0_var(--brand-deep)]",
    iconTone: "bg-white/20",
  },
  {
    href: "/join",
    icon: Hash,
    title: "Join game",
    text: "Got a code? Jump right in.",
    tone: "bg-surface border-2 border-border shadow-[0_5px_0_0_var(--border)]",
    iconTone: "bg-surface-2 text-brand",
  },
  {
    href: "/local",
    icon: Smartphone,
    title: "One screen",
    text: "Two players, one device. Pass and play.",
    tone: "bg-surface border-2 border-border shadow-[0_5px_0_0_var(--border)]",
    iconTone: "bg-surface-2 text-brand",
  },
];

export function PlayHub() {
  const profile = useSessionStore((s) => s.profile);
  const load = useSessionStore((s) => s.load);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold">Ready to duel?</h1>
        <p className="mt-2 text-muted">Pick how you want to play.</p>
      </div>

      <Card className="flex items-center gap-4 p-4">
        {profile ? (
          <>
            <PlayerAvatar avatar={profile.avatar} color={profile.color} size="md" bob />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Playing as</p>
              <p className="truncate font-display text-xl font-semibold">{profile.displayName}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Button>
          </>
        ) : (
          <>
            <Skeleton className="size-14" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-36" />
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4">
        {CHOICES.map((c, i) => (
          <motion.div
            key={c.href}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.07 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href={c.href}
              className={`flex items-center gap-4 rounded-[1.5rem] p-5 transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none ${c.tone}`}
            >
              <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${c.iconTone}`}>
                <c.icon className="size-7" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-2xl font-semibold">{c.title}</span>
                <span className="block text-sm font-semibold opacity-80">{c.text}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/how-to-play" className="font-bold text-brand underline-offset-4 hover:underline">
          Learn to play in 30 seconds
        </Link>
      </p>

      <Dialog open={editing} onOpenChange={setEditing} title="Your player" description="This is how your opponent sees you.">
        <ProfileEditor onSaved={() => setEditing(false)} />
      </Dialog>
    </div>
  );
}
