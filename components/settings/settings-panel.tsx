"use client";

import { Bell, Monitor, Moon, Music, Sparkles, Sun, Vibrate, Volume2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { sound } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";
import { useUiStore, type MotionPreference } from "@/stores/ui-store";
import { Card } from "../ui/primitives";
import { SettingSwitch } from "../ui/switch";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const subscribeNoop = () => () => {};

export function SettingsPanel() {
  const ui = useUiStore();
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const saved = () => toast.success("Settings saved", { id: "settings" });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-center font-display text-4xl font-semibold">Settings</h1>

      <Card className="divide-y divide-border px-4">
        <SettingSwitch
          id="sfx"
          icon={<Volume2 className="size-5" />}
          label="Sound effects"
          description="Taps, correct answers, countdowns."
          checked={ui.soundEnabled}
          onCheckedChange={(v) => {
            ui.set({ soundEnabled: v });
            sound.setEffectsEnabled(v);
            if (v) {
              sound.unlock();
              sound.playCorrect();
            }
            saved();
          }}
        />
        <SettingSwitch
          id="music"
          icon={<Music className="size-5" />}
          label="Music"
          description="A soft ambient loop. Off by default."
          checked={ui.musicEnabled}
          onCheckedChange={(v) => {
            sound.unlock();
            ui.set({ musicEnabled: v });
            saved();
          }}
        />
        <SettingSwitch
          id="haptics"
          icon={<Vibrate className="size-5" />}
          label="Vibration"
          description="Light haptics on supported phones."
          checked={ui.hapticsEnabled}
          onCheckedChange={(v) => {
            ui.set({ hapticsEnabled: v });
            saved();
          }}
        />
        <SettingSwitch
          id="notify"
          icon={<Bell className="size-5" />}
          label="Notifications"
          description="In-game pop-ups for joins, disconnects and more."
          checked={ui.notificationsEnabled}
          onCheckedChange={(v) => {
            ui.set({ notificationsEnabled: v });
            saved();
          }}
        />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-5 text-muted" aria-hidden /> Motion
        </h2>
        <Segmented<MotionPreference>
          label="Motion"
          value={ui.motion}
          onChange={(v) => {
            ui.set({ motion: v });
            saved();
          }}
          options={[
            { value: "system", label: "System" },
            { value: "reduce", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Moon className="size-5 text-muted" aria-hidden /> Theme
        </h2>
        <Segmented
          label="Theme"
          value={mounted ? (theme as "system" | "light" | "dark") : undefined}
          onChange={(v) => {
            setTheme(v);
            saved();
          }}
          options={[
            { value: "system", label: "System", icon: <Monitor className="size-4" aria-hidden /> },
            { value: "light", label: "Light", icon: <Sun className="size-4" aria-hidden /> },
            { value: "dark", label: "Dark", icon: <Moon className="size-4" aria-hidden /> },
          ]}
        />
      </section>
    </div>
  );
}
