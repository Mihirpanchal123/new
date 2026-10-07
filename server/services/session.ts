import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "wd_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 365;

const ID_PATTERN = /^[0-9a-f-]{36}$/;

function sign(playerId: string, secret: string): string {
  return createHmac("sha256", secret).update(`wd1:${playerId}`).digest("base64url");
}

/** Token format: `<playerId>.<hmac>` — tamper-proof, no server storage needed. */
export function signSession(playerId: string, secret: string): string {
  return `${playerId}.${sign(playerId, secret)}`;
}

export function verifySession(token: string | undefined | null, secret: string): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const playerId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!ID_PATTERN.test(playerId)) return null;
  const expected = Buffer.from(sign(playerId, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return playerId;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}
