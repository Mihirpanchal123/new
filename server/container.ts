import { createAnalytics, type Analytics } from "@/lib/analytics";
import { loadConfig, type ServerConfig } from "./config";
import { GameEngine } from "./game/engine";
import { RoomManager } from "./game/room-manager";
import { Logger } from "./services/logger";
import { JsonFilePersistence, MemoryPersistence } from "./services/persistence";
import { ProfileStore } from "./services/profile-store";
import { RateLimiter } from "./services/rate-limit";
import { WordValidationService } from "./services/word-validation";

export interface Presence {
  /** Players with a live socket right now. */
  onlinePlayers(): number;
  isOnline(playerId: string): boolean;
}

export interface Container {
  config: ServerConfig;
  logger: Logger;
  analytics: Analytics;
  profiles: ProfileStore;
  engine: GameEngine;
  rooms: RoomManager;
  rateLimiter: RateLimiter;
  wordValidation: WordValidationService;
  presence: Presence;
  startedAt: number;
}

const KEY = Symbol.for("word-duel.container");
type GlobalWithContainer = typeof globalThis & { [KEY]?: Container };

export function createContainer(overrides: Partial<Pick<Container, "profiles">> & { config?: ServerConfig } = {}): Container {
  const config = overrides.config ?? loadConfig();
  const logger = new Logger();
  const analytics = createAnalytics(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER);
  const persistence = config.persistence === "file" ? new JsonFilePersistence(config.dataFile) : new MemoryPersistence();
  const profiles = overrides.profiles ?? new ProfileStore(persistence);
  const engine = new GameEngine({ timings: config.timings, scoring: config.scoring });
  const rooms = new RoomManager(engine, profiles, analytics, logger);
  return {
    config,
    logger,
    analytics,
    profiles,
    engine,
    rooms,
    rateLimiter: new RateLimiter(),
    wordValidation: new WordValidationService(),
    presence: { onlinePlayers: () => 0, isOnline: () => false },
    startedAt: Date.now(),
  };
}

/**
 * Process-wide singleton. Stored on globalThis because the custom server
 * (loaded by tsx) and Next.js route handlers / server components (bundled
 * separately) evaluate this module independently but must share one state.
 */
export function getContainer(): Container {
  const g = globalThis as GlobalWithContainer;
  g[KEY] ??= createContainer();
  return g[KEY];
}

export function setContainer(container: Container): void {
  (globalThis as GlobalWithContainer)[KEY] = container;
}
