// Runs every browser check against the finished app and prints one table, so "all the
// browser checks pass" is a single command, with how many scripts ran against how many exist.
//
//   PW_MODULE=<playwright/index.mjs> node design/harness/run-checks.mjs
//
// It builds the app AND the harness, serves both as static production builds with
// `vite preview` on 127.0.0.1 (the app on :4173, the harness, i.e. the real screens with
// mocked state, on :5199), runs each script, and stops both servers.
//
// Why static builds on 127.0.0.1 (2026-10-07). One batch run had two scripts crash with only
// "Node.js v24.14.1" to show for it. Found by loading one screen repeatedly: the harness DEV
// server listened on [::1] only, and Chromium sometimes tried localhost's IPv4 address first;
// on Windows an IPv4 connect to a closed loopback port is retried for about 2 s before it
// fails, so page loads stalled for 2-8 s and twice in 25 loads past Playwright's 30 s
// navigation timeout. A dev server can also re-optimise dependencies and reload pages
// mid-run. A static build on an explicit IPv4 address does neither: 40 of 40 loads in
// 0.8-1.2 s. measure.mjs writes into design/baseline/, which is the stage-0 record, so its
// output is moved to design/stage-results/final-contrast-app.* and the baseline is restored.
//
// Every server's and script's full output is kept in a log folder (printed at the start), the
// servers are health-checked before each script, and a failing script's first error line is
// printed, so a crash can always be traced afterwards.
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (!process.env.PW_MODULE) { console.error("set PW_MODULE to playwright/index.mjs (see design/README.md)"); process.exit(2); }
const win = process.platform === "win32";
const LOGS = join(tmpdir(), "spellingbee-run-checks", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(LOGS, { recursive: true });
console.log(`logs: ${LOGS}`);
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: win, env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
const last = (s, n = 1) => s.trim().split("\n").slice(-n).join(" | ");
const firstError = (s) => s.split("\n").find((l) => /(^|\s)(FAIL|Error|error:|Timeout|net::ERR_)/.test(l))?.trim();

const APP = "http://127.0.0.1:4173/spellingbee/";
const HARNESS = "http://127.0.0.1:5199/";
const HARNESS_DIST = resolve("design/harness/dist");

async function answers(url) { try { return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; } }
for (const url of [APP, HARNESS]) if (await answers(url)) { console.error(`${url} is already being served by something else; stop it first (this script starts its own servers).`); process.exit(2); }

console.log("building the app and the harness...");
const build = run("npm", ["run", "build"]);
writeFileSync(join(LOGS, "build-app.log"), build.stdout + build.stderr);
if (build.status !== 0) { console.error(build.stdout + build.stderr); process.exit(1); }
const hbuild = run("npx", ["vite", "build", "--config", "design/harness/vite.config.ts", "--outDir", HARNESS_DIST, "--emptyOutDir"]);
writeFileSync(join(LOGS, "build-harness.log"), hbuild.stdout + hbuild.stderr);
if (hbuild.status !== 0) { console.error(hbuild.stdout + hbuild.stderr); process.exit(1); }

function serve(name, args) {
  const s = spawn("npx", args, { shell: win, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(join(LOGS, `server-${name}.log`));
  s.stdout.pipe(log); s.stderr.pipe(log);
  s.on("exit", (code) => log.write(`\n[server exited with code ${code}]\n`));
  return s;
}
const servers = [
  serve("app", ["vite", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"]),
  serve("harness", ["vite", "preview", "--config", "design/harness/vite.config.ts", "--outDir", HARNESS_DIST, "--host", "127.0.0.1", "--port", "5199", "--strictPort"]),
];
let stopped = false;
const stop = () => { if (stopped) return; stopped = true; for (const s of servers) { if (win) spawnSync("taskkill", ["/pid", String(s.pid), "/T", "/F"]); else s.kill(); } };
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });
async function up(url) { for (let i = 0; i < 60; i++) { if (await answers(url)) return; await new Promise((r) => setTimeout(r, 500)); } throw new Error(url + " did not start; see " + LOGS); }
await up(APP);
await up(HARNESS);

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const env = { APP_URL: HARNESS.replace(/\/$/, "") };
const appEnv = { APP_URL: APP };

// 1. contrast, app-wide
{
  const r = run("node", ["design/harness/measure.mjs"], { TARGET: "app", ...env });
  writeFileSync(join(LOGS, "measure.log"), r.stdout + r.stderr);
  const json = resolve("design/baseline/contrast-app.json");
  if (r.status !== 0 || !existsSync(json)) record("measure.mjs (contrast, app-wide)", false, firstError(r.stdout + r.stderr) ?? last(r.stdout + r.stderr));
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
  ["check-tier-bars.mjs", env],
  ["check-tier-focus.mjs", {}],
  ["check-settings-dialog.mjs", env],
  ["keyboard-elimination.mjs", env],
  ["check-reduced-motion.mjs", env],
  ["check-network-screens.mjs", env],
  ["check-layering.mjs", env],
  ["check-hover-flash.mjs", env],
  ["check-real-app.mjs", appEnv],
  ["keyboard-real-app.mjs", appEnv],
  ["unused-selectors.mjs", {}, ["--fail"]],
  ["unused-tokens.mjs", {}, ["--fail"]],
];
for (const [file, scriptEnv, extra = []] of scripts) {
  for (const [name, url] of [["app", APP], ["harness", HARNESS]]) if (!(await answers(url))) { record(file, false, `the ${name} server is not answering before this script; see ${join(LOGS, `server-${name}.log`)}`); }
  const r = run("node", [`design/harness/${file}`, ...extra], scriptEnv);
  const out = r.stdout + r.stderr;
  writeFileSync(join(LOGS, file.replace(/\.mjs$/, ".log")), out);
  if (r.status === 0) record(file, true, last(out));
  else record(file, false, `${firstError(out) ?? "(no error line)"} | ${last(out)} | full output: ${join(LOGS, file.replace(/\.mjs$/, ".log"))}`);
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
