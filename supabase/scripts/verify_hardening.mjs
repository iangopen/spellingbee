// verify_hardening.mjs — the 0016–0020 hardening, against the LIVE project,
// through the same HTTP paths a browser uses. Zero dependencies.
//
//   node supabase/scripts/verify_hardening.mjs
//   VERIFY_BLOCKED_NAME=<a term you know is on the list> node supabase/scripts/verify_hardening.mjs
//
// Everything here was first proven locally against the real migrations
// (npm run test:db). This script confirms the deployed database behaves the
// same, for the checks that need real rows. Run AFTER `supabase db push` and
// BEFORE enabling CAPTCHA (it signs up three anonymous users).
//
// Same ownership gate as probe.mjs. Unlike the probe it DOES create rows — one
// short race game and two lobbies — because "a legitimate join still works" and
// "race start zeroes scores" can't be shown with invalid values. It cleans up
// what a client can: the lobbies are deleted by leaving them (0019's empty-lobby
// trigger). The race room finishes on its own via the 0009 sweeper and is purged
// with its users after 30 days by 0019's jobs.
//
// Not checked here (proven locally, or needs service_role / SQL): the player
// cap (needs 9 users), the hourly room cap (20 rooms), the retention jobs, and
// concurrency of the advisory locks. See CLAUDE.md → Security for SQL to check
// the cron jobs.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REF = "wjorfdfpbgyykbhxydqj";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnv() {
  const txt = readFileSync(join(repoRoot, ".env.local"), "utf8");
  const env = {};
  for (const l of txt.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
{
  const refs = [URL_?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1]];
  try { refs.push(JSON.parse(Buffer.from(ANON.split(".")[1], "base64url").toString()).ref); } catch { refs.push(null); }
  const rf = join(repoRoot, "supabase", ".temp", "project-ref");
  if (existsSync(rf)) refs.push(readFileSync(rf, "utf8").trim());
  if (refs.some((r) => r !== EXPECTED_REF)) {
    console.error(`OWNERSHIP GATE FAILED (${JSON.stringify(refs)}); expected ${EXPECTED_REF}.`);
    process.exit(2);
  }
}

let failures = 0;
const line = (s = "") => console.log(s);
function expect(label, cond, detail = "") {
  if (cond) line(`   PASS  ${label}`);
  else { failures++; line(`   FAIL  ${label}  ${detail}`); }
}

