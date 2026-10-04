// Runs every browser check against the finished app and prints one table, so "all the
// browser checks pass" is a single command, with how many scripts ran against how many exist.
//
//   PW_MODULE=<playwright/index.mjs> node design/harness/run-checks.mjs
//
// It builds the app, starts `vite preview` (the production build, :4173) and the harness
// (the real screens with mocked state, :5199), runs each script, and stops both servers.
// measure.mjs writes into design/baseline/, which is the stage-0 record, so its output is
// moved to design/stage-results/final-contrast-app.* and the baseline is restored.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.PW_MODULE) { console.error("set PW_MODULE to playwright/index.mjs (see design/README.md)"); process.exit(2); }
const win = process.platform === "win32";
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: win, env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
const last = (s, n = 1) => s.trim().split("\n").slice(-n).join(" | ");

console.log("building...");
const build = run("npm", ["run", "build"]);
if (build.status !== 0) { console.error(build.stdout + build.stderr); process.exit(1); }

const servers = [
  spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { shell: win, stdio: "ignore" }),
  spawn("npx", ["vite", "--config", "design/harness/vite.config.ts"], { shell: win, stdio: "ignore" }),
];
const stop = () => { for (const s of servers) { if (win) spawnSync("taskkill", ["/pid", String(s.pid), "/T", "/F"]); else s.kill(); } };
process.on("exit", stop);
async function up(url) { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 500)); } throw new Error(url + " did not start"); }
await up("http://localhost:4173/spellingbee/");
await up("http://localhost:5199/");

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };

// 1. contrast, app-wide
{
  const r = run("node", ["design/harness/measure.mjs"], { TARGET: "app" });
  const json = resolve("design/baseline/contrast-app.json");
  if (r.status !== 0 || !existsSync(json)) record("measure.mjs (contrast, app-wide)", false, last(r.stdout + r.stderr));
  else {
    const rows = JSON.parse(readFileSync(json, "utf8"));
    const m = new Map();
    for (const x of rows) { if (x.worst === null) continue; const k = [x.theme, x.page, x.kind, x.label, x.need].join("|"); m.set(k, [Math.min(m.get(k)?.[0] ?? 99, x.worst), x.need]); }
    const failing = [...m.values()].filter(([w, need]) => w < need).length;
    renameSync(json, resolve("design/stage-results/final-contrast-app.json"));
    renameSync(resolve("design/baseline/contrast-app.md"), resolve("design/stage-results/final-contrast-app.md"));
    spawnSync("git", ["checkout", "--", "design/baseline"]);
    record("measure.mjs (contrast, app-wide)", failing === 0, `${m.size} pairs, ${failing} failing`);
  }
}

const scripts = [
  ["check-tier-bars.mjs", {}],
  ["check-tier-focus.mjs", {}],
  ["check-settings-dialog.mjs", {}],
  ["keyboard-elimination.mjs", {}],
  ["check-reduced-motion.mjs", {}],
  ["check-network-screens.mjs", {}],
  ["check-real-app.mjs", {}],
  ["keyboard-real-app.mjs", {}],
  ["unused-selectors.mjs", {}, ["--fail"]],
  ["unused-tokens.mjs", {}, ["--fail"]],
];
for (const [file, env, extra = []] of scripts) {
  const r = run("node", [`design/harness/${file}`, ...extra], env);
  record(file, r.status === 0, last(r.stdout + r.stderr));
}
stop();

// how many browser-check scripts exist vs ran
const all = readdirSync("design/harness").filter((f) => /^(check-|keyboard-|measure)/.test(f) && f.endsWith(".mjs"));
const ran = new Set(["measure.mjs", ...scripts.map((s) => s[0])]);
const notRun = all.filter((f) => !ran.has(f));
console.log(`\nbrowser check scripts: ${all.filter((f) => ran.has(f)).length} run of ${all.length} (${notRun.length ? "not run: " + notRun.join(", ") + (notRun.includes("check-glow.mjs") ? " (check-glow is the Blue Ribbon prototype's no-yellow check; it fails honey by design)" : "") : "none skipped"})`);
const bad = results.filter((r) => !r.ok);
console.log(`${bad.length === 0 ? "PASS" : "FAIL"}: ${results.length - bad.length}/${results.length} checks pass`);
process.exit(bad.length ? 1 : 0);
