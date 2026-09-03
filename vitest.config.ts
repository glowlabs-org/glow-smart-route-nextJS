import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js boundary markers throw at import time to enforce
      // server/client separation at build time. vitest has no concept of
      // those boundaries and just needs the imports to resolve, so point
      // them at a no-op module.
      "server-only": path.resolve(
        __dirname,
        "./__tests__/fixtures/empty-module.ts",
      ),
      "client-only": path.resolve(
        __dirname,
        "./__tests__/fixtures/empty-module.ts",
      ),
    },
  },
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    // `.claude/worktrees/**` holds throwaway git worktrees of this repo. Their
    // test files are stale copies that pass or fail against code nobody is
    // editing, so vitest must not collect them.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**"],
    globals: true,
    // happy-dom enables renderHook / DOM APIs for component-level tests while
    // staying lightweight enough for our existing pure-logic tests.
    environment: "happy-dom",
  },
});
