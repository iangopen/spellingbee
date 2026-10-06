// Screenshot harness for the redesign audit. NOT part of the app build.
//
// Renders the real screen components from ../../src with mocked props, so
// every screen (multiplayer included) can be captured without signing in,
// creating an anonymous user or touching Supabase. The three modules that
// would reach the network are swapped for local stubs at resolve time.
//
// Run: npx vite --config design/harness/vite.config.ts
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");

const STUBS: Array<[RegExp, string]> = [
  [/\/lib\/rooms(\.ts)?$/, resolve(here, "stubs/rooms.ts")],
  [/\/lib\/supabaseClient(\.ts)?$/, resolve(here, "stubs/supabaseClient.ts")],
  [/\/hooks\/useSupabaseUser(\.ts)?$/, resolve(here, "stubs/useSupabaseUser.ts")],
];

function stubNetwork(): Plugin {
  return {
    name: "harness-stub-network",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer || importer.includes("/design/harness/stubs/")) return null;
      for (const [re, target] of STUBS) if (re.test(source)) return target;
      return null;
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [stubNetwork(), react()],
  // 127.0.0.1, not "localhost": a server on localhost listens on [::1] only here, and a browser
  // that tries localhost's IPv4 address first waits ~2 s per attempt on Windows (see run-checks.mjs).
  server: { host: "127.0.0.1", port: 5199, strictPort: true, fs: { allow: [repo] } },
  preview: { host: "127.0.0.1", port: 5199, strictPort: true },
});
