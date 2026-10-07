import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

export function GET() {
  const c = getContainer();
  return NextResponse.json(
    {
      ok: true,
      uptimeS: Math.round((Date.now() - c.startedAt) / 1000),
      persistence: c.config.persistence,
      ...c.rooms.stats(),
      playersOnline: c.presence.onlinePlayers(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
