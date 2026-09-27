// probe.mjs — the HARDENING.md Appendix A access probe, rebuilt so it can be
// re-run after the 0016–0020 migrations. Zero dependencies (Node 18+ fetch).
//
//   node supabase/scripts/probe.mjs
//
// What it does: acts as (1) the anon key with no session and (2) a fresh
// anonymous guest, and tries to read and write every table and call every RPC
// the audit probed. It prints each result next to the result EXPECTED AFTER
// HARDENING, and exits non-zero on any mismatch.
//
// SAFETY RULES — both non-negotiable, kept from the original probe:
//
//   1. OWNERSHIP GATE. It aborts unless every source of the project ref it can
//      find agrees on wjorfdfpbgyykbhxydqj: the URL in .env.local, the `ref`
//      claim inside the anon JWT, and (when present) supabase/.temp/project-ref
//      and linked-project.json. It will not run against anyone else's project.
//
//   2. INVALID-VALUE-ONLY WRITES. Every INSERT carries a deliberately invalid
//      value — a nonexistent foreign-key uuid (…dead) or an out-of-domain tier —
//      so no row can ever persist even where RLS allows the write. Postgres
//      checks privileges and RLS before constraints, so 42501 means "denied" and
//      23503/23514 means "allowed but rejected". UPDATE/DELETE only ever target
//      the nonexistent uuid. The only thing it creates is ONE anonymous auth
//      user (unavoidable for the guest half); it signs that session out and
//      prints the SQL to delete the user. 0019's purge job would also remove it
//      after 30 days, since it owns no rows.
//
// Needs "Allow anonymous sign-ins" on, and CAPTCHA OFF (run it before enabling
// Turnstile in the dashboard, or it stops at sign-in and says so).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REF = "wjorfdfpbgyykbhxydqj";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TAG = `HARDENING-PROBE-${Date.now()}`;
const DEAD = "00000000-0000-0000-0000-00000000dead";

