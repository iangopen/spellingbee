import { useRef } from "react";
import { useScreenFocus } from "../hooks/useScreenFocus";
import type { MultiplayerExtras } from "../hooks/useMultiplayerGame";
import { AvatarBadge } from "./AvatarPicker";
import { Rosette } from "./ui/Art";
import { Button } from "./ui/Button";
import { Panel, Sticker } from "./ui/Panel";

/**
 * End of an elimination game.
 *
 * RANKING, and why it is this way.
 * There is no score-based placement here. The mode's whole proposition is
 * "survive", so the honest ordering is how long you survived:
 *
 *   1st           the last player standing (rooms.winner_id, set by the server)
 *   2nd .. Nth    everyone else in REVERSE elimination order — the player
 *                 knocked out last placed highest, the first one out placed last
 *
 * Elimination order comes from extras.eliminationOrder, which orders the players
 * the SERVER already flagged eliminated by the round of their final losing turn.
 * Reversing it gives placement directly. Score is still shown, because players
 * want to see it, but it is explicitly not what decides the order — and saying
 * so on screen is cheaper than letting someone infer a ranking rule that isn't
 * there.
 *
 * The degenerate case: apply_turn_outcome can finish a game with winner_id NULL
 * if the tier runs out of unused words and the survivors are exactly tied. It is
 * unreachable in practice (150 words a tier), but rendering "undefined wins" if
 * it ever happened would be worse than handling it, so a null winner shows an
 * honest draw.
 */
export function EliminationResults({
  extras,
  onLeave,
}: {
  extras: MultiplayerExtras;
  onLeave: () => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  useScreenFocus(primaryRef);

  const { players, winnerId, currentUserId, eliminationOrder } = extras;

  const winner = players.find((p) => p.player_id === winnerId) ?? null;
  const iWon = Boolean(winnerId && winnerId === currentUserId);

  // Reverse elimination order = placement, best-surviving first.
  const placed = [...eliminationOrder].reverse();
  const standings = [
    ...(winner ? [winner] : []),
    ...placed
      .map((id) => players.find((p) => p.player_id === id))
      .filter((p): p is (typeof players)[number] => Boolean(p)),
  ];

  // Anyone the server never dealt into the rotation, or who somehow isn't in
  // either bucket, is appended rather than silently dropped.
  for (const p of players) {
    if (!standings.some((s) => s.player_id === p.player_id)) standings.push(p);
  }

  return (
    <div className="elim-results">
      {winner ? (
        <Panel as="section" className={`winner champion${iWon ? " mine" : ""}`} aria-labelledby="champion-name">
          <Sticker>Game over</Sticker>
          <Rosette className="winner-rosette" />
          <div>
            <p className="kicker">{iWon ? "You win" : "Champion"}</p>
            <h1 id="champion-name" className="champion-name">
              <AvatarBadge avatar={winner.avatar} size={40} />
              {winner.display_name}
            </h1>
            <p>
              {iWon ? "Last speller standing." : `${winner.display_name} was the last one standing.`}
            </p>
          </div>
        </Panel>
      ) : (
        <Panel as="section" className="winner champion draw" aria-labelledby="champion-name">
          <Sticker>Game over</Sticker>
          <div>
            <p className="kicker">Draw</p>
            <h1 id="champion-name">No winner</h1>
            <p>The words ran out with nobody ahead.</p>
          </div>
        </Panel>
      )}

      <Panel as="section" className="standings" aria-labelledby="standings-label">
        <h2 id="standings-label" className="standings-label">
          Final standings — by how long you lasted
        </h2>
        <ol>
          {standings.map((p, i) => (
            <li
              key={p.player_id}
              className={`standing-row${p.player_id === currentUserId ? " you" : ""}`}
            >
              <span className="standing-place">{i + 1}</span>
              <AvatarBadge avatar={p.avatar} size={32} dimmed={p.is_eliminated} />
              <span className="standing-name">
                {p.display_name}
                {p.player_id === currentUserId && <span className="standing-you">you</span>}
              </span>
              <span className="standing-score">
                {p.score}
                <span className="sr-only"> points</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="standings-note">Points are shown, but they do not decide the order.</p>
      </Panel>

      <Button ref={primaryRef} variant="primary" onClick={onLeave}>
        Back to lobby
      </Button>
    </div>
  );
}
