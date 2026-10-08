"use client";

import { ArrowLeft, Palette, Shuffle, Swords } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DEFAULT_SETTINGS, DISPLAY_NAME_MAX_LENGTH, type GameSettings } from "@/constants/game";
import { AVATAR_COLOR_IDS, AVATAR_IDS, type AvatarColor, type AvatarId } from "@/constants/profile";
import { useLocalGame } from "@/lib/local/local-game";
import { settingsSchema } from "@/lib/validation/schemas";
import { useUiStore } from "@/stores/ui-store";
import type { PublicProfile } from "@/types/game";
import { GameSettingsPicker } from "../lobby/game-settings-picker";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/primitives";

const next = <T,>(list: readonly T[], current: T, skip?: T): T => {
  let i = list.indexOf(current);
  do i = (i + 1) % list.length;
  while (list[i] === skip && list.length > 1);
  return list[i]!;
};

function cleanName(raw: string, fallback: string) {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  return name || fallback;
}

function PlayerCard({
  seat,
  player,
  other,
  onChange,
}: {
  seat: 0 | 1;
  player: PublicProfile;
  other: PublicProfile;
  onChange: (p: PublicProfile) => void;
}) {
  return (
    <Card className="flex min-w-0 items-center gap-3 p-3 sm:flex-col sm:gap-4 sm:p-5 sm:text-center">
      <button
        type="button"
        onClick={() => onChange({ ...player, avatar: next<AvatarId>(AVATAR_IDS, player.avatar) })}
        className="relative shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        aria-label={`Change Player ${seat + 1}'s avatar`}
      >
        <PlayerAvatar avatar={player.avatar} color={player.color} size="lg" />
        <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-[var(--bg)] bg-surface-3 text-ink-2">
          <Shuffle className="size-3.5" aria-hidden />
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:w-full">
        <label htmlFor={`local-name-${seat}`} className="text-xs font-extrabold uppercase tracking-wider text-muted sm:text-center">
          Player {seat + 1}
        </label>
        <div className="flex gap-2">
          <input
            id={`local-name-${seat}`}
            value={player.displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            autoComplete="off"
            onChange={(e) => onChange({ ...player, displayName: e.target.value })}
            className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-border bg-surface-2 px-3 font-display text-lg font-semibold text-ink focus:border-brand focus:bg-surface focus:outline-none sm:text-center"
          />
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12"
            onClick={() => onChange({ ...player, color: next<AvatarColor>(AVATAR_COLOR_IDS, player.color, other.color) })}
            aria-label={`Change Player ${seat + 1}'s color`}
          >
            <Palette className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Names, avatars and rules for a one-screen game. */
export function LocalSetup() {
  const stored = useLocalGame((s) => s.players);
  const storedSettings = useLocalGame((s) => s.settings);
  const start = useLocalGame((s) => s.start);
  const [players, setPlayers] = useState<[PublicProfile, PublicProfile]>(stored);
  const [settings, setSettings] = useState<GameSettings>(() => {
    const parsed = settingsSchema.safeParse(storedSettings ?? useUiStore.getState().gameSettings);
    return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
  });

  function begin() {
    const a = { ...players[0], displayName: cleanName(players[0].displayName, "Player 1") };
    let bName = cleanName(players[1].displayName, "Player 2");
    if (bName.toLowerCase() === a.displayName.toLowerCase()) bName = `${bName.slice(0, DISPLAY_NAME_MAX_LENGTH - 2)} 2`;
    const b = { ...players[1], displayName: bName };
    useUiStore.getState().set({ gameSettings: settings });
    start([a, b], settings);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center">
        <Link
          href="/play"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-5 pb-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">One-screen duel</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Two players, one device. You&apos;ll take turns writing your chains in secret, then pass the device back and forth to guess.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlayerCard seat={0} player={players[0]} other={players[1]} onChange={(p) => setPlayers([p, players[1]])} />
          <PlayerCard seat={1} player={players[1]} other={players[0]} onChange={(p) => setPlayers([players[0], p])} />
          <span className="absolute left-1/2 top-1/2 hidden size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[var(--bg)] bg-surface-3 font-display text-sm font-bold text-muted sm:grid">
            VS
          </span>
        </div>

        <Card className="flex flex-col gap-3 px-4 py-5">
          <h2 className="px-1 font-display text-lg font-semibold">Game settings</h2>
          <GameSettingsPicker value={settings} onChange={setSettings} />
        </Card>

        <p className="text-center text-xs font-semibold text-muted">
          One-screen games stay on this device and don&apos;t count toward your profile or the leaderboard.
        </p>
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-bg/90 px-4 pt-3 backdrop-blur-md safe-bottom sm:-mx-6 sm:px-6">
        <Button size="xl" className="w-full" onClick={begin}>
          <Swords className="size-6" aria-hidden /> Start duel
        </Button>
      </div>
    </div>
  );
}
