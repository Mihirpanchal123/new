import { DEFAULT_TIMINGS, type Timings } from "@/constants/game";
import { SCORING, type ScoringConfig } from "@/constants/scoring";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface ServerConfig {
  isProduction: boolean;
  timings: Timings;
  scoring: ScoringConfig;
  sessionSecret: string;
  adminToken: string | null;
  adminShowSecrets: boolean;
  persistence: "file" | "memory";
  dataFile: string;
  corsOrigins: string[];
}

let warned = false;

export function loadConfig(): ServerConfig {
  const isProduction = process.env.NODE_ENV === "production";
  let sessionSecret = process.env.SESSION_SECRET ?? "";
  if (!sessionSecret || sessionSecret === "change-me-to-a-long-random-string") {
    if (isProduction) {
      throw new Error("SESSION_SECRET must be set to a long random value in production.");
    }
    if (!warned) {
      console.warn("[word-duel] SESSION_SECRET not set — using an insecure development secret.");
      warned = true;
    }
    sessionSecret = "word-duel-dev-secret-do-not-use-in-production";
  }

  return {
    isProduction,
    timings: {
      // WD_* overrides exist mainly so end-to-end tests can run quickly.
      turnMs: intEnv("WD_TURN_MS", DEFAULT_TIMINGS.turnMs),
      resultMs: intEnv("WD_RESULT_MS", DEFAULT_TIMINGS.resultMs),
      countdownMs: intEnv("WD_COUNTDOWN_MS", DEFAULT_TIMINGS.countdownMs),
      disconnectGraceMs: intEnv("WD_DISCONNECT_GRACE_MS", DEFAULT_TIMINGS.disconnectGraceMs),
      latencyGraceMs: DEFAULT_TIMINGS.latencyGraceMs,
      lowTimeMs: DEFAULT_TIMINGS.lowTimeMs,
    },
    scoring: { ...SCORING },
    sessionSecret,
    adminToken: process.env.ADMIN_TOKEN?.trim() || null,
    adminShowSecrets: !isProduction && process.env.ADMIN_SHOW_SECRETS === "true",
    persistence: process.env.PERSISTENCE === "memory" ? "memory" : "file",
    dataFile: process.env.DATA_FILE || ".data/word-duel.json",
    corsOrigins: (process.env.REALTIME_CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
