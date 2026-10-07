"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { copyText, roomShareText, shareOrCopy } from "@/lib/share";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

/** Big, legible game code as letter tiles. */
export function RoomCode({ code, size = "lg" }: { code: string; size?: "md" | "lg" }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-muted">Game code</span>
      <div className="flex gap-1.5 sm:gap-2" aria-label={`Game code ${code.split("").join(" ")}`} role="text">
        {code.split("").map((ch, i) => (
          <motion.span
            key={`${ch}-${i}`}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 500, damping: 26 }}
            aria-hidden
            className={cn(
              "grid place-items-center rounded-xl border-2 border-border bg-surface font-display font-bold shadow-[0_3px_0_0_var(--border)]",
              size === "lg" ? "h-14 w-11 text-3xl sm:h-16 sm:w-13 sm:text-4xl" : "h-11 w-9 text-2xl",
            )}
          >
            {ch}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export function CopyCodeButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      className={className}
      onClick={async () => {
        const ok = await copyText(code);
        if (ok) {
          setCopied(true);
          toast.success("Code copied!", { id: "copy-code" });
          window.setTimeout(() => setCopied(false), 1600);
        } else {
          toast.error("Couldn't copy — the code is " + code);
        }
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "copy"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="inline-flex"
        >
          {copied ? <Check className="size-5 text-success" aria-hidden /> : <Copy className="size-5" aria-hidden />}
        </motion.span>
      </AnimatePresence>
      {copied ? "Copied" : "Copy code"}
    </Button>
  );
}

export function ShareRoomButton({ code, className }: { code: string; className?: string }) {
  return (
    <Button
      className={className}
      onClick={async () => {
        const url = `${window.location.origin}/game/${code}`;
        const outcome = await shareOrCopy({ title: "Word Duel", text: roomShareText(code), url });
        if (outcome === "copied") toast.success("Invite link copied!", { id: "share-room" });
        if (outcome === "failed") toast.error("Couldn't share — send the code instead.");
        if (outcome === "shared" || outcome === "copied") analytics.track("room_shared", { method: outcome });
      }}
    >
      <Share2 className="size-5" aria-hidden />
      Share game
    </Button>
  );
}
