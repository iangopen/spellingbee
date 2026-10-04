// The font notices are enforced at build time (scripts/licenseNotices.ts). This tests the
// rule against fixtures; the real build is exercised by docs/history.md's demonstration
// (remove a notice, watch `npm run build` fail, restore it).
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fontLicenceProblems } from "../licenseNotices.ts";

const css = `@font-face { font-family: 'Atkinson Hyperlegible'; } @font-face { font-family: "Caveat Brush"; }`;
const ofl = (name) => `Copyright 2020 The ${name} Authors\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.`;
const good = { "OFL-AtkinsonHyperlegible.txt": ofl("Atkinson"), "OFL-CaveatBrush.txt": ofl("Caveat") };
const credits = "| Atkinson Hyperlegible | x |\n| Caveat Brush | y |";

describe("fontLicenceProblems", () => {
  it("is quiet when every declared family has its notice and a credits row", () => {
    expect(fontLicenceProblems(css, good, credits)).toEqual([]);
  });

  it("names a font that has no OFL file (Caveat Brush included)", () => {
    const { "OFL-CaveatBrush.txt": _gone, ...rest } = good;
    const p = fontLicenceProblems(css, rest, credits);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("Caveat Brush");
  });

  it("rejects a notice with no copyright line or no licence text", () => {
    expect(fontLicenceProblems(css, { ...good, "OFL-CaveatBrush.txt": "Open Font License" }, credits).join()).toMatch(/no copyright/);
    expect(fontLicenceProblems(css, { ...good, "OFL-CaveatBrush.txt": "Copyright 2015 X" }, credits).join()).toMatch(/does not contain the SIL Open Font License/);
  });

  it("rejects a font with no row in CREDITS.md", () => {
    expect(fontLicenceProblems(css, good, "| Atkinson Hyperlegible | x |").join()).toMatch(/CREDITS.md has no row for font "Caveat Brush"/);
  });

  it("matches names regardless of spaces and case", () => {
    expect(fontLicenceProblems(`@font-face { font-family: 'bricolage grotesque'; }`, { "OFL-BricolageGrotesque.txt": ofl("B") }, "bricolage grotesque")).toEqual([]);
  });

  it("an empty fonts.css is a problem, not a silent pass", () => {
    expect(fontLicenceProblems("", good, credits).join()).toMatch(/declares no font-family/);
  });
});

describe("the real repository", () => {
  it("passes its own rule: every family in src/fonts.css has a notice and a credit", () => {
    const dir = resolve("src/assets/fonts");
    const files = Object.fromEntries(readdirSync(dir).filter((f) => /^OFL-.*\.txt$/.test(f)).map((f) => [f, readFileSync(resolve(dir, f), "utf8")]));
    expect(fontLicenceProblems(readFileSync(resolve("src/fonts.css"), "utf8"), files, readFileSync(resolve("CREDITS.md"), "utf8"))).toEqual([]);
  });

  it("every font file on disk belongs to a declared family", () => {
    const css2 = readFileSync(resolve("src/fonts.css"), "utf8");
    const urls = [...css2.matchAll(/url\('\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1]).sort();
    const onDisk = readdirSync(resolve("src/assets/fonts")).filter((f) => f.endsWith(".woff2")).sort();
    expect(onDisk).toEqual(urls);
  });
});
