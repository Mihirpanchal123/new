"use client";

import { Switch as RadixSwitch } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingSwitch({
  id,
  label,
  description,
  icon,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-16 items-center gap-4 py-3">
      {icon && <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{icon}</div>}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-bold">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors",
          "bg-surface-3 data-[state=checked]:bg-brand",
        )}
      >
        <RadixSwitch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[26px]" />
      </RadixSwitch.Root>
    </div>
  );
}
