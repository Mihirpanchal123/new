"use client";

import { useState } from "react";
import { toast } from "sonner";
import { command } from "@/lib/realtime/client";
import { selectOpponent } from "@/stores/game-store";
import type { RoomView } from "@/types/game";
import { PlayerAvatar } from "../player/player-avatar";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

/** "Alex wants a rematch!" — appears when the opponent asks. */
export function RematchDialog({ room }: { room: RoomView }) {
  const opponent = selectOpponent(room);
  const open = room.phase === "COMPLETE" && !!opponent && room.rematch?.requestedBy === opponent.id;
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  async function respond(accept: boolean) {
    setPending(accept ? "accept" : "decline");
    const res = await command("rematch:respond", { code: room.code, accept });
    setPending(null);
    if (!res.ok) toast.error(res.message);
  }

  if (!opponent) return null;
  return (
    <Dialog
      open={open && dismissedFor !== room.version}
      onOpenChange={(o) => {
        if (!o) setDismissedFor(room.version);
      }}
      title={`${opponent.displayName} wants a rematch!`}
      description="Same room, new chains. Ready for round two?"
    >
      <div className="mb-5 flex justify-center">
        <PlayerAvatar avatar={opponent.avatar} color={opponent.color} size="lg" bob />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" loading={pending === "decline"} onClick={() => respond(false)}>
          Decline
        </Button>
        <Button variant="success" size="lg" loading={pending === "accept"} onClick={() => respond(true)}>
          Accept
        </Button>
      </div>
    </Dialog>
  );
}
