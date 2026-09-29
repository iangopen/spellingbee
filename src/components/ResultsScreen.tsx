import { useRef } from "react";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { useScreenFocus } from "../hooks/useScreenFocus";

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
  onReplay,
  onMenu,
  onLeaveRoom,
}: {
  score: number;
  bestStreak: number;
  best: number;
} & Actions) {
  const isNewBest = score >= best && score > 0;
  // The game just ended under the player's hands: "Play again" is the next move.
  const primaryRef = useRef<HTMLButtonElement>(null);
  useScreenFocus(primaryRef);
  return (
    <div className="results-screen">
      <h2>
        <Trophy size={22} aria-hidden />
        Round complete
      </h2>
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
      <p className="results-best">
        Best: {best}
        {isNewBest && " — new best!"}
      </p>
      <div className="results-actions">
        {onLeaveRoom ? (
          <button ref={primaryRef} className="primary-btn" onClick={onLeaveRoom}>
            <ArrowLeft size={16} aria-hidden />
            Back to lobby
          </button>
        ) : (
          <>
            <button ref={primaryRef} className="primary-btn" onClick={onReplay}>
              <RotateCcw size={16} aria-hidden />
              Play again
            </button>
            <button className="ghost-btn" onClick={onMenu}>
              Change difficulty
            </button>
          </>
        )}
      </div>
    </div>
  );
}
