// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AVATAR_KEYS } from "../../lib/avatars";
import { avatarSvg, rosetteSvg } from "../../lib/beeArt";
import { AnswerField } from "./AnswerField";
import { AvatarArt, BeeMascot, Rosette } from "./Art";
import { Button } from "./Button";
import { Panel, Placard, Sticker } from "./Panel";
import { Select, TextInput } from "./TextInput";

afterEach(cleanup);

describe("AVATAR_KEYS", () => {
  // The database CHECK (public.avatar_keys(), migration 0012) validates this
  // exact list; verify_elimination_client.mjs asserts it against the live DB.
  it("is still the eight keys, in order", () => {
    expect([...AVATAR_KEYS]).toEqual(["bee", "queen", "drone", "hive", "honey", "blossom", "clover", "wasp"]);
  });
});

describe("bee art", () => {
  it("draws every avatar, the same way every time", () => {
    for (const k of AVATAR_KEYS) {
      expect(avatarSvg(k)).toContain("<svg");
      expect(avatarSvg(k)).toBe(avatarSvg(k));
    }
    expect(new Set(AVATAR_KEYS.map(avatarSvg)).size).toBe(AVATAR_KEYS.length);
    expect(rosetteSvg()).toContain("var(--mark-2)");
  });

  it("uses tokens only: no hex literal in any drawing", () => {
    for (const svg of [...AVATAR_KEYS.map(avatarSvg), rosetteSvg()]) expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!\))/);
  });

  it("is decoration: aria-hidden, nothing focusable", () => {
    const { container } = render(<><AvatarArt avatar="queen" /><BeeMascot /><Rosette /></>);
    for (const el of container.querySelectorAll(".art")) expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("a, button, input, [tabindex]").length).toBe(0);
  });

  it("gives two copies on one page different clip ids", () => {
    const { container } = render(<><AvatarArt avatar="bee" /><AvatarArt avatar="bee" /></>);
    const ids = [...container.querySelectorAll("clipPath")].map((c) => c.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
    for (const c of container.querySelectorAll("[clip-path]")) {
      expect(ids).toContain(c.getAttribute("clip-path")!.slice(5, -1));
    }
  });
});

describe("Button", () => {
  it("is a real, type=button button with its variant class", () => {
    render(<Button variant="primary">Go</Button>);
    const b = screen.getByRole("button", { name: "Go" });
    expect(b.getAttribute("type")).toBe("button");
    expect(b.className).toContain("btn-primary");
  });

  it("passes disabled and ref through", () => {
    let node: HTMLButtonElement | null = null;
    render(<Button disabled ref={(n) => { node = n; }}>Go</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(node).not.toBeNull();
  });
});

describe("AnswerField", () => {
  it("keeps readOnly (not disabled) so focus survives, and its icons are decoration", () => {
    const { container } = render(<AnswerField state="correct" readOnly aria-disabled placeholder="Type" />);
    const input = screen.getByPlaceholderText("Type") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(input.className).toContain("correct");
    for (const i of container.querySelectorAll(".outcome-icon")) expect(i.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks the wrapper with the outcome so the icon can show", () => {
    const { container } = render(<AnswerField state="incorrect" />);
    expect(container.querySelector(".field-wrap")!.className).toContain("is-incorrect");
  });
});

describe("Panel, Sticker, Placard, fields", () => {
  it("renders content on a panel, and the sticker is hidden from assistive tech", () => {
    const { container } = render(<Panel as="section"><p>hello</p><Sticker>Race over</Sticker></Panel>);
    expect(container.querySelector("section.panel")).not.toBeNull();
    expect(container.querySelector(".sticker")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows a placard's number and label", () => {
    render(<Placard value={4} label="of 10 words" />);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("of 10 words")).toBeTruthy();
  });

  it("gives inputs and selects the one field look", () => {
    render(<><TextInput aria-label="name" /><Select aria-label="tier"><option>a</option></Select></>);
    expect(screen.getByLabelText("name").className).toContain("text-input");
    expect(screen.getByLabelText("tier").className).toContain("text-input");
  });
});
