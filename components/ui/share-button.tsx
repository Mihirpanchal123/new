"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { shareOrCopy } from "@/lib/share";
import { Button, type ButtonProps } from "./button";

export function ShareButton({ text, path, label = "Share", ...props }: { text: string; path?: string; label?: string } & ButtonProps) {
  return (
    <Button
      variant="secondary"
      {...props}
      onClick={async () => {
        const url = path ? `${window.location.origin}${path}` : undefined;
        const res = await shareOrCopy({ title: "Word Duel", text, url });
        if (res === "copied") toast.success("Copied to clipboard!");
        if (res === "failed") toast.error("Couldn't share right now.");
      }}
    >
      <Share2 className="size-5" aria-hidden /> {label}
    </Button>
  );
}
