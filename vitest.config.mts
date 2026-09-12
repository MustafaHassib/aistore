import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: true,
    // PGlite boots a WASM Postgres per worker; several booting at once
    // comfortably exceeds the 5s default before any assertion runs.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
