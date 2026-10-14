import { describe, expect, it } from "vitest";
import { AVATAR_KEYS } from "./avatars";
import {
  AVATAR_COLORS,
  AVATAR_COSMETICS,
  DEFAULT_AVATAR_PARTS,
  coerceAvatarPart,
  coerceAvatarParts,
  describeAvatar,
  keyFromParts,
  partsFromKey,
} from "./avatarParts";

describe("avatar parts data", () => {
  it("has 8 colours and 14 cosmetics (0 = none), the 0021 CHECK ranges", () => {
    expect(AVATAR_COLORS).toHaveLength(8);
    expect(AVATAR_COSMETICS).toHaveLength(14);
    expect(AVATAR_COSMETICS[0]).toEqual({ name: "None", phrase: "" });
  });

  it("pins the order: indices are permanent once stored", () => {
    expect(AVATAR_COLORS).toEqual(["Honey", "Red", "Rose", "Purple", "Blue", "Aqua", "Green", "Grey"]);
    expect(AVATAR_COSMETICS.map((c) => c.name)).toEqual([
      "None", "Crown", "Party hat", "Flower", "Sunglasses", "Headphones", "Bow tie", "Honey pot",
      "Graduation cap", "Pencil", "Reading glasses", "Quill", "Book", "Letter block",
    ]);
  });

  it("has no duplicate names and a phrase for every real cosmetic", () => {
    expect(new Set(AVATAR_COLORS).size).toBe(8);
    expect(new Set(AVATAR_COSMETICS.map((c) => c.name)).size).toBe(14);
    for (const c of AVATAR_COSMETICS.slice(1)) expect(c.phrase).toMatch(/^(wearing|holding) /);
  });

  it("defaults to the plain honey bee, the mascot", () => {
    expect(DEFAULT_AVATAR_PARTS).toEqual({ color: 0, cosmetic: 0 });
    expect(describeAvatar(0, 0)).toBe("Honey bee");
  });
});

describe("describeAvatar", () => {
  it.each([
    [4, 1, "Blue bee wearing a crown"],
    [7, 9, "Grey bee holding a pencil"],
    [2, 4, "Rose bee wearing sunglasses"],
    [5, 13, "Aqua bee holding a letter block"],
    [1, 0, "Red bee"],
  ])("(%i, %i) -> %s", (color, cosmetic, text) => {
    expect(describeAvatar(color, cosmetic)).toBe(text);
  });

  it("is distinct for all 112 pairs", () => {
    const all = new Set<string>();
    for (let c = 0; c < 8; c++) for (let k = 0; k < 14; k++) all.add(describeAvatar(c, k));
    expect(all.size).toBe(112);
  });

  it("reads anything out of range as 0 instead of throwing", () => {
    expect(describeAvatar(8, 14)).toBe("Honey bee");
    expect(describeAvatar(-1, 2.5)).toBe("Honey bee");
  });
});

describe("coerceAvatarPart", () => {
  it.each([
    [3, 8, 3], [0, 8, 0], [7, 8, 7], [8, 8, 0], [-1, 8, 0], [2.5, 8, 0], [32767, 14, 0],
    [null, 8, 0], [undefined, 8, 0], ["5", 14, 5], ["", 8, 0], ["blue", 8, 0], [Number.NaN, 8, 0],
  ])("coerceAvatarPart(%j, %i) -> %i", (value, count, out) => {
    expect(coerceAvatarPart(value, count)).toBe(out);
  });

  it("coerces both parts against their own list lengths", () => {
    expect(coerceAvatarParts(7, 13)).toEqual({ color: 7, cosmetic: 13 });
    expect(coerceAvatarParts(8, 13)).toEqual({ color: 0, cosmetic: 13 });
    expect(coerceAvatarParts(7, 14)).toEqual({ color: 7, cosmetic: 0 });
  });
});

describe("legacy key mapping", () => {
  it("round-trips all 8 old keys", () => {
    for (const key of AVATAR_KEYS) {
      const p = partsFromKey(key);
      expect(keyFromParts(p.color, p.cosmetic), key).toBe(key);
    }
  });

  it("gives each old key its own bee", () => {
    const pairs = AVATAR_KEYS.map((k) => JSON.stringify(partsFromKey(k)));
    expect(new Set(pairs).size).toBe(8);
  });

  it("maps the old keys as the spec proposes", () => {
    expect(Object.fromEntries(AVATAR_KEYS.map((k) => [k, describeAvatar(partsFromKey(k).color, partsFromKey(k).cosmetic)]))).toEqual({
      bee: "Honey bee",
      queen: "Honey bee wearing a crown",
      drone: "Blue bee wearing headphones",
      hive: "Grey bee holding a honey pot",
      honey: "Honey bee holding a honey pot",
      blossom: "Rose bee wearing a flower",
      clover: "Green bee wearing a flower",
      wasp: "Grey bee",
    });
  });

  it("returns a valid old key for every pair, and reads unknown input safely", () => {
    for (let c = 0; c < 8; c++) for (let k = 0; k < 14; k++) expect(AVATAR_KEYS).toContain(keyFromParts(c, k));
    expect(partsFromKey("unicorn")).toEqual({ color: 0, cosmetic: 0 });
    expect(partsFromKey(null)).toEqual({ color: 0, cosmetic: 0 });
    expect(keyFromParts(99, -3)).toBe("bee");
  });

  it("returns a copy, so a caller can't corrupt the table", () => {
    const p = partsFromKey("drone");
    p.color = 0;
    expect(partsFromKey("drone")).toEqual({ color: 4, cosmetic: 5 });
  });
});
