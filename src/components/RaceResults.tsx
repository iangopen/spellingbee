import { useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useScreenFocus } from "../hooks/useScreenFocus";
import { coerceAvatar } from "../lib/avatars";
import { rankPlayers, summarizeRace } from "../lib/standings";
import { TIER_META } from "../lib/tiers";
import type { DifficultyTier } from "../types";
import { AvatarArt, Rosette } from "./ui/Art";
import { Button } from "./ui/Button";
import { Panel, Sticker } from "./ui/Panel";

/** Just the columns this screen reads, so any scoreboard row shape fits. */
interface RacePlayer {
  player_id: string;
  display_name: string;
  score: number;
  avatar: unknown;
}

// A finished race: the winner (or the tie), then everyone's lane. Everything
// comes from the scoreboard the server already holds, passed in as data; this
// decides nothing. Replaces the old reuse of the solo results screen, which said
// "new best!" after every race and showed no winner or standings.
export function RaceResults({
  players,
  currentUserId,
  tier,
  onLeave,
}: {
  players: RacePlayer[];
  currentUserId: string | null;
  tier: DifficultyTier | null;
  onLeave: () => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  useScreenFocus(primaryRef);

  const standings = rankPlayers(players);
  const summary = summarizeRace(standings, currentUserId);
  const decided = summary.kicker !== "Race over";

  return (
    <div className="race-results">
      <Panel as="section" className="winner" aria-labelledby="race-winner">
        <Sticker>Race over</Sticker>
        {decided && <Rosette className="winner-rosette" />}
        <div>
          <p className="kicker">
            {summary.kicker}
            {tier && decided ? `, ${TIER_META[tier].label} words` : ""}
          </p>
          <h1 id="race-winner">{summary.headline}</h1>
          {summary.youLine && <p>{summary.youLine}</p>}
        </div>
      </Panel>

      <Panel as="ol" className="lanes" aria-label="Final standings">
        {standings.map(({ player, rank, progress }) => {
          const you = player.player_id === currentUserId;
          return (
            <li key={player.player_id} className={`lane${rank <= 3 ? ` p${rank}` : ""}${you ? " you" : ""}`}>
              <span className="pos">{rank}</span>
              <span className="name">
                <b>{player.display_name}</b>
                {you && <span>you</span>}
              </span>
              <span className="track" aria-hidden="true">
                <span className="token" style={{ left: `calc((100% - 66px) * ${progress})` }}>
                  <AvatarArt avatar={coerceAvatar(player.avatar)} size={46} />
                </span>
              </span>
              <span className="pts">
                {player.score}
                <span className="sr-only"> points</span>
              </span>
            </li>
          );
        })}
      </Panel>

      <div className="actions">
        <Button ref={primaryRef} variant="primary" icon={<ArrowLeft aria-hidden />} onClick={onLeave}>
          Back to lobby
        </Button>
      </div>
    </div>
  );
}
