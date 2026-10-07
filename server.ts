/**
 * Word Duel server: one Node process serving the Next.js app and the
 * Socket.IO realtime endpoint on the same port.
 */
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { getContainer } from "./server/container";
import { attachRealtime, type GameServer } from "./server/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Create the shared container BEFORE Next loads any route code.
  const container = getContainer();
  const { config, logger } = container;

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const upgradeNext = app.getUpgradeHandler();

  // The Next handler must be registered BEFORE Socket.IO attaches: Engine.IO
  // wraps existing "request" listeners so /socket.io requests never reach Next.
  const httpServer = createServer((req, res) => {
    void handle(req, res);
  });

  const io: GameServer = new Server(httpServer, {
    path: "/socket.io",
    // Let non-Socket.IO upgrades (Next.js HMR in dev) through untouched.
    destroyUpgrade: false,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 16 * 1024,
    cors: config.corsOrigins.length ? { origin: config.corsOrigins, credentials: true } : undefined,
  });
  const realtime = attachRealtime(io, container);
  container.rooms.startSweeper();

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) return; // handled by Socket.IO
    void upgradeNext(req, socket, head);
  });

  httpServer.listen(port, hostname, () => {
    logger.info(
      "server",
      `Word Duel ready on http://${hostname}:${port} (${dev ? "development" : "production"}, persistence: ${config.persistence})`,
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server", `${signal} received, saving and shutting down`);
    container.profiles.flush();
    container.rooms.stop();
    realtime.close();
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start Word Duel server", err);
  process.exit(1);
});
