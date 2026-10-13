import { useRef } from "react";
import { User, Users } from "lucide-react";
import { useScreenFocus } from "../hooks/useScreenFocus";
import { TIERS } from "../lib/tiers";
import type { DifficultyTier } from "../types";
import { BeeMascot, Rosette } from "./ui/Art";
import { Button } from "./ui/Button";
import { Panel, Sticker } from "./ui/Panel";

// Home: a hero panel (title, the two ways to play) and the player's best scores.
// Every line of text sits on a Panel, never on the bare honeycomb.
export function ModeSelect({
  onSingle,
  onMulti,
  bests,
}: {
  onSingle: () => void;
  onMulti: () => void;
  /** Best timed score per tier; 0 means not played. Omit to hide the panel. */
  bests?: Record<DifficultyTier, number>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useScreenFocus(headingRef);

  return (
    <div className="home">
      <Panel as="section" className="hero" aria-labelledby="home-title">
        <Sticker>Solo or with friends</Sticker>
        <BeeMascot className="hero-mascot" />
        <h1 id="home-title" ref={headingRef} tabIndex={-1}>
          Spelling Bee
        </h1>
        <p className="tagline">Hear it. Spell it. Beat the clock.</p>
        <p className="lede">
          Listen to the word, read the definition, and type it before time runs out. Play solo or
          race your friends.
        </p>
        <div className="actions">
          <Button variant="primary" icon={<User aria-hidden />} onClick={onSingle}>
            Singleplayer
          </Button>
          <Button icon={<Users aria-hidden />} onClick={onMulti}>
            Multiplayer
          </Button>
        </div>
        <p className="home-footer">
          <a href="https://github.com/iangopen/spellingbee/blob/main/PRIVACY.md">Privacy</a>
        </p>
      </Panel>

      {bests && (
        <Panel as="aside" className="bests" aria-labelledby="bests-title">
          <Rosette className="rosette-float" />
          <h2 id="bests-title">Your best scores</h2>
          <p>Timed games only. Practice runs don't count.</p>
          <ol>
            {TIERS.map((t) => (
              <li key={t.id} data-tier={t.id}>
                <span className="tier">
                  <i className="swatch" aria-hidden="true" />
                  {t.label}
                </span>
                {bests[t.id] > 0 ? (
                  <span className="score">{bests[t.id]}</span>
                ) : (
                  <span className="score none">Not played yet</span>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
