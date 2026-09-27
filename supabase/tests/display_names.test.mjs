// Hardening #6 — display names are bounded and filtered server-side (0018).
//
// The shipped blocklist is hashes of terms that are deliberately not in the
// repo, so this file exercises the MECHANISM with harmless stand-in terms it
// inserts itself ("badger" as a substring term, "moth" as a token term), hashed
// by the same script a maintainer would use.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./harness.mjs";
import { normalizeTerm, termRow } from "../scripts/hash_name_terms.mjs";

describe("0018 display names", () => {
  let h;
  beforeAll(async () => {
    h = await freshDb();
    await h.sql(
      `insert into private.blocked_name_terms (digest, len, kind) values
       ${termRow("substring", "badger")}, ${termRow("token", "moth")}`
    );
  });
  afterAll(() => h.close());

  // A fresh room per join, so these tests never run into 0019's player cap.
  const freshRoom = async () => (await h.room(await h.user())).id;
  const joinAs = async (name) => h.join(await h.user(), await freshRoom(), name);

  it("the seeded list is non-empty and holds no plain text", async () => {
    const [r] = await h.sql("select count(*)::int as n, bool_and(octet_length(digest) = 32) as all_sha256 from private.blocked_name_terms");
    expect(r.n).toBeGreaterThan(50);
    expect(r.all_sha256).toBe(true);
  });

  it.each(["Alex", "Zoë", "José", "李雷", "Mitchell", "Honey Bee", "Mothra", "Behemoth", "x".repeat(24)])(
    "accepts %s",
    async (name) => expect((await joinAs(name)).error).toBeUndefined()
  );

  it.each([
    ["", "23514"],
    ["   ", "23514"],
    ["x".repeat(25), "23514"],
    ["tab\there", "23514"],
    ["new\nline", "23514"],
  ])("rejects %j by the length/charset CHECK", async (name, code) => {
    const r = await joinAs(name);
    expect(r.error?.code).toBe(code);
    expect(r.error?.message).toMatch(/room_players_display_name_valid/);
  });

  it.each([
    "badger",
    "HoneyBadger",
    "B4DG3R",
    "b.a.d.g.e.r",
    "b a d g e r",
    "ｂａｄｇｅｒ", // full-width
    "bädger",
    "moth",
    "Big Moth",
    "m-o-t-h",
    "M0TH",
  ])("rejects %j by the blocklist trigger", async (name) => {
    const r = await joinAs(name);
    expect(r.error?.code).toBe("P0001");
    expect(r.error?.message).toBe("display_name_not_allowed");
  });

  it("filters UPDATE of display_name too", async () => {
    const u = await h.user();
    await h.join(u, await freshRoom(), "Fine");
    const bad = await h.as(u, "update room_players set display_name = 'Honey Badger' where player_id = $1", [u]);
    expect(bad.error?.message).toBe("display_name_not_allowed");
    const long = await h.as(u, "update room_players set display_name = $2 where player_id = $1", [u, "y".repeat(30)]);
    expect(long.error?.code).toBe("23514");
  });

  it("an avatar change does not run the name filter on the existing name", async () => {
    const u = await h.user();
    await h.join(u, await freshRoom(), "Legacy");
    // A row that predates the filter (written by the owner, bypassing it).
    await h.sql("alter table room_players disable trigger room_players_check_display_name");
    await h.sql("update room_players set display_name = 'badger' where player_id = $1", [u]);
    await h.sql("alter table room_players enable trigger room_players_check_display_name");
    const r = await h.as(u, "update room_players set avatar = 'wasp' where player_id = $1", [u]);
    expect(r.error).toBeUndefined();
  });

  it("no client role can read the blocklist or call the filter", async () => {
    const u = await h.user();
    for (const who of [null, u]) {
      expect((await h.as(who, "select * from private.blocked_name_terms")).error?.code).toBe("42501");
      expect((await h.as(who, "select private.name_is_blocked('x')")).error?.code).toBe("42501");
    }
  });

  it("the JS term normalizer agrees with the SQL one", async () => {
    for (const s of ["Badger", "B4DG3R!", "m.0.t.h", "ab$@|8c", "HELLO world"]) {
      const [r] = await h.sql("select private.name_filter_flat($1) as flat", [s]);
      expect(normalizeTerm(s)).toBe(r.flat);
    }
  });
});
