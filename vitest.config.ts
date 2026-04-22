import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    globals: true,
    // happy-dom enables renderHook / DOM APIs for component-level tests while
    // staying lightweight enough for our existing pure-logic tests.
    environment: "happy-dom",
  },
});
