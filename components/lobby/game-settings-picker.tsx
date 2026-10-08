"use client";

import { Infinity as InfinityIcon, Link2, Timer } from "lucide-react";
import { CHAIN_LENGTH_OPTIONS, type GameSettings, TURN_TIME_OPTIONS } from "@/constants/game";
import { cn } from "@/lib/utils";

function Options<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  disabled,
  columns,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; aria?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  columns: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-2xl bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.aria}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-11 items-center justify-center gap-1 rounded-xl font-display text-base font-bold tabular transition-colors",
              checked ? "bg-brand text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink",
              disabled && !checked && "opacity-50",
              disabled && "cursor-not-allowed",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const fmtTime = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60}m` : `${s}s`);

/** Words per chain (4–8) and time per turn (or no timer). */
export function GameSettingsPicker({
  value,
  onChange,
  disabled,
}: {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
  disabled?: boolean;
}) {
  const seconds = value.turnMs === null ? null : Math.round(value.turnMs / 1000);
  const timeOptions: { value: number | null; label: React.ReactNode; aria?: string }[] = [
    { value: null, label: <InfinityIcon className="size-5" aria-hidden />, aria: "No timer" },
    ...TURN_TIME_OPTIONS.map((s) => ({ value: s as number | null, label: fmtTime(s), aria: `${s} seconds` })),
  ];
  // Keep a non-preset value (e.g. set by env) selectable/visible.
  if (seconds !== null && !TURN_TIME_OPTIONS.includes(seconds as (typeof TURN_TIME_OPTIONS)[number])) {
    timeOptions.push({ value: seconds, label: fmtTime(seconds), aria: `${seconds} seconds` });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-xs font-extrabold uppercase tracking-wider text-muted">
          <Link2 className="size-4" aria-hidden /> <span className="whitespace-nowrap">Words per chain</span>
          <span className="ml-auto whitespace-nowrap normal-case tracking-normal">{value.chainLength - 1} rounds</span>
        </p>
        <Options
          label="Words per chain"
          value={value.chainLength}
          options={CHAIN_LENGTH_OPTIONS.map((n) => ({ value: n as number, label: n, aria: `${n} words` }))}
          onChange={(chainLength) => onChange({ ...value, chainLength })}
          disabled={disabled}
          columns={CHAIN_LENGTH_OPTIONS.length}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-xs font-extrabold uppercase tracking-wider text-muted">
          <Timer className="size-4" aria-hidden /> <span className="whitespace-nowrap">Time per turn</span>
          <span className="ml-auto whitespace-nowrap normal-case tracking-normal">
            {seconds === null ? "Untimed · no speed bonus" : `${seconds} seconds`}
          </span>
        </p>
        <Options
          label="Time per turn"
          value={seconds}
          options={timeOptions}
          onChange={(s) => onChange({ ...value, turnMs: s === null ? null : s * 1000 })}
          disabled={disabled}
          columns={4}
        />
      </div>
    </div>
  );
}
