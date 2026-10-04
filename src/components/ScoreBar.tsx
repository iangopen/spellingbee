import { useEffect, useRef, useState } from "react";
import { Panel, Placard } from "./ui/Panel";

// The round's header strip: the tally (score and streak), the contestant's
// placard (words left) and the clock, on one lit pill. It is the only user of
// these class names, so unlike the old `.score-bar` / `.stat` rules (still shared
// with TurnScreen's own header) it can be restyled freely.
export function ScoreBar({
  score,
  streak,
  timeLeft,
  wordsRemaining,
  untimed = false,
}: {
  score: number;
  streak: number;
  timeLeft: number;
  wordsRemaining: number;
  /** Practice mode: there is no clock, so show the mode instead of a dead 0. */
  untimed?: boolean;
}) {
  // Presentational only: notice when the streak goes UP so the counter can be
  // given a beat of visual weight. Derived entirely from the streak prop — no
  // game state is introduced, and a streak RESET deliberately doesn't animate.
  //
  // The counter doubles as the animation key: bumping it remounts the span,
  // which is what restarts a CSS animation that has already played once.
  const [pulseKey, setPulseKey] = useState(0);
  const prevStreak = useRef(streak);

  useEffect(() => {
    if (streak > prevStreak.current) setPulseKey((n) => n + 1);
    prevStreak.current = streak;
  }, [streak]);

  return (
    <Panel className="round-head">
      <div className="tally">
        <div>
          <b>{score}</b>
          <span>score</span>
        </div>
        <div>
          <b key={pulseKey} className={pulseKey > 0 ? "pulse" : undefined}>
            {streak}
          </b>
          <span>streak</span>
        </div>
      </div>
      <Placard value={wordsRemaining} label="to go" />
      {untimed ? (
        // Replaces the countdown rather than leaving a frozen "0s left", which
        // would read as a bug.
        <div className="clock">
          <b>∞</b>
          <small>practice</small>
        </div>
      ) : (
        <div className="clock" data-low={timeLeft <= 5}>
          <b>{timeLeft}s</b>
          <small>left</small>
        </div>
      )}
    </Panel>
  );
}
