// supabase/scripts/verify_avatar.sql is meant for the LIVE SQL editor. This runs the
// same file against PGlite: it must report 0 FAIL, keep nothing (its ending is an
// error that rolls everything back), and report FAILs when 0021 is weakened.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freshDb, repoRoot } from "./harness.mjs";

const SCRIPT = readFileSync(join(repoRoot, "supabase", "scripts", "verify_avatar.sql"), "utf8");
const MIGRATION = readFileSync(join(repoRoot, "supabase", "migrations", "0021_avatar_parts.sql"), "utf8");

// Supabase's auth.users has these columns; the harness stub has only id/is_anonymous/created_at.
const LIKE_SUPABASE_AUTH = "alter table auth.users add column aud text, add column role text, add column updated_at timestamptz";

async function run(h) {
  try {
    await h.db.exec(SCRIPT);
  } catch (e) {
    return e.message;
  }
  return null;
}
const counts = (h) =>
  h.sql(`select (select count(*) from auth.users)::int as users, (select count(*) from rooms)::int as rooms,
                (select count(*) from room_players)::int as players, (select count(*) from private.room_creations)::int as creations`);

describe("verify_avatar.sql", () => {
  it("reports every check PASS, 0 FAIL, against the real migrations, and keeps nothing", async () => {
    const h = await freshDb();
    try {
      await h.sql(LIKE_SUPABASE_AUTH);
      // some existing rows, written the old way, for the live-data check to read
      const host = await h.user();
      const { id } = await h.room(host);
      for (const key of ["queen", "hive", "clover"]) expect((await h.join(await h.user(), id, "P", key)).error).toBeUndefined();
      const before = await counts(h);
      const msg = await run(h);
      expect(msg).toMatch(/^AVATAR VERIFY: \d+ PASS, 0 FAIL/);
      const pass = Number(msg.match(/(\d+) PASS/)[1]);
      expect(pass).toBeGreaterThanOrEqual(30);
      expect(msg.split("\n").filter((l) => l.startsWith("PASS ")).length).toBe(pass);
      expect(msg).toContain("PASS live rows: every key matches its numbers");
      expect(await counts(h)).toEqual(before);
      // nothing left behind in the session either
      expect(await h.sql("select current_user as u, current_setting('request.jwt.claim.sub', true) as sub")).toEqual([{ u: "postgres", sub: "" }]);
      console.log(msg.split("\n")[0]);
    } finally {
      await h.close();
    }
  });

  it("reports FAILs when the CHECKs are missing, and still keeps nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sb-weak-"));
    const weak = join(dir, "0021.sql");
    writeFileSync(
      weak,
      MIGRATION.replace(/\n\s+constraint room_players_avatar_color_range check \(avatar_color between 0 and 7\),/, ",").replace(
        /\n\s+constraint room_players_avatar_cosmetic_range check \(avatar_cosmetic between 0 and 13\);/,
        ";"
      )
    );
    process.env.SB_MIGRATION_OVERRIDE = `0021_avatar_parts.sql=${weak}`;
    const h = await freshDb();
    delete process.env.SB_MIGRATION_OVERRIDE;
    try {
      await h.sql(LIKE_SUPABASE_AUTH);
      const before = await counts(h);
      const msg = await run(h);
      expect(msg).toMatch(/AVATAR VERIFY: \d+ PASS, [1-9]\d* FAIL/);
      expect(msg).toContain("FAIL range CHECKs 0-7 and 0-13");
      expect(msg).toContain("FAIL refused: insert colour 8");
      expect(await counts(h)).toEqual(before);
    } finally {
      await h.close();
    }
  });

  it("stops cleanly on a database without 0021 (as live is today), changing nothing", async () => {
    const h = await freshDb({ upTo: "0020" });
    try {
      await h.sql(LIKE_SUPABASE_AUTH);
      const before = await counts(h);
      const msg = await run(h);
      expect(msg).not.toBeNull();
      expect(msg).not.toMatch(/0 FAIL/);
      expect(await counts(h)).toEqual(before);
    } finally {
      await h.close();
    }
  });
});
