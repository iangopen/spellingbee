// supabase/rollback/0016-0020_down.sql restores a database that ran 0016–0020 to
// exactly what 0001–0015 produce: compared catalog-wide against a fresh 0015.
// It undoes 0016–0020 only, so every database here stops at 0020; 0021 has its
// own rollback (avatar_parts_rollback.test.mjs), run first when undoing both.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, repoRoot } from "./harness.mjs";
import { snapshot } from "./catalog.mjs";

const ROLLBACK = readFileSync(join(repoRoot, "supabase", "rollback", "0016-0020_down.sql"), "utf8");

describe("rollback 0016-0020_down.sql", () => {
  let at15, rolled, full;
  beforeAll(async () => {
    at15 = await freshDb({ upTo: "0015" });
    full = await freshDb({ upTo: "0020" });
    rolled = await freshDb({ upTo: "0020" });
    await rolled.db.exec(ROLLBACK);
  });
  afterAll(async () => {
    await at15.close();
    await rolled.close();
    await full.close();
  });

  it("is not in supabase/migrations, so db push can never run it", () => {
    expect(ROLLBACK).toMatch(/^-- 0016-0020_down\.sql/);
  });

  it("the full chain really differs from 0015 (so the comparison below means something)", async () => {
    expect(await snapshot(full)).not.toEqual(await snapshot(at15));
  });

  it("restores the catalog to exactly what 0001–0015 produce", async () => {
    const [a, b] = [await snapshot(at15), await snapshot(rolled)];
    // Section by section, so a failure names what differs.
    for (const k of Object.keys(a)) expect(b[k], k).toEqual(a[k]);
  });

  it("brings back the original behaviour, including finding #1 (proving it really rolled back)", async () => {
    const u = await rolled.user();
    const r = await rolled.as(
      u,
      "insert into room_players (room_id, player_id, display_name, score) values ('00000000-0000-0000-0000-00000000dead', $1, 'x', 9999)",
      [u]
    );
    expect(r.error?.code).toBe("23503"); // P-auth-8's pre-hardening result
    expect((await rolled.as(null, "select * from round_attempts")).error).toBeUndefined(); // P-anon-5: 200, 0 rows
  });

  it("the whole chain can be re-applied after a rollback", async () => {
    const h = await freshDb({ upTo: "0020" });
    await h.db.exec(ROLLBACK);
    for (const f of ["0016_score_integrity", "0017_room_insert_columns", "0018_display_names", "0019_abuse_limits_retention", "0020_grant_cleanup"]) {
      await h.db.exec(readFileSync(join(repoRoot, "supabase", "migrations", `${f}.sql`), "utf8"));
    }
    expect(await snapshot(h)).toEqual(await snapshot(full));
    await h.close();
  });
});