function loadEnv() {
  const txt = readFileSync(join(repoRoot, ".env.local"), "utf8");
  const env = {};
  for (const l of txt.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// ---- 1. ownership gate ------------------------------------------------------
const env = loadEnv();
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const refs = {};
refs.url = URL_?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1] ?? null;
try {
  refs.jwt = JSON.parse(Buffer.from(ANON.split(".")[1], "base64url").toString()).ref ?? null;
} catch {
  refs.jwt = null;
}
const refFile = join(repoRoot, "supabase", ".temp", "project-ref");
if (existsSync(refFile)) refs.temp_project_ref = readFileSync(refFile, "utf8").trim();
const linked = join(repoRoot, "supabase", ".temp", "linked-project.json");
if (existsSync(linked)) refs.linked_project = JSON.parse(readFileSync(linked, "utf8")).ref ?? null;

const bad = Object.entries(refs).filter(([, v]) => v !== EXPECTED_REF);
if (bad.length || !refs.url || !refs.jwt) {
  console.error(`OWNERSHIP GATE FAILED — refusing to probe. Expected every ref to be ${EXPECTED_REF}:`);
  console.error(refs);
  process.exit(2);
}
console.log(`ownership gate: all ${Object.keys(refs).length} refs = ${EXPECTED_REF}\n`);

// ---- helpers ----------------------------------------------------------------
const log = [];
let mismatches = 0;

async function call(id, role, token, method, path, body, expect) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  const res = await fetch(`${URL_}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  const code = parsed?.code ?? null;
  const rows = Array.isArray(parsed) ? parsed.length : null;
  const got = code ? `${res.status} ${code}` : `${res.status}${rows !== null ? ` rows=${rows}` : ""}`;
  const ok = expect(res.status, code, rows, parsed);
  if (!ok) mismatches++;
  log.push({ id, role, method, path, status: res.status, code, rows, ok });
  console.log(`${ok ? "ok  " : "MISM"} ${id.padEnd(12)} ${role.padEnd(5)} ${method.padEnd(6)} ${path.slice(0, 58).padEnd(58)} ${got}`);
  return { status: res.status, code, parsed };
}

const denied = (s, c) => c === "42501" || s === 401;
const okEmpty = (s, c, rows) => s >= 200 && s < 300 && (rows === null || rows === 0);
const okAny = (s) => s >= 200 && s < 300;
const is = (code) => (_s, c) => c === code;

// ---- 2. anon (no session) ----------------------------------------------------
console.log("=== anon (no session) ===");
let n = 1;
for (const t of ["words", "rooms", "room_players", "round_results"]) {
  await call(`P-anon-${n++}`, "anon", ANON, "GET", `/rest/v1/${t}?select=*&limit=1`, null, denied);
}
// #15: was 200 rows=0 before 0020.
await call(`P-anon-${n++}`, "anon", ANON, "GET", "/rest/v1/round_attempts?select=*&limit=1", null, denied);
const anonInserts = [
  ["words", { id: TAG, word: TAG, tier: TAG, definition: TAG }],
  ["rooms", { id: DEAD, code: "ZZPRB9", tier: TAG, host_id: DEAD }],
  ["room_players", { room_id: DEAD, player_id: DEAD, display_name: TAG }],
  ["round_results", { room_id: DEAD, round_num: 1, word_id: TAG }],
  ["round_attempts", { room_id: DEAD, round_num: 1, player_id: DEAD, guess: TAG, is_correct: false, response_time_ms: 0 }],
  ["room_players", { room_id: DEAD, player_id: DEAD, display_name: TAG, score: 9999 }],
  ["rooms", { id: DEAD, code: "ZZPRB8", tier: TAG, host_id: DEAD, status: "active" }],
];
for (const [t, body] of anonInserts) {
  await call(`P-anon-${n++}`, "anon", ANON, "POST", `/rest/v1/${t}`, body, denied);
}
await call(`P-anon-${n++}`, "anon", ANON, "PATCH", `/rest/v1/rooms?id=eq.${DEAD}`, { status: "finished" }, denied);
await call(`P-anon-${n++}`, "anon", ANON, "DELETE", `/rest/v1/words?id=eq.${TAG}`, null, denied);
// #16: the six constants were 200 before 0020.
for (const fn of ["round_seconds", "rounds_per_game", "late_grace_ms", "feedback_ms", "avatar_keys", "decay_params"]) {
  const args = fn === "round_seconds" ? { p_tier: "easy" } : {};
  await call(`P-anon-${n++}`, "anon", ANON, "POST", `/rest/v1/rpc/${fn}`, args, denied);
}
for (const [fn, args] of [["server_now", {}], ["get_room_by_code", { p_code: "ZZPRB9" }], ["is_room_member", { p_room_id: DEAD }]]) {
  await call(`P-anon-${n++}`, "anon", ANON, "POST", `/rest/v1/rpc/${fn}`, args, denied);
}

// ---- 3. anonymous guest --------------------------------------------------------
console.log("\n=== anonymous guest ===");
const signup = await fetch(`${URL_}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ data: {} }),
}).then((r) => r.json());
if (!signup.access_token) {
  console.error("anonymous sign-in failed — is CAPTCHA already on? Run this before enabling it.");
  console.error(signup);
  process.exit(1);
}
const T = signup.access_token;
const UID = signup.user.id;
console.log(`guest ${UID} (is_anonymous: ${signup.user.is_anonymous})`);

n = 1;
await call(`P-auth-${n++}`, "guest", T, "GET", "/rest/v1/words?select=id&limit=3", null, okAny);
for (const t of ["rooms", "room_players", "round_results"]) {
  await call(`P-auth-${n++}`, "guest", T, "GET", `/rest/v1/${t}?select=*&limit=1`, null, okEmpty);
}
// #15: was 200 rows=0 before 0020.
await call(`P-auth-${n++}`, "guest", T, "GET", "/rest/v1/round_attempts?select=*&limit=1", null, denied);
// P-auth-6: own host, invalid tier -> still allowed-but-rejected by the tier CHECK.
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rooms", { id: crypto.randomUUID(), code: "ZZPRB9", tier: TAG, host_id: UID, mode: "race", lives_setting: 3 }, is("23514"));
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rooms", { id: crypto.randomUUID(), code: "ZZPRB8", tier: TAG, host_id: DEAD }, denied);
// P-auth-8, THE finding (#1): was 23503 (RLS allowed a self-set score). Now 42501.
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/room_players", { room_id: DEAD, player_id: UID, display_name: TAG, score: 9999 }, denied);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/room_players", { room_id: DEAD, player_id: DEAD, display_name: TAG }, denied);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/words", { id: TAG, word: TAG, tier: TAG, definition: TAG }, denied);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/round_results", { room_id: DEAD, round_num: 1, word_id: TAG }, denied);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/round_attempts", { room_id: DEAD, round_num: 1, player_id: UID, guess: TAG, is_correct: true, response_time_ms: 1 }, denied);
await call(`P-auth-${n++}`, "guest", T, "PATCH", `/rest/v1/rooms?id=eq.${DEAD}`, { status: "finished" }, denied);
await call(`P-auth-${n++}`, "guest", T, "DELETE", `/rest/v1/words?id=eq.${TAG}`, null, denied);
for (const fn of ["round_seconds", "rounds_per_game", "late_grace_ms", "feedback_ms", "avatar_keys", "decay_params"]) {
  const args = fn === "round_seconds" ? { p_tier: "easy" } : {};
  await call(`P-auth-${n++}`, "guest", T, "POST", `/rest/v1/rpc/${fn}`, args, okAny);
}
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rpc/server_now", {}, okAny);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rpc/get_room_by_code", { p_code: "ZZPRB9" }, okEmpty);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rpc/is_room_member", { p_room_id: DEAD }, okAny);

