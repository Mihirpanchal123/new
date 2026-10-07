"use client";

import { Check, Dices } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { DISPLAY_NAME_MAX_LENGTH } from "@/constants/game";
import {
  AVATAR_COLOR_IDS,
  AVATAR_COLORS,
  AVATAR_IDS,
  AVATAR_LABELS,
  randomGuestName,
  type AvatarColor,
  type AvatarId,
} from "@/constants/profile";
import { displayNameSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "../ui/button";
import { Input } from "../ui/primitives";
import { AVATAR_ICONS, PlayerAvatar } from "./player-avatar";

/** Name + avatar + colour picker. Saves to the guest profile. */
export function ProfileEditor({ onSaved, submitLabel = "Save" }: { onSaved?: () => void; submitLabel?: string }) {
  const profile = useSessionStore((s) => s.profile);
  const update = useSessionStore((s) => s.update);
  const [name, setName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(profile?.avatar ?? "bolt");
  const [color, setColor] = useState<AvatarColor>(profile?.color ?? "violet");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameId = useId();

  async function save() {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid name.");
      return;
    }
    setSaving(true);
    const res = await update({ displayName: parsed.data, avatar, color });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save.");
      return;
    }
    toast.success("Profile saved");
    onSaved?.();
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center gap-4">
        <motion.div key={`${avatar}-${color}`} initial={{ scale: 0.85, rotate: -6 }} animate={{ scale: 1, rotate: 0 }}>
          <PlayerAvatar avatar={avatar} color={color} size="lg" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-bold text-muted">
            Display name
          </label>
          <div className="flex gap-2">
            <Input
              id={nameId}
              value={name}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="nickname"
              invalid={!!error}
              aria-describedby={error ? `${nameId}-err` : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Random name"
              className="shrink-0"
              onClick={() => {
                setName(randomGuestName());
                setError(null);
              }}
            >
              <Dices className="size-5" />
            </Button>
          </div>
          {error && (
            <p id={`${nameId}-err`} role="alert" className="mt-1.5 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-muted">Avatar</legend>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_IDS.map((id) => {
            const Icon = AVATAR_ICONS[id];
            const selected = id === avatar;
            return (
              <button
                key={id}
                type="button"
                aria-label={AVATAR_LABELS[id]}
                aria-pressed={selected}
                onClick={() => setAvatar(id)}
                className={cn(
                  "grid aspect-square place-items-center rounded-2xl border-2 transition-all",
                  selected
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-transparent bg-surface-2 text-ink-2 hover:border-border-strong",
                )}
              >
                <Icon className="size-6" strokeWidth={2.2} aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-muted">Colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={id}
              aria-pressed={id === color}
              onClick={() => setColor(id)}
              className="grid size-10 place-items-center rounded-full transition-transform hover:scale-110"
              style={{
                background: AVATAR_COLORS[id],
                boxShadow: id === color ? `0 0 0 3px var(--surface), 0 0 0 5px ${AVATAR_COLORS[id]}` : undefined,
              }}
            >
              {id === color && <Check className="size-5 text-white" strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" loading={saving} loadingText="Saving…">
        {submitLabel}
      </Button>
    </form>
  );
}
