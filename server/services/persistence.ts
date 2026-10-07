import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { MatchRecord } from "@/types/game";
import type { StoredProfile } from "./profile-store";

export interface Snapshot {
  schema: 1;
  savedAt: number;
  profiles: StoredProfile[];
  matches: MatchRecord[];
}

/**
 * Where profile/history data lives between restarts. No database: the
 * default writes a JSON snapshot. Implement this interface to plug in a real
 * store later without touching game code.
 */
export interface PersistenceAdapter {
  readonly kind: string;
  load(): Snapshot | null;
  save(snapshot: Snapshot): void;
}

export class MemoryPersistence implements PersistenceAdapter {
  readonly kind = "memory";
  load(): Snapshot | null {
    return null;
  }
  save(): void {}
}

export class JsonFilePersistence implements PersistenceAdapter {
  readonly kind = "file";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): Snapshot | null {
    try {
      const raw = readFileSync(this.path, "utf8");
      const data = JSON.parse(raw) as Snapshot;
      if (data?.schema !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.matches)) return null;
      return data;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[persistence] could not read ${this.path}; starting fresh`, err);
      }
      return null;
    }
  }

  /** Atomic: write a temp file then rename over the old one. */
  save(snapshot: Snapshot): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot));
    renameSync(tmp, this.path);
  }
}
