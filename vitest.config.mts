import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/{unit,integration,realtime}/**/*.test.ts"],
    env: { WD_SILENT: "1", PERSISTENCE: "memory" },
    testTimeout: 15_000,
  },
});
