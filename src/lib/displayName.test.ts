import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX, validateDisplayName } from "./displayName";
import { friendlyRoomError } from "./roomErrors";

describe("validateDisplayName", () => {
  it("trims and accepts an ordinary name", () => {
    expect(validateDisplayName("  Alex  ")).toEqual({ ok: true, name: "Alex" });
  });

  it("rejects empty and whitespace-only names", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, problem: "empty" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, problem: "empty" });
  });

  it("allows exactly the server's maximum and rejects one more", () => {
    expect(validateDisplayName("x".repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
    expect(validateDisplayName("x".repeat(DISPLAY_NAME_MAX + 1))).toEqual({ ok: false, problem: "too_long" });
  });

  it("counts code points like Postgres char_length, not UTF-16 units", () => {
    // 24 emoji = 48 UTF-16 units but 24 code points: the server accepts it.
    expect(validateDisplayName("🐝".repeat(24)).ok).toBe(true);
    expect(validateDisplayName("🐝".repeat(25)).ok).toBe(false);
  });

  it("rejects control characters", () => {
    expect(validateDisplayName("a\tb")).toEqual({ ok: false, problem: "invalid_chars" });
    expect(validateDisplayName("a\u0000b")).toEqual({ ok: false, problem: "invalid_chars" });
  });

  it("accepts accented and non-Latin names", () => {
    expect(validateDisplayName("Zoë").ok).toBe(true);
    expect(validateDisplayName("李雷").ok).toBe(true);
  });
});

describe("friendlyRoomError — names", () => {
  it("words the blocklist rejection", () => {
    expect(friendlyRoomError({ code: "P0001", message: "display_name_not_allowed" })).toBe(
      "That name isn't allowed. Try another."
    );
  });

  it("words the length CHECK", () => {
    expect(
      friendlyRoomError({
        code: "23514",
        message: 'new row for relation "room_players" violates check constraint "room_players_display_name_valid"',
      })
    ).toMatch(/at most 24 characters/);
  });

  it("passes unknown errors through unchanged", () => {
    expect(friendlyRoomError(new Error("No open room with that code."))).toBe("No open room with that code.");
    expect(friendlyRoomError("plain")).toBe("plain");
  });
});

describe("friendlyRoomError — 0019 limits", () => {
  it.each([
    ["room_full", /full \(max 8 players\)/],
    ["too_many_open_rooms", /maximum number of open rooms/],
    ["room_create_rate_limited", /Try again in a little while/],
  ])("words %s", (code, text) => {
    expect(friendlyRoomError({ code: "P0001", message: code })).toMatch(text);
  });
});
