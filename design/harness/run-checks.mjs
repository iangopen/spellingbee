// Runs every browser check against the finished app and prints one table, so "all the
// browser checks pass" is a single command, with how many scripts ran against how many exist.
//
//   PW_MODULE=<playwright/index.mjs> [SB_APP_PORT=4273] [SB_HARNESS_PORT=5199] node design/harness/run-checks.mjs
//
// It builds the app AND the harness, serves both as static production builds with
// `vite preview` on 127.0.0.1 (the app on :4273, the harness, i.e. the real screens with
// mocked state, on :5199), runs each script, and stops both servers.
//
// Ports (2026-10-13). The app used to be on 4173, vite preview's default, which other
// projects on this laptop also use for their previews. Both ports are now set by SB_APP_PORT
// and SB_HARNESS_PORT, the app's default is the less common 4273, and each port is checked by
// binding it before anything starts: a port that is merely bound by another project (whose
// server answers 404 at our path) used to slip past the old "is it already answering" test.
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
//
// Optional settings (each defaults to the local behaviour; .github/workflows/checks.yml sets them):
//   SB_LOG_DIR=<dir>     the log folder (default: a new folder under the OS temp dir)
//   SB_OUT_DIR=<dir>     contrast tables go to <dir>/contrast instead of design/stage-results
//                        (the committed files are left alone), failure screenshots to
//                        <dir>/failures, screenshots a script writes to <dir>/shots
//   SB_REUSE_BUILD=1     serve the existing dist/ instead of running `npm run build` again
//   GITHUB_STEP_SUMMARY  set by GitHub Actions: the result table is appended to it
// Exit code: 0 only when every check passed, 1 when any failed, 2 when it could not start.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (!process.env.PW_MODULE) { console.error("set PW_MODULE to playwright/index.mjs (see design/README.md)"); process.exit(2); }
const win = process.platform === "win32";
const LOGS = resolve(process.env.SB_LOG_DIR ?? join(tmpdir(), "spellingbee-run-checks", new Date().toISOString().replace(/[:.]/g, "-")));
mkdirSync(LOGS, { recursive: true });
const OUT = process.env.SB_OUT_DIR ? resolve(process.env.SB_OUT_DIR) : null;
const FAIL_SHOTS = OUT ? join(OUT, "failures") : null;
const SHOTS = OUT ? join(OUT, "shots") : null;
for (const d of [FAIL_SHOTS, SHOTS]) if (d) mkdirSync(d, { recursive: true });
console.log(`logs: ${LOGS}`);
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: win, env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
const last = (s, n = 1) => s.trim().split("\n").slice(-n).join(" | ");
const firstError = (s) => s.split("\n").find((l) => /(^|\s)(FAIL|Error|error:|Timeout|net::ERR_)/.test(l))?.trim();

const APP_PORT = Number(process.env.SB_APP_PORT ?? 4273);
const HARNESS_PORT = Number(process.env.SB_HARNESS_PORT ?? 5199);
const APP = `http://127.0.0.1:${APP_PORT}/spellingbee/`;
const HARNESS = `http://127.0.0.1:${HARNESS_PORT}/`;
// Relative to the harness config's `root` (design/harness). Not an absolute path: with
// `shell: true` on Windows an argument is split at spaces, and this repo lives under
// "github projects", so an absolute --outDir became two arguments and the build failed.
const HARNESS_DIST = "dist";

// A fresh connection per probe (agent: false), never fetch's keep-alive pool. Each script runs
// under spawnSync, which blocks this event loop for minutes; vite preview closes the idle pooled
// socket after 5 s, this process never sees the close, and the next probe is written onto a dead
// socket and gets ECONNRESET. That failed the app probe before every other script while the
// server was fine (2026-10-12; reproduced with two servers and blocking spawns).
function answers(url) {
  return new Promise((done) => {
    const req = http.get(url, { agent: false, timeout: 3000 }, (res) => { res.resume(); done(res.statusCode >= 200 && res.statusCode < 300); });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => done(false));
  });
}
// Free means we can bind it ourselves, right now, on the address vite preview will use.
function portFree(port) {
  return new Promise((done) => {
    const probe = net.createServer();
    probe.once("error", () => done(false));
    probe.once("listening", () => probe.close(() => done(true)));
    probe.listen(port, "127.0.0.1");
  });
}
for (const [name, port, envVar] of [["app", APP_PORT, "SB_APP_PORT"], ["harness", HARNESS_PORT, "SB_HARNESS_PORT"]]) {
  if (!(await portFree(port))) {
    console.error(`port ${port} (the ${name} preview) is already in use, probably by another project's preview. Stop it, or pick another port with ${envVar}=<port>. Nothing was built or started.`);
    process.exit(2);
  }
}

const reuse = process.env.SB_REUSE_BUILD === "1" && existsSync("dist/index.html");
console.log(reuse ? "reusing dist/ (SB_REUSE_BUILD=1), building the harness..." : "building the app and the harness...");
if (!reuse) {
  const build = run("npm", ["run", "build"]);
  writeFileSync(join(LOGS, "build-app.log"), build.stdout + build.stderr);
  if (build.status !== 0) { console.error(build.stdout + build.stderr); process.exit(1); }
}
const hbuild = run("npx", ["vite", "build", "--config", "design/harness/vite.config.ts", "--outDir", HARNESS_DIST, "--emptyOutDir"]);
writeFileSync(join(LOGS, "build-harness.log"), hbuild.stdout + hbuild.stderr);
if (hbuild.status !== 0) { console.error(hbuild.stdout + hbuild.stderr); process.exit(1); }

