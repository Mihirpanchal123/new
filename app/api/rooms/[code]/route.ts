import { NextResponse } from "next/server";
import { roomCodeSchema } from "@/lib/validation/schemas";
import { getContainer } from "@/server/container";
import { friendlyMessage } from "@/server/game/errors";
import { getClientIp, getSessionPlayerId } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Pre-flight check used by the Join screen. Reveals only what a joiner needs
 * (does it exist, can I get in) — never players' words or game details.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = getContainer();
  if (!c.rateLimiter.consume("joinRoom", await getClientIp())) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED", message: friendlyMessage("RATE_LIMITED") }, { status: 429 });
  }

  const parsed = roomCodeSchema.safeParse((await params).code);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const code = parsed.data;
  const summary = c.rooms.summary(code, await getSessionPlayerId());
  if (!summary) {
    const error = c.rooms.isRetired(code) ? "ROOM_EXPIRED" : "ROOM_NOT_FOUND";
    return NextResponse.json({ ok: false, error, message: friendlyMessage(error) }, { status: 404 });
  }
  if (!summary.joinable) {
    const error = summary.phase === "LOBBY" ? "ROOM_FULL" : summary.phase === "COMPLETE" ? "GAME_OVER" : "GAME_IN_PROGRESS";
    return NextResponse.json({ ok: false, error, message: friendlyMessage(error) }, { status: 409 });
  }
  return NextResponse.json({ ok: true, room: summary }, { headers: { "cache-control": "no-store" } });
}