// New with 0016–0020 (IDs continue past the original 23).
console.log("\n=== new controls ===");
// §A1: a client can no longer set status (or any engine column) on a room.
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rooms", { id: crypto.randomUUID(), code: "ZZPRB7", tier: TAG, host_id: UID, status: "active" }, denied);
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/rooms", { id: crypto.randomUUID(), code: "ZZPRB6", tier: TAG, host_id: UID, created_at: "2999-01-01" }, denied);
// #6: an over-long name is refused by the CHECK before the fake FK is reached.
await call(`P-auth-${n++}`, "guest", T, "POST", "/rest/v1/room_players", { room_id: DEAD, player_id: UID, display_name: "x".repeat(30) }, is("23514"));
// The engine functions stay service_role only.
// Real signatures, so PostgREST resolves the function and the GRANT is what's tested.
for (const [fn, args] of [
  ["start_game_tx", { p_room_id: DEAD, p_caller: UID }],
  ["submit_answer_tx", { p_room_id: DEAD, p_round_num: 1, p_player: UID, p_guess: TAG }],
  ["purge_anonymous_users", {}],
  ["purge_stale_rooms", {}],
]) {
  await call(`P-auth-${n++}`, "guest", T, "POST", `/rest/v1/rpc/${fn}`, args, denied);
}
// The blocklist schema is not exposed at all.
const priv = await fetch(`${URL_}/rest/v1/blocked_name_terms?select=*`, {
  headers: { apikey: ANON, Authorization: `Bearer ${T}`, "Accept-Profile": "private" },
});
const privBody = await priv.json().catch(() => ({}));
const privOk = priv.status >= 400;
if (!privOk) mismatches++;
log.push({ id: `P-auth-${n}`, role: "guest", path: "private.blocked_name_terms", status: priv.status, code: privBody.code, ok: privOk });
console.log(`${privOk ? "ok  " : "MISM"} ${`P-auth-${n++}`.padEnd(12)} guest  GET    private.blocked_name_terms (Accept-Profile)                ${priv.status} ${privBody.code ?? ""}`);

// ---- 4. proof of zero rows, sign-out -------------------------------------------
console.log("\n=== proof: no probe row persisted ===");
await call("P-proof-1", "guest", T, "GET", `/rest/v1/words?id=eq.${TAG}&select=id`, null, okEmpty);
await call("P-proof-2", "guest", T, "GET", `/rest/v1/room_players?display_name=eq.${TAG}&select=room_id`, null, okEmpty);
await call("P-proof-3", "guest", T, "GET", "/rest/v1/rooms?code=in.(ZZPRB9,ZZPRB8,ZZPRB7,ZZPRB6)&select=id", null, okEmpty);

const out = await fetch(`${URL_}/auth/v1/logout`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${T}` } });
console.log(`\nsign-out: ${out.status}`);

const logPath = join(tmpdir(), `${TAG}.json`);
writeFileSync(logPath, JSON.stringify({ tag: TAG, refs, guest: UID, log }, null, 2));
console.log(`log: ${logPath}`);
console.log(`\nTo remove the probe's anonymous user (it owns no rows), in the SQL editor:`);
console.log(`  delete from auth.users where id = '${UID}' and is_anonymous;`);
console.log(`\n${mismatches === 0 ? "ALL AS EXPECTED" : `${mismatches} MISMATCH(ES)`}`);
process.exit(mismatches === 0 ? 0 : 1);
