// supabase/rollback/0021_down.sql restores a database that ran 0021 to exactly what
// 0001-0020 produce: the catalog (columns and their grants, constraints, triggers,
// functions and their ACLs, policies, ...) compared section by section.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshot } from "./catalog.mjs";
import { freshDb, migrationSql, repoRoot } from "./harness.mjs";

const ROLLBACK = readFileSync(join(repoRoot, "supabase", "rollback", "0021_down.sql"), "utf8");

describe("rollback 0021_down.sql", () => {
  let at20, rolled, full;
  beforeAll(async () => {
    at20 = await freshDb({ upTo: "0020" });
    full = await freshDb();
    rolled = await freshDb();
    await rolled.db.exec(ROLLBACK);
  });
  afterAll(async () => {
    await at20.close();
    await rolled.close();
    await full.close();
  });

  it("is not in supabase/migrations, so db push can never run it", () => {
    expect(ROLLBACK).toMatch(/^-- 0021_down\.sql/);
  });

  it("0021 really changes the catalog (so the comparison below means something)", async () => {
    const [a, b] = [await snapshot(at20), await snapshot(full)];
    expect(b.columns).not.toEqual(a.columns);
    expect(b.triggers).not.toEqual(a.triggers);
    expect(b.fns).not.toEqual(a.fns);
    expect(b.constraints).not.toEqual(a.constraints);
  });

  it("restores the schema and grants to exactly what 0001-0020 produce", async () => {
    const [a, b] = [await snapshot(at20), await snapshot(rolled)];
    for (const k of Object.keys(a)) expect(b[k], k).toEqual(a[k]);
  });

  it("brings back the old behaviour: the new columns are gone, the old key path works", async () => {
    const host = await rolled.user();
    const { id } = await rolled.room(host);
    const u = await rolled.user();
    expect((await rolled.as(u, "insert into room_players (room_id, player_id, display_name, avatar_color) values ($1,$2,'x',1)", [id, u])).error?.code).toBe("42703");
    expect((await rolled.join(u, id, "Guest", "drone")).error).toBeUndefined();
    expect((await rolled.as(u, "update room_players set avatar = 'wasp' where player_id = $1", [u])).error).toBeUndefined();
  });

  it("keeps every player's key when rows exist (the data path), and 0021 re-applies cleanly afterwards", async () => {
    const h = await freshDb();
    try {
      const host = await h.user();
      const { id } = await h.room(host);
      const u = await h.user();
      await h.as(u, "insert into room_players (room_id, player_id, display_name, avatar_color, avatar_cosmetic) values ($1,$2,'x',4,5)", [id, u]);
      const before = await h.sql("select player_id, avatar from room_players order by 1");
      expect(before.map((r) => r.avatar).sort()).toEqual(["bee", "drone"]);
      await h.db.exec(ROLLBACK);
      expect(await h.sql("select player_id, avatar from room_players order by 1")).toEqual(before);
      await h.db.exec(migrationSql("0021_avatar_parts.sql"));
      expect(await snapshot(h)).toEqual(await snapshot(full));
      expect(await h.sql("select avatar, avatar_color, avatar_cosmetic from room_players where player_id = $1", [u])).toEqual([
        { avatar: "drone", avatar_color: 4, avatar_cosmetic: 5 },
      ]);
    } finally {
      await h.close();
    }
  });
});
