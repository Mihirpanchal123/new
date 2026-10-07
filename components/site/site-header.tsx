"use client";

import { CircleHelp, Settings, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { PlayerAvatar } from "../player/player-avatar";
import { Logo } from "../ui/logo";

const NAV = [
  { href: "/how-to-play", label: "How to play", icon: CircleHelp },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SiteHeader() {
  const pathname = usePathname();
  const profile = useSessionStore((s) => s.profile);
  const load = useSessionStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-auto rounded-xl" aria-label="Word Duel home">
          <Logo className="hidden min-[400px]:inline-flex" />
          <Logo compact className="min-[400px]:hidden" />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-bold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                  active && "bg-surface-2 text-ink",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/profile"
            aria-label="Your profile"
            className="ml-1 rounded-xl p-0.5 transition-transform hover:scale-105"
          >
            {profile ? (
              <PlayerAvatar avatar={profile.avatar} color={profile.color} size="sm" label="Your profile" />
            ) : (
              <span className="block size-10 animate-pulse rounded-xl bg-surface-3" />
            )}
          </Link>
          <Link
            href="/play"
            className="ml-2 hidden h-10 items-center rounded-xl bg-brand px-4 font-display font-semibold text-brand-ink shadow-[0_3px_0_0_var(--brand-deep)] transition-transform active:translate-y-[2px] sm:inline-flex"
          >
            Play
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <p>
          <span className="font-display font-semibold text-ink">Word Duel</span> · Think alike. Guess faster.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold">
          <Link href="/how-to-play" className="hover:text-ink">How to play</Link>
          <Link href="/about" className="hover:text-ink">About</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
