"use client";

import { LoaderCircle, Mic, MicOff, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVoiceStore } from "@/stores/voice-store";

const pill = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors";

/** Opt-in voice chat with the opponent. Hidden where the browser can't do it. */
export function VoiceControl({ opponentName, className }: { opponentName?: string; className?: string }) {
  const { session, status, muted, peerInVoice, peerMuted } = useVoiceStore();
  if (!session) return null;
  const name = opponentName ?? "Your opponent";

  if (status === "off" || status === "requesting") {
    const join = async () => {
      try {
        await session.join();
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        toast.error(
          denied
            ? "Microphone access was blocked. Allow it in your browser to use voice."
            : "We couldn't reach your microphone.",
        );
      }
    };
    return (
      <button
        type="button"
        onClick={() => void join()}
        disabled={status === "requesting"}
        className={cn(
          pill,
          peerInVoice ? "bg-success/15 text-success hover:bg-success/25" : "text-muted hover:bg-surface-2 hover:text-ink",
          className,
        )}
        aria-label={peerInVoice ? `Join voice chat — ${name} is waiting` : "Join voice chat"}
      >
        {status === "requesting" ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Mic className="size-3.5" aria-hidden />
        )}
        <span>{peerInVoice ? "Join voice" : "Voice"}</span>
        {peerInVoice && <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />}
      </button>
    );
  }

  const label =
    status === "waiting"
      ? `Waiting for ${name}…`
      : status === "connecting"
        ? "Connecting…"
        : peerMuted
          ? `${name} is muted`
          : "Voice on";

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-surface-2 p-0.5", className)} role="group" aria-label="Voice chat">
      <span role="status" aria-live="polite" className="sr-only px-2 text-xs font-bold text-muted sm:not-sr-only">
        {label}
      </span>
      <span
        aria-hidden
        className={cn("ml-1.5 size-2 rounded-full sm:hidden", status === "live" ? "bg-success" : "animate-pulse bg-hint")}
      />
      <button
        type="button"
        onClick={() => session.setMuted(!muted)}
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        className={cn(
          "grid size-7 place-items-center rounded-full transition-colors",
          muted ? "bg-danger-soft text-danger" : "text-ink hover:bg-surface",
        )}
      >
        {muted ? <MicOff className="size-3.5" aria-hidden /> : <Mic className="size-3.5" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => session.leave()}
        aria-label="Leave voice chat"
        className="grid size-7 place-items-center rounded-full text-danger transition-colors hover:bg-danger-soft"
      >
        <PhoneOff className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
