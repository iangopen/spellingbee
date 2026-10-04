import { useRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useScreenFocus } from "../hooks/useScreenFocus";
import { Button } from "./ui/Button";
import { Rosette } from "./ui/Art";
import { Panel, Sticker } from "./ui/Panel";

// Two callers with different next moves. Singleplayer can replay or change
// difficulty. A finished race can only leave the room: there is no rematch,
// and both old buttons ("Play again", "Change difficulty") silently did that.
// So a race passes onLeaveRoom and gets exactly one button that says so.
type Actions =
  | { onReplay: () => void; onMenu: () => void; onLeaveRoom?: undefined }
  | { onLeaveRoom: () => void; onReplay?: undefined; onMenu?: undefined };

export function ResultsScreen({
  score,
  bestStreak,
  best,
  isNewBest = false,
  practice = false,
  onReplay,
  onMenu,
  onLeaveRoom,
}: {
  score: number;
  bestStreak: number;
  /** The stored best for this tier. Omit it (a race) and no best line is shown. */
  best?: number;
  /**
   * True only when this run beat the PREVIOUS best, decided by the caller (App
   * compares against the stored best before it updates). It used to be derived
   * here as `score >= best`, which also fired on a tie, on a practice run
   * against an empty best, and on every race.
   */
  isNewBest?: boolean;
  /** An untimed run: it is not on the timed scale and never records a best. */
  practice?: boolean;
} & Actions) {
  // The game just ended under the player's hands: "Play again" is the next move.
  const primaryRef = useRef<HTMLButtonElement>(null);
  useScreenFocus(primaryRef);
  return (
    <Panel as="section" className="results-screen" aria-labelledby="results-title">
      {isNewBest && (
        <>
          <Rosette className="results-rosette" />
          <Sticker>New best!</Sticker>
        </>
      )}
      <h2 id="results-title">Round complete</h2>
      <div className="results-stats">
        <div className="stat">
          <span className="stat-value">{score}</span>
          <span className="stat-label">final score</span>
        </div>
        <div className="stat">
          <span className="stat-value">{bestStreak}</span>
          <span className="stat-label">best streak</span>
        </div>
      </div>
      {practice ? (
        <p className="results-best">Practice runs don't set best scores.</p>
      ) : (
        best !== undefined && (
          <p className="results-best">
            Best: {best}
            {isNewBest && " — new best!"}
          </p>
        )
      )}
      <div className="results-actions">
        {onLeaveRoom ? (
          <Button ref={primaryRef} variant="primary" icon={<ArrowLeft size={16} aria-hidden />} onClick={onLeaveRoom}>
            Back to lobby
          </Button>
        ) : (
          <>
            <Button ref={primaryRef} variant="primary" icon={<RotateCcw size={16} aria-hidden />} onClick={onReplay}>
              Play again
            </Button>
            <Button variant="text" onClick={onMenu}>
              Change difficulty
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}
