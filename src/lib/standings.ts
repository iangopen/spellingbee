// Final standings for a race, from the scoreboard the server already holds.
// Presentation only: scores are written by the server (0006), and this never
// decides a winner, it only orders and words what the rows say.
//
// Ranking is "standard competition": players on the same score share a place
// and the next place skips (1, 1, 3). A tie for first is a tie, not a winner
// picked by row order.

export interface Standing<P> {
  player: P;
  /** 1-based place; equal scores share it. */
  rank: number;
  /** Points behind the leader (0 for the leaders). */
  behind: number;
  /** 0..1 along the lane, relative to the leader. Zero points sits at the start. */
  progress: number;
}

export function rankPlayers<P extends { score: number }>(players: readonly P[]): Standing<P>[] {
  // Array.prototype.sort is stable, so equal scores keep the order they arrived in.
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  let rank = 0;
  return sorted.map((player, i) => {
    if (i === 0 || player.score !== sorted[i - 1].score) rank = i + 1;
    return { player, rank, behind: top - player.score, progress: top > 0 ? player.score / top : 0 };
  });
}

const ORDINAL = ["", "1st", "2nd", "3rd"];
export const ordinal = (n: number): string => ORDINAL[n] ?? `${n}th`;

export interface RaceSummary {
  /** Heading words: the winner's name, or the names that tied. */
  headline: string;
  /** "Race winner" or "A tie for first". */
  kicker: string;
  /** A sentence addressed to the viewer, or null if they are not in the list. */
  youLine: string | null;
}

const joinNames = (names: string[]): string =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function summarizeRace(
  standings: Standing<{ player_id: string; display_name: string; score: number }>[],
  viewerId: string | null,
): RaceSummary {
  const leaders = standings.filter((s) => s.rank === 1);
  const topScore = leaders[0]?.player.score ?? 0;
  const me = standings.find((s) => s.player.player_id === viewerId);

  if (standings.length === 0 || topScore === 0) {
    return { kicker: "Race over", headline: "No points this time", youLine: me ? "Nobody scored a word." : null };
  }
  const tied = leaders.length > 1;
  const headline = joinNames(leaders.map((l) => l.player.display_name));
  const kicker = tied ? "A tie for first" : "Race winner";
  let youLine: string | null = null;
  if (me) {
    const pts = `${me.player.score} point${me.player.score === 1 ? "" : "s"}`;
    if (me.rank === 1) youLine = tied ? `You tied for 1st with ${pts}.` : `You won with ${pts}.`;
    else youLine = `You came ${ordinal(me.rank)} with ${pts}, ${me.behind} behind.`;
  }
  return { kicker, headline, youLine };
}
