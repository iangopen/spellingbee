# Multiplayer: decisions still on their defaults

2026-10-04, updated the same day by the fourth pass (timing route and cold starts). Ian's decisions
from the spec review are already recorded. **These 25 items are still on the spec's default**, the
recommendation you didn't change (`docs/multiplayer-modes-spec.md` §9, status "Default").
Engineering-only items aren't listed.

Each can be changed with one line back to me. They are ordered by how much they change the game,
most first. Items 7–9 are new in the fourth pass, and item 18 changed in it.

| # | Item (§9 ref) | Default | Alternative | What changes |
|---|---|---|---|---|
| 1 | Spotlight clock (D9) | Every correct turn by anyone makes the next turn about 6% shorter, down to 6 s. Any miss resets it to full. | A smaller step (e.g. 3%), a higher floor, or the old Elimination rule (cuts at streaks of 5 and 9, and as players drop out) | How tense Spotlight gets. A smaller step makes long rallies easier. |
| 2 | Too-fast answers (D13) | An answer faster than a human could type (0.3 s + 0.05 s per letter) gets "too quick, try again" and doesn't use up the attempt | Treat it as a wrong answer, or have no floor | Stops instant-answer bots. No real player should ever see it. |
| 3 | Bots can't be fully stopped (C4) | Accept it: the browser must know the word to say it, so a script that waits just past the floor can still win | Generate the word audio on the server (a big change: hosting, audio files, cost) | Whether a determined cheater can win timed rounds. |
| 4 | Hourglass bank (D10) | Everyone starts with 10 s; not a room setting | Let the host choose (e.g. 5 to 20 s) | Game length and difficulty. A host setting adds one lobby control. |
| 5 | Hourglass length cap (D22) | At most 30 rounds, then the most time left wins | No cap, or 20 | Two evenly matched experts can't play for ever. A lower cap means more games decided on time left. |
| 6 | Player count (D3) | 2 to 8 players in all three modes, the existing room limit | A different cap for Spotlight (e.g. 6, so turns come round faster) | The wait between your turns in Spotlight |
| 7 | **New.** Warm-up before each round (D34) | In Dash and Hourglass, each player's browser sends one small "wake up" call before every word, so the server is ready when they answer. It can be switched off with one SQL line. | Warm up before the first word only, or not at all | A server that has to start up can add up to about half a second to one player's time. The warm-up makes that rare, but uses 79% more of the monthly allowance per game (about 3,450 eight-player Dash games a month instead of 6,170). |
| 8 | **New.** Crediting a slow server start (D35) | If an answer still lands on a server that was starting up, the server measures how long the start took and doesn't count it against the player, up to 0.5 s. It is switched on only if a test shows the measurement is accurate. | Never credit it, and just record it | Whether an unlucky player loses a close round to the server rather than to the other player |
| 9 | **New.** Dash: wait before awarding a round (D33) | 0.25 s after the first correct answer, so a slightly later answer that was really faster can still win | 0.15 s (the old figure: snappier, but sometimes awards the wrong player) | A tenth of a second longer before "Sam wins the round" appears |
| 10 | What the live view shows (D15) | The active player's actual letters as they type, mistakes included | Only a progress bar (how many letters, how fast) | The spectacle, against how exposed a typist feels |
| 11 | Keystrokes shown live (C3) | Shown live to the room, never stored; one sentence in PRIVACY.md | Progress-only view (item 10), which needs no new privacy wording | Other players see your typos as you make them. Nothing is kept. |
| 12 | Live view when the server is busy (D27) | Offered only while the project's message budget has room. Otherwise "Live view is off for this game". On Free, one 8-player or two 4-player Spotlight games at a time get it. | Always on, risking the Realtime cap disconnecting every game on the site, or Pro (5× the budget) | Some busy-time games have no live view, so no one game can stall everyone. |
| 13 | Leaving a game (D14) | No "has left" detection. A leaver's turns or rounds time out until they're out. | Online/offline dots (Realtime Presence) | Others see a leaver only when their turns time out. Presence would add message volume, and it's self-reported. |
| 14 | Live typing speed (D23) | Shown as "live", then replaced by the official time | Show only the official time afterwards | One more number on screen while watching |
| 15 | Mode names (D2) | Dash, Hourglass, Spotlight | Your names | Labels only. No stored values depend on them. |
| 16 | Avatar choices (D17) | 8 colours and 10 hats (the list is in spec §2.2) | More or fewer of either. New items can be added later, never removed. | How many distinct bees a room can show |
| 17 | "Surprise me" button (D18) | Included next to the arrows | Leave it out | One button in the avatar maker |
| 18 | Daily game cap per host (D30), **changed** | A host can start at most **30** games a day (it was 60; the warm-ups made each game cost more) | Higher, lower, or none | Stops one room playing nonstop from using up the month's server allowance. 30 Dash games is about an hour and a half of nonstop hosting; a group can pass the host role on. |
| 19 | When the allowance runs low (D28) | You can flip "multiplayer paused" with one SQL line. If Supabase cuts off anyway, players see "Multiplayer is resting until next month", and singleplayer still works. | Automatic pause at a threshold | What players see in a bad month |
| 20 | Shared monthly allowance (C10) | Stay on Free, with weekly checks. One determined script can still use up the month's function calls; this was already true. | Pro ($25/mo): 4× the calls, and paid overage instead of a shutdown | Whether an attack can stop multiplayer until the next month |
| 21 | Plan (D21) | Free. Move to Pro only if the tests show limits being hit. | Pro now | Cost, against headroom (items 7, 12, 18 and 20) |
| 22 | Live-view flooding (C2) | Accepted, with the automatic budget and an instant off switch | Ship Spotlight without a live view | A modified client could still disturb everyone's games briefly, until the switch is flipped. |
| 23 | Live-view update rate (D16) | Up to 4 updates a second | 2 a second (cheaper, looks a little jumpier) | Smoothness, against how many games can have a live view at once |
| 24 | Old open tabs (C8) | A tab left open from before the update calls a new-mode room "Race" and fails safely until reloaded | Force a reload notice | A rare, confusing error for someone who hasn't refreshed |
| 25 | Network timing kept briefly (D29) | Dash and Hourglass measure your connection before each word, keep it with your guest ID for up to 10 minutes, and PRIVACY.md says so | No latency credit (slower connections lose close rounds) | One new short-lived piece of stored data |

Count check: §9 has 25 rows marked Default: C2, C3, C4, C8, C10, D2, D3, D9, D10, D13, D14, D15,
D16, D17, D18, D21, D22, D23, D27, D28, D29, D30, D33, D34, D35. This page lists all 25.

Not on this list, because it follows your own earlier rule rather than a new default: the latency
credit cap dropped from 100 ms to 70 ms (D32). You fixed the dead band at 200 ms and said the cap
moves to fit under it (D7b), and the fourth pass found errors the budget hadn't counted.
