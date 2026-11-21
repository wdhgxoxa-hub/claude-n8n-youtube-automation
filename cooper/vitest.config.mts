import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    ...(process.env.COOPER_CI_REPORTES === "1"
      ? {
          reporters: ["default", "json"],
          outputFile: ".cache/puerta/vitest.json",
        }
      : {}),
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
  },
});