async function signUp() {
  const r = await fetch(`${URL_}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} }),
  }).then((x) => x.json());
  if (!r.access_token) {
    console.error("anonymous sign-in failed — CAPTCHA on, or the per-IP sign-up limit hit?", r);
    process.exit(1);
  }
  return { id: r.user.id, token: r.access_token };
}

async function rest(user, path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user ? user.token : ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, code: body?.code ?? null, message: body?.message ?? null, body };
}

async function edge(user, name, body) {
  const res = await fetch(`${URL_}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

async function createRoom(host, tier = "easy") {
  const id = crypto.randomUUID();
  const code = randCode();
  const r = await rest(host, "rooms", {
    method: "POST",
    body: JSON.stringify({ id, code, tier, host_id: host.id, mode: "race", lives_setting: 3 }),
  });
  if (r.status >= 400) return { error: r };
  const j = await rest(host, "room_players", {
    method: "POST",
    body: JSON.stringify({ room_id: id, player_id: host.id, display_name: "Host", avatar: "bee" }),
  });
  return j.status >= 400 ? { error: j } : { id, code };
}

const host = await signUp();
const guest = await signUp();
const late = await signUp();

line("=== 1. score integrity (0016) ===");
const game = await createRoom(host);
expect("host creates and joins a room with the client's exact columns", !game.error, JSON.stringify(game.error));

const forged = await rest(guest, "room_players", {
  method: "POST",
  body: JSON.stringify({ room_id: game.id, player_id: guest.id, display_name: "Guest", score: 50 }),
});
expect("a client-set score on join is REJECTED (42501)", forged.code === "42501", `${forged.status} ${forged.code}`);

const joined = await rest(guest, "room_players", {
  method: "POST",
  body: JSON.stringify({ room_id: game.id, player_id: guest.id, display_name: "Guest", avatar: "queen" }),
});
expect("a normal join still works", joined.status === 201, `${joined.status} ${joined.code}`);

const patched = await rest(guest, `room_players?room_id=eq.${game.id}&player_id=eq.${guest.id}`, {
  method: "PATCH",
  body: JSON.stringify({ score: 999 }),
});
expect("score can't be changed by a client UPDATE (42501)", patched.code === "42501", `${patched.status} ${patched.code}`);

line("\n=== 2. names (0018) ===");
const longName = await rest(guest, `room_players?room_id=eq.${game.id}&player_id=eq.${guest.id}`, {
  method: "PATCH",
  body: JSON.stringify({ display_name: "x".repeat(30) }),
});
expect("a 30-character name is rejected on UPDATE (23514)", longName.code === "23514", `${longName.status} ${longName.code}`);

const blankJoin = await rest(late, "room_players", {
  method: "POST",
  body: JSON.stringify({ room_id: game.id, player_id: late.id, display_name: "   " }),
});
expect("a blank name is rejected on INSERT (23514)", blankJoin.code === "23514", `${blankJoin.status} ${blankJoin.code}`);

if (env.VERIFY_BLOCKED_NAME || process.env.VERIFY_BLOCKED_NAME) {
  const term = process.env.VERIFY_BLOCKED_NAME ?? env.VERIFY_BLOCKED_NAME;
  const blocked = await rest(guest, `room_players?room_id=eq.${game.id}&player_id=eq.${guest.id}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: `xx ${term} yy` }),
  });
  expect("a blocklisted name is rejected (display_name_not_allowed)", blocked.message === "display_name_not_allowed", `${blocked.status} ${blocked.message}`);
} else {
  line("   SKIP  blocklisted name (set VERIFY_BLOCKED_NAME to a term on the list)");
}

line("\n=== 3. race start zeroes scores; no mid-game join (0016) ===");
const started = await edge(host, "start-game", { room_id: game.id });
expect("start-game succeeds", started.status === 200 && started.body?.ok === true, JSON.stringify(started.body));
const roster = await rest(host, `room_players?room_id=eq.${game.id}&select=score,streak`);
expect(
  "every player starts the race at score 0, streak 0",
  Array.isArray(roster.body) && roster.body.length === 2 && roster.body.every((p) => p.score === 0 && p.streak === 0),
  JSON.stringify(roster.body)
);
const midJoin = await rest(late, "room_players", {
  method: "POST",
  body: JSON.stringify({ room_id: game.id, player_id: late.id, display_name: "Late" }),
});
expect("joining a started RACE room is refused (42501)", midJoin.code === "42501", `${midJoin.status} ${midJoin.code}`);

line("\n=== 4. room column lock (0017) ===");
const withStatus = await rest(late, "rooms", {
  method: "POST",
  body: JSON.stringify({ id: crypto.randomUUID(), code: randCode(), tier: "easy", host_id: late.id, status: "active" }),
});
expect("a client can't set rooms.status (42501)", withStatus.code === "42501", `${withStatus.status} ${withStatus.code}`);
const withDate = await rest(late, "rooms", {
  method: "POST",
  body: JSON.stringify({ id: crypto.randomUUID(), code: randCode(), tier: "easy", host_id: late.id, created_at: "2999-01-01" }),
});
expect("a client can't set rooms.created_at (42501)", withDate.code === "42501", `${withDate.status} ${withDate.code}`);

line("\n=== 5. open-room cap + empty-lobby cleanup (0019) ===");
// The host already has one ACTIVE room (the game above), which counts as open.
const l1 = await createRoom(host, "novice");
const l2 = await createRoom(host, "novice");
expect("rooms 2 and 3 are allowed", !l1.error && !l2.error, JSON.stringify(l1.error ?? l2.error));
const l3 = await createRoom(host, "novice");
expect("a 4th open room is refused (too_many_open_rooms)", l3.error?.message === "too_many_open_rooms", JSON.stringify(l3.error));

for (const l of [l1, l2]) {
  if (l.error) continue;
  await rest(host, `room_players?room_id=eq.${l.id}&player_id=eq.${host.id}`, { method: "DELETE" });
}
const after = await Promise.all(
  [l1, l2].filter((l) => !l.error).map((l) =>
    rest(late, "rpc/get_room_by_code", { method: "POST", body: JSON.stringify({ p_code: l.code }) })
  )
);
expect(
  "leaving an otherwise-empty lobby deletes it",
  after.every((r) => Array.isArray(r.body) && r.body.length === 0),
  JSON.stringify(after.map((r) => r.body))
);

line("\n=== 6. grants (0020) ===");
const anonAttempts = await rest(null, "round_attempts?select=*&limit=1");
const guestAttempts = await rest(guest, "round_attempts?select=*&limit=1");
expect("anon can't read round_attempts (42501)", anonAttempts.code === "42501", `${anonAttempts.status} ${anonAttempts.code}`);
expect("a guest can't read round_attempts (42501)", guestAttempts.code === "42501", `${guestAttempts.status} ${guestAttempts.code}`);
const anonConst = await rest(null, "rpc/round_seconds", { method: "POST", body: JSON.stringify({ p_tier: "easy" }) });
const guestConst = await rest(guest, "rpc/round_seconds", { method: "POST", body: JSON.stringify({ p_tier: "easy" }) });
expect("anon can't call round_seconds (42501)", anonConst.code === "42501", `${anonConst.status} ${anonConst.code}`);
expect("a signed-in guest still can (the multiplayer client needs it)", guestConst.body === 20, JSON.stringify(guestConst.body));

line(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
line(`(the race room ${game.id} finishes on its own via the sweeper)`);
process.exit(failures === 0 ? 0 : 1);
