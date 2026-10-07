import { NextResponse, type NextRequest } from "next/server";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { getContainer } from "@/server/container";
import { toPublic } from "@/server/game/engine";
import { getClientIp, getSessionPlayerId } from "@/server/http";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, signSession } from "@/server/services/session";
import type { AvatarColor, AvatarId } from "@/constants/profile";

export const dynamic = "force-dynamic";

function withSession(body: unknown, playerId: string, status = 200) {
  const { config } = getContainer();
  const token = signSession(playerId, config.sessionSecret);
  const res = NextResponse.json(
    typeof body === "object" && body !== null ? { ...body, token } : body,
    { status, headers: { "cache-control": "no-store" } },
  );
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

/** Returns the current guest profile, creating one on first visit. */
export async function GET() {
  const c = getContainer();
  let playerId = await getSessionPlayerId();
  if (!playerId) {
    if (!c.rateLimiter.consume("session", await getClientIp())) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    playerId = c.profiles.createGuest().id;
  }
  const profile = c.profiles.ensure(playerId);
  c.profiles.touch(playerId);
  return withSession({ profile: c.profiles.toView(profile) }, playerId);
}

/** Update display name / avatar / colour. */
export async function PATCH(req: NextRequest) {
  const c = getContainer();
  const playerId = await getSessionPlayerId();
  if (!playerId) return NextResponse.json({ error: "No session." }, { status: 401 });
  if (!c.rateLimiter.consume("profile", playerId)) {
    return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile." }, { status: 400 });
  }

  const profile = c.profiles.update(playerId, {
    displayName: parsed.data.displayName,
    avatar: parsed.data.avatar as AvatarId | undefined,
    color: parsed.data.color as AvatarColor | undefined,
  });

  // Keep live rooms in sync so opponents see the new name/avatar.
  for (const room of c.rooms.roomsForPlayer(playerId)) {
    try {
      c.rooms.apply(room.code, (r) => c.engine.updateProfile(r, toPublic(profile)));
    } catch {
      /* room may have just closed */
    }
  }
  return withSession({ profile: c.profiles.toView(profile) }, playerId);
}
