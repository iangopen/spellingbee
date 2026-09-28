import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that file's `base` is load-bearing
// for the GitHub Pages deploy and nothing test-related belongs next to it.
//
//   npm test         -> pure client logic under src/
//   npm run test:db  -> the real migrations under PGlite (supabase/tests/)
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "supabase/tests/**/*.test.mjs"],
    environment: "node",
    // Each DB test file migrates a fresh in-process Postgres (~1.5s, 1,200 words).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
