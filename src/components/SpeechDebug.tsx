import { useEffect, useRef, useState } from "react";
import { setSpeechTrace, speechStatus } from "../lib/tts";
import { isAutoSubmitOn, isTouchDevice } from "../lib/touch";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";

// Hidden speech log, shown only with ?debug=speech in the address (App loads this
// file lazily, so normal play never downloads it). It is for diagnosing phone
// speech: the engine's speaking/pending/paused flags and voice count, and every
// utterance's speak/start/end/error with a timestamp, plus a Copy button so the
// log can be pasted back. It keeps the log in memory on this page only; nothing
// is stored or sent anywhere.

const POLL_MS = 250;
const MAX_LINES = 300;

function stamp(t0: number) {
  return `+${String(Math.round(performance.now() - t0)).padStart(6, " ")}ms`;
}

export default function SpeechDebug() {
  const t0 = useRef(performance.now());
  const [lines, setLines] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const lastState = useRef("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const add = (line: string) => setLines((prev) => [...prev, `${stamp(t0.current)} ${line}`].slice(-MAX_LINES));
    add(`page ${location.pathname}${location.search}`);
    add(`ua ${navigator.userAgent}`);
    add(`touch ${isTouchDevice()} · auto-submit ${isAutoSubmitOn()}`);
    setSpeechTrace((event, text, detail) => add(`${event} ${text ? JSON.stringify(text) : ""}${detail ? ` (${detail})` : ""}`));
    const poll = window.setInterval(() => {
      const s = speechStatus();
      const now = s
        ? `state speaking=${s.speaking} pending=${s.pending} paused=${s.paused} voices=${s.voices}`
        : "state speechSynthesis not supported";
      if (now !== lastState.current) {
        lastState.current = now;
        add(now);
      }
    }, POLL_MS);
    const onVisibility = () => add(`page ${document.visibilityState}`);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      setSpeechTrace(null);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function copy() {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      // Older iOS without clipboard access: select the text so a long-press copies it.
      textRef.current?.focus();
      textRef.current?.select();
      setCopied("Selected: long-press and copy");
    }
  }

  return (
    <Panel as="section" className="speech-debug" aria-label="Speech debug log">
      <div className="speech-debug-head">
        <strong>Speech log</strong>
        <Button size="sm" onClick={() => void copy()}>
          Copy log
        </Button>
        <Button size="sm" variant="text" onClick={() => setLines([])}>
          Clear
        </Button>
        {copied && <span role="status">{copied}</span>}
      </div>
      <textarea ref={textRef} className="speech-debug-log" readOnly value={lines.join("\n")} rows={8} />
    </Panel>
  );
}
