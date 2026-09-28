// @vitest-environment jsdom
//
// Utterance sequencing in tts.ts, against a fake speechSynthesis whose
// speaking/pending state the test controls. The live bug this guards: every
// announcement called cancel() and then speak() in the same tick, even with
// nothing playing, and Chrome clipped the start of the lead-in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeUtterance {
  text: string;
  onend: (() => void) | null;
  rate: number;
  volume: number;
  voice: unknown;
  lang: string;
}

function installFakeSpeech() {
  const log: string[] = [];
  const spoken: FakeUtterance[] = [];
  const ss = {
    speaking: false,
    pending: false,
    getVoices: () => [{ name: "Google UK English Male", lang: "en-GB", localService: false, default: false }],
    addEventListener: () => {},
    removeEventListener: () => {},
    speak: (u: FakeUtterance) => {
      log.push(`speak:${u.text}`);
      spoken.push(u);
    },
    cancel: () => {
      log.push("cancel");
    },
  };
  class Utterance implements FakeUtterance {
    onend: (() => void) | null = null;
    rate = 1;
    volume = 1;
    voice: unknown = null;
    lang = "";
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { ss, log, spoken };
}

async function loadTts() {
  vi.resetModules(); // tts.ts keeps module-level state (voice cache, generation)
  return import("./tts");
}

/** Let loadVoices() resolve and any settle timer fire. */
async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

let fake: ReturnType<typeof installFakeSpeech>;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fake = installFakeSpeech();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("announceWord sequencing", () => {
  it("does NOT cancel when nothing is playing, and speaks the lead-in at once", async () => {
    const { announceWord } = await loadTts();
    const leadIn = announceWord("rhythm");
    await flush();
    expect(fake.log).toEqual([`speak:${leadIn}`]);
  });

  it("speaks the word only after the lead-in ends, in that order", async () => {
    const { announceWord } = await loadTts();
    const leadIn = announceWord("rhythm");
    await flush();
    fake.spoken[0].onend?.();
    expect(fake.log).toEqual([`speak:${leadIn}`, "speak:rhythm"]);
  });

  it("when something IS playing: cancel, wait for it to settle, then speak", async () => {
    const { announceWord, CANCEL_SETTLE_MS } = await loadTts();
    fake.ss.speaking = true;
    const leadIn = announceWord("rhythm");
    await flush();
    expect(fake.log).toEqual(["cancel"]); // nothing spoken in the same tick
    fake.ss.speaking = false;
    await flush(CANCEL_SETTLE_MS);
    expect(fake.log).toEqual(["cancel", `speak:${leadIn}`]);
  });

  it("a superseded announcement never speaks — not its lead-in, not its word", async () => {
    const { announceWord, CANCEL_SETTLE_MS } = await loadTts();
    fake.ss.speaking = true;
    announceWord("first");
    await flush(); // first is waiting out its settle delay
    const second = announceWord("second");
    await flush(CANCEL_SETTLE_MS + 5000); // past every settle and fallback timer
    const spokenTexts = fake.log.filter((l) => l.startsWith("speak:"));
    expect(spokenTexts).toEqual([`speak:${second}`, "speak:second"]); // fallback spoke the word
    expect(fake.log.some((l) => l === "speak:first")).toBe(false);
  });

  it("speaks the word from the fallback timer if the lead-in's end event never fires", async () => {
    const { announceWord } = await loadTts();
    announceWord("rhythm");
    await flush(10_000);
    expect(fake.log.at(-1)).toBe("speak:rhythm");
  });

  it("speaks each utterance exactly once even if onend also fires after the fallback", async () => {
    const { announceWord } = await loadTts();
    announceWord("rhythm");
    await flush(10_000);
    fake.spoken[0].onend?.();
    expect(fake.log.filter((l) => l === "speak:rhythm")).toHaveLength(1);
  });

  it("stopSpeaking cancels a lead-in's pending word", async () => {
    const { announceWord, stopSpeaking } = await loadTts();
    announceWord("rhythm");
    await flush();
    stopSpeaking();
    fake.spoken[0].onend?.();
    await flush(10_000);
    expect(fake.log.includes("speak:rhythm")).toBe(false);
  });
});

describe("repeatWord", () => {
  it("speaks only the word, with no cancel when idle", async () => {
    const { repeatWord } = await loadTts();
    repeatWord("rhythm");
    await flush();
    expect(fake.log).toEqual(["speak:rhythm"]);
  });

  it("replaces an announcement in progress: cancel, settle, then just the word", async () => {
    const { announceWord, repeatWord, CANCEL_SETTLE_MS } = await loadTts();
    announceWord("rhythm");
    await flush();
    fake.ss.speaking = true; // the lead-in is playing
    repeatWord("rhythm");
    await flush();
    fake.ss.speaking = false;
    fake.spoken[0].onend?.(); // the cancelled lead-in's end must not chain the word
    await flush(CANCEL_SETTLE_MS + 10_000);
    const speaks = fake.log.filter((l) => l.startsWith("speak:"));
    expect(speaks.slice(1)).toEqual(["speak:rhythm"]);
  });
});