// Off Windows each server gets its own process group (detached), so stop() kills npx AND the
// vite process under it; killing npx alone can leave vite running and holding the port.
function serve(name, args) {
  const s = spawn("npx", args, { shell: win, detached: !win, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(join(LOGS, `server-${name}.log`));
  s.stdout.pipe(log); s.stderr.pipe(log);
  s.on("exit", (code) => log.write(`\n[server exited with code ${code}]\n`));
  return s;
}
const servers = [
  serve("app", ["vite", "preview", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"]),
  serve("harness", ["vite", "preview", "--config", "design/harness/vite.config.ts", "--outDir", HARNESS_DIST, "--host", "127.0.0.1", "--port", String(HARNESS_PORT), "--strictPort"]),
];
let stopped = false;
const stop = () => { if (stopped) return; stopped = true; for (const s of servers) { if (win) spawnSync("taskkill", ["/pid", String(s.pid), "/T", "/F"]); else { try { process.kill(-s.pid, "SIGTERM"); } catch { s.kill(); } } } };
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });
async function up(url) { for (let i = 0; i < 60; i++) { if (await answers(url)) return; await new Promise((r) => setTimeout(r, 500)); } throw new Error(url + " did not start; see " + LOGS); }
await up(APP);
await up(HARNESS);

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const shotEnv = FAIL_SHOTS ? { FAIL_SHOTS } : {};
const env = { APP_URL: HARNESS.replace(/\/$/, ""), ...shotEnv };
const appEnv = { APP_URL: APP, ...shotEnv };

// 1. contrast, app-wide
{
  const contrastDir = OUT ? join(OUT, "contrast") : resolve("design/baseline");
  const r = run("node", ["design/harness/measure.mjs"], { TARGET: "app", ...env, ...(OUT ? { OUT_DIR: contrastDir } : {}) });
  writeFileSync(join(LOGS, "measure.log"), r.stdout + r.stderr);
  const json = join(contrastDir, "contrast-app.json");
  if (r.status !== 0 || !existsSync(json)) record("measure.mjs (contrast, app-wide)", false, firstError(r.stdout + r.stderr) ?? last(r.stdout + r.stderr));
  else {
    const rows = JSON.parse(readFileSync(json, "utf8"));
    const m = new Map();
    for (const x of rows) { if (x.worst === null) continue; const k = [x.theme, x.page, x.kind, x.label, x.need].join("|"); m.set(k, [Math.min(m.get(k)?.[0] ?? 99, x.worst), x.need]); }
    const failing = [...m.values()].filter(([w, need]) => w < need).length;
    if (!OUT) {
      renameSync(json, resolve("design/stage-results/final-contrast-app.json"));
      renameSync(resolve("design/baseline/contrast-app.md"), resolve("design/stage-results/final-contrast-app.md"));
      spawnSync("git", ["checkout", "--", "design/baseline"]);
    }
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
  ["check-touch-autosubmit.mjs", { ...appEnv, ...(SHOTS ? { SHOTS } : {}) }],
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
// Screenshot scripts, run while the servers are up, when SB_OUT_DIR is set and the branch has
// them. They are not checks, but a crash is recorded as a failure so it cannot pass unnoticed.
const SHOOTS = [["shoot-avatars.mjs", "avatars"]];
if (SHOTS) for (const [file, dir] of SHOOTS) {
  if (!existsSync(`design/harness/${file}`)) { console.log(`skip  ${file} (not on this branch)`); continue; }
  const r = run("node", [`design/harness/${file}`], { APP_URL: HARNESS.replace(/\/$/, ""), OUT_DIR: join(SHOTS, dir) });
  const out = r.stdout + r.stderr;
  writeFileSync(join(LOGS, file.replace(/\.mjs$/, ".log")), out);
  record(`${file} (screenshots)`, r.status === 0, r.status === 0 ? last(out) : `${firstError(out) ?? "(no error line)"} | ${last(out)}`);
}
stop();

// how many browser-check scripts exist vs ran
const all = readdirSync("design/harness").filter((f) => /^(check-|keyboard-|measure)/.test(f) && f.endsWith(".mjs"));
const ran = new Set(["measure.mjs", ...scripts.map((s) => s[0])]);
const notRun = all.filter((f) => !ran.has(f));
const coverage = `browser check scripts: ${all.filter((f) => ran.has(f)).length} run of ${all.length} (${notRun.length ? "not run: " + notRun.join(", ") + (notRun.includes("check-glow.mjs") ? " (check-glow is the Blue Ribbon prototype's no-yellow check; it fails honey by design)" : "") : "none skipped"})`;
console.log(`\n${coverage}`);
const bad = results.filter((r) => !r.ok);
const verdict = `${bad.length === 0 ? "PASS" : "FAIL"}: ${results.length - bad.length}/${results.length} checks pass`;
console.log(verdict);
if (process.env.GITHUB_STEP_SUMMARY) {
  const cell = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 400);
  const rows = results.map((r) => `| ${r.ok ? "PASS" : "**FAIL**"} | \`${r.name}\` | ${cell(r.detail)} |`).join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Browser checks (run-checks.mjs)\n\n**${verdict}**\n\n| | Check | Result |\n|---|---|---|\n${rows}\n\n${coverage}\n\n`);
}
process.exit(bad.length ? 1 : 0);
