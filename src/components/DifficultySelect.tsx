import { useRef, useState } from "react";
import { EyeOff, Timer } from "lucide-react";
import type { DifficultyTier, GameOptions } from "../types";
import { TIERS } from "../lib/tiers";
import { useScreenFocus } from "../hooks/useScreenFocus";
import { Panel } from "./ui/Panel";

export function DifficultySelect({
  bests,
  onSelect,
}: {
  bests: Record<DifficultyTier, number>;
  onSelect: (tier: DifficultyTier, options?: GameOptions) => void;
}) {
  // Per-run modifiers, not stored preferences — they apply to whichever tier is
  // tapped next and are handed to startGame as GameOptions. Deliberately NOT in
  // the settings panel, which holds only global cross-cutting prefs.
  const [untimed, setUntimed] = useState(false);
  const [hideDefinition, setHideDefinition] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useScreenFocus(headingRef);

  return (
    <div className="tier-select">
      {/* The header is a lit panel: text never sits on the bare honeycomb. */}
      <Panel as="section" className="tier-head">
      <h1 ref={headingRef} tabIndex={-1}>Spelling Bee</h1>
      <p className="subtitle">Hear it. Spell it. Beat the clock.</p>

      <div className="mode-toggles">
        <button
          className={`mode-chip${untimed ? " active" : ""}`}
          aria-pressed={untimed}
          onClick={() => setUntimed((v) => !v)}
        >
          <Timer size={15} aria-hidden />
          Practice mode
        </button>
        <button
          className={`mode-chip${hideDefinition ? " active" : ""}`}
          aria-pressed={hideDefinition}
          onClick={() => setHideDefinition((v) => !v)}
        >
          <EyeOff size={15} aria-hidden />
          Hide definition
        </button>
      </div>
      <p className="mode-hint" role="status" aria-live="polite">
        {untimed && hideDefinition
          ? "No clock, and no definition — audio only."
          : untimed
            ? "No clock. Take as long as you like on each word."
            : hideDefinition
              ? "No definition shown — spell from the audio alone."
              : "Timed, with a definition for every word."}
      </p>
      </Panel>

      {/* Eight tier BUTTONS in one stack, novice down to master. Never a letter
          board. The wrapper owns the hexagon so the focus moat shares its shape. */}
      <div className="tier-stack" role="group" aria-label="Difficulty">
        {TIERS.map((t) => (
          <span key={t.id} className="tier-wrap">
            <button
              className="tier-bar"
              data-tier={t.id}
              onClick={() => onSelect(t.id, { untimed, hideDefinition })}
            >
              <span className="tier-bar-main">
                <span className="tier-label">{t.label}</span>
                <span className="tier-blurb">{t.blurb}</span>
              </span>
              <span className="tier-best">Best {bests[t.id]}</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
