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
  onstart: (() => void) | null;
  rate: number;
  volume: number;
  voice: unknown;
  lang: string;
}

const UK_MALE = { name: "Google UK English Male", lang: "en-GB", localService: false, default: false };

// `starts`: whether speak() fires the utterance's start event, as a working
// engine does. false models a phone engine that drops it silently.
function installFakeSpeech({ starts = true } = {}) {
  const log: string[] = [];
  const spoken: FakeUtterance[] = [];
  const ss = {
    speaking: false,
    pending: false,
    paused: false,
    starts,
    voiceList: [UK_MALE] as unknown[],
    getVoices: () => ss.voiceList,
    addEventListener: () => {},
    removeEventListener: () => {},
    speak: (u: FakeUtterance) => {
      log.push(`speak:${u.text}`);
      spoken.push(u);
      if (ss.starts) u.onstart?.();
    },
    cancel: () => {
      log.push("cancel");
    },
    resume: () => {
      log.push("resume");
    },
  };
  class Utterance implements FakeUtterance {
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
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

describe("unlockSpeech (iOS: the first speak() must be inside the tap)", () => {
  it("speaks one silent utterance synchronously, in the same tick as the tap", async () => {
    const { unlockSpeech } = await loadTts();
    unlockSpeech();
    // No await, no timer: still inside the gesture.
    expect(fake.log).toEqual(["speak:"]);
    expect(fake.spoken[0].volume).toBe(0);
  });

  it("unlocks once per page; a second start doesn't queue another", async () => {
    const { unlockSpeech } = await loadTts();
    unlockSpeech();
    unlockSpeech();
    expect(fake.log).toEqual(["speak:"]);
  });

  it("the first word waits for the unlock to end instead of cancelling it", async () => {
    const { unlockSpeech, announceWord } = await loadTts();
    unlockSpeech();
    fake.ss.speaking = true; // the silent utterance is playing
    const leadIn = announceWord("rhythm");
    await flush(300);
    expect(fake.log).toEqual(["speak:"]); // waiting, no cancel
    fake.ss.speaking = false;
    fake.spoken[0].onend?.(); // the unlock ends
    await flush(50);
    fake.spoken[1].onend?.();
    expect(fake.log).toEqual(["speak:", `speak:${leadIn}`, "speak:rhythm"]);
  });

  it("an unlock that never ends delays the first word by at most UNLOCK_WAIT_MS, then the usual path runs", async () => {
    const { unlockSpeech, announceWord, UNLOCK_WAIT_MS, CANCEL_SETTLE_MS } = await loadTts();
    unlockSpeech();
    fake.ss.speaking = true;
    const leadIn = announceWord("rhythm");
    await flush(UNLOCK_WAIT_MS - 100);
    expect(fake.log).toEqual(["speak:"]);
    await flush(100);
    expect(fake.log).toEqual(["speak:", "cancel"]); // still speaking: cancel, settle
    fake.ss.speaking = false;
    await flush(CANCEL_SETTLE_MS);
    expect(fake.log).toEqual(["speak:", "cancel", `speak:${leadIn}`]);
    // ...and a later word doesn't wait again.
    fake.spoken[1].onend?.();
    announceWord("garden");
    await flush();
    expect(fake.log.at(-1)).toMatch(/^speak:/);
    expect(fake.log.at(-1)).not.toBe("speak:rhythm");
  });
});

describe("retry when an utterance never starts", () => {
  it("retries a dropped lead-in once after START_TIMEOUT_MS: cancel, settle, speak again", async () => {
    const { announceWord, START_TIMEOUT_MS, CANCEL_SETTLE_MS } = await loadTts();
    fake.ss.starts = false;
    const leadIn = announceWord("rhythm");
    await flush();
    expect(fake.log).toEqual([`speak:${leadIn}`]);
    await flush(START_TIMEOUT_MS - 1);
    expect(fake.log).toEqual([`speak:${leadIn}`]); // not early
    await flush(1 + CANCEL_SETTLE_MS);
    expect(fake.log).toEqual([`speak:${leadIn}`, "cancel", `speak:${leadIn}`]);
  });

  it("retries only once, however long it stays silent", async () => {
    const { repeatWord } = await loadTts();
    fake.ss.starts = false;
    repeatWord("rhythm");
    await flush(20_000);
    expect(fake.log).toEqual(["speak:rhythm", "cancel", "speak:rhythm"]);
  });

  it("the retried lead-in's end chains the word; the dropped original's end does not", async () => {
    const { announceWord, START_TIMEOUT_MS, CANCEL_SETTLE_MS } = await loadTts();
    fake.ss.starts = false;
    const leadIn = announceWord("rhythm");
    await flush(START_TIMEOUT_MS + CANCEL_SETTLE_MS);
    fake.spoken[0].onend?.(); // the dropped original
    expect(fake.log.includes("speak:rhythm")).toBe(false);
    fake.spoken[1].onend?.(); // the retry
    expect(fake.log).toEqual([`speak:${leadIn}`, "cancel", `speak:${leadIn}`, "speak:rhythm"]);
  });

  it("never retries an utterance that started", async () => {
    const { repeatWord } = await loadTts();
    repeatWord("rhythm");
    await flush(20_000);
    expect(fake.log).toEqual(["speak:rhythm"]);
  });

  it("never retries while the engine reports speaking (it plays without start events)", async () => {
    const { repeatWord } = await loadTts();
    fake.ss.starts = false;
    repeatWord("rhythm");
    await flush();
    fake.ss.speaking = true;
    await flush(20_000);
    expect(fake.log).toEqual(["speak:rhythm"]);
  });

  it("a word superseded before the retry fires is not retried", async () => {
    const { repeatWord, stopSpeaking } = await loadTts();
    fake.ss.starts = false;
    repeatWord("rhythm");
    await flush();
    stopSpeaking();
    await flush(20_000);
    expect(fake.log).toEqual(["speak:rhythm", "cancel"]);
  });
});

describe("voices that arrive late (Android Chrome)", () => {
  it("a voice list that appears after the wait timed out is still used for later words", async () => {
    const { repeatWord, getLastUsedVoiceName } = await loadTts();
    fake.ss.voiceList = [];
    repeatWord("first");
    await flush(5000); // the 3 s wait times out with no voices
    expect(fake.log).toContain("speak:first");
    expect(getLastUsedVoiceName()).toBe(null);
    fake.ss.voiceList = [UK_MALE];
    repeatWord("second");
    await flush();
    expect(fake.log.at(-1)).toBe("speak:second");
    expect(getLastUsedVoiceName()).toBe("Google UK English Male");
  });

  it("after a timed-out wait, a later word doesn't wait the 3 s again", async () => {
    const { repeatWord } = await loadTts();
    fake.ss.voiceList = [];
    repeatWord("first");
    await flush(5000);
    repeatWord("second");
    await flush(); // no timers advanced
    expect(fake.log.at(-1)).toBe("speak:second");
  });
});

// Multiplayer screens (race RoundScreen, elimination TurnScreen) announce through the same
// announceWord/repeatWord but never call unlockSpeech. Their timing must be exactly what it
// was: lead-in in the same tick, word on the lead-in's end, nothing extra afterwards.
describe("multiplayer path (no unlock): timing unchanged", () => {
  it("the first announcement speaks its lead-in in the same tick: no unlock wait, no cancel", async () => {
    const { announceWord } = await loadTts();
    const leadIn = announceWord("rhythm");
    await flush(); // no timers advanced
    expect(fake.log).toEqual([`speak:${leadIn}`]);
  });

  it("lead-in, then the word on its end, and nothing else for 20 s (no retry with a working engine)", async () => {
    const { announceWord } = await loadTts();
    const leadIn = announceWord("rhythm");
    await flush();
    fake.spoken[0].onend?.();
    await flush(20_000);
    expect(fake.log).toEqual([`speak:${leadIn}`, "speak:rhythm"]);
  });

  it("after a singleplayer unlock has ended, a later announcement doesn't wait", async () => {
    const { unlockSpeech, announceWord } = await loadTts();
    unlockSpeech();
    fake.spoken[0].onend?.(); // the silent utterance ended
    const leadIn = announceWord("rhythm");
    await flush();
    expect(fake.log).toEqual(["speak:", `speak:${leadIn}`]);
  });
});
