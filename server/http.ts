import { cookies, headers } from "next/headers";
import { getContainer } from "./container";
import { SESSION_COOKIE, verifySession } from "./services/session";

/** Player id from the signed session cookie, for Server Components and Route Handlers. */
export async function getSessionPlayerId(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, getContainer().config.sessionSecret);
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
