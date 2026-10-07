export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  at: number;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
}

const RING_SIZE = 100;

/** Small structured logger that also keeps recent errors for the admin panel. */
export class Logger {
  readonly recentErrors: LogEntry[] = [];
  readonly suspicious: LogEntry[] = [];
  private readonly minLevel: LogLevel;

  constructor(minLevel: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug") {
    this.minLevel = minLevel;
  }

  debug(scope: string, message: string, meta?: Record<string, unknown>) {
    this.write("debug", scope, message, meta);
  }
  info(scope: string, message: string, meta?: Record<string, unknown>) {
    this.write("info", scope, message, meta);
  }
  warn(scope: string, message: string, meta?: Record<string, unknown>) {
    this.write("warn", scope, message, meta);
  }
  error(scope: string, message: string, meta?: Record<string, unknown>) {
    const entry = this.write("error", scope, message, meta);
    push(this.recentErrors, entry);
  }

  /** Possible cheating / abuse. Logged and kept for review, never auto-banned in V1. */
  suspect(scope: string, message: string, meta?: Record<string, unknown>) {
    const entry = this.write("warn", scope, `[suspicious] ${message}`, meta);
    push(this.suspicious, entry);
  }

  private write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = { at: Date.now(), level, scope, message, meta };
    if (ORDER[level] >= ORDER[this.minLevel] && process.env.WD_SILENT !== "1") {
      const line = `[${new Date(entry.at).toISOString()}] ${level.toUpperCase()} ${scope}: ${message}`;
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      if (meta) fn(line, meta);
      else fn(line);
    }
    return entry;
  }
}

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function push(ring: LogEntry[], entry: LogEntry) {
  ring.unshift(entry);
  if (ring.length > RING_SIZE) ring.length = RING_SIZE;
}
