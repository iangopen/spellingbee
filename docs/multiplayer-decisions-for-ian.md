# Multiplayer: decisions still on their defaults

2026-10-04. Ian's decisions from the spec review are already recorded. **These 22 items are still on
the spec's default**, the recommendation you didn't change (`docs/multiplayer-modes-spec.md` §9,
status "Default"). Engineering-only items aren't listed.

Each can be changed with one line back to me. They are ordered by how much they change the game,
most first.

| # | Item (§9 ref) | Default | Alternative | What changes |
|---|---|---|---|---|
| 1 | Spotlight clock (D9) | Every correct turn by anyone makes the next turn about 6% shorter, down to 6 s. Any miss resets it to full. | A smaller step (e.g. 3%), a higher floor, or the old Elimination rule (cuts at streaks of 5 and 9, and as players drop out) | How tense Spotlight gets. A smaller step makes long rallies easier. |
| 2 | Too-fast answers (D13) | An answer faster than a human could type (0.3 s + 0.05 s per letter) gets "too quick, try again" and doesn't use up the attempt | Treat it as a wrong answer, or have no floor | Stops instant-answer bots. No real player should ever see it. |
| 3 | Bots can't be fully stopped (C4) | Accept it: the browser must know the word to say it, so a script that waits just past the floor can still win | Generate the word audio on the server (a big change: hosting, audio files, cost) | Whether a determined cheater can win timed rounds. |
| 4 | Hourglass bank (D10) | Everyone starts with 10 s; not a room setting | Let the host choose (e.g. 5 to 20 s) | Game length and difficulty. A host setting adds one lobby control. |
| 5 | Hourglass length cap (D22) | At most 30 rounds, then the most time left wins | No cap, or 20 | Two evenly matched experts can't play for ever. A lower cap means more games decided on time left. |
| 6 | Player count (D3) | 2 to 8 players in all three modes, the existing room limit | A different cap for Spotlight (e.g. 6, so turns come round faster) | The wait between your turns in Spotlight |
| 7 | What the live view shows (D15) | The active player's actual letters as they type, mistakes included | Only a progress bar (how many letters, how fast) | The spectacle, against how exposed a typist feels |
| 8 | Keystrokes shown live (C3) | Shown live to the room, never stored; one sentence in PRIVACY.md | Progress-only view (item 7), which needs no new privacy wording | Other players see your typos as you make them. Nothing is kept. |
| 9 | Live view when the server is busy (D27) | Offered only while the project's message budget has room. Otherwise "Live view is off for this game". On Free, one 8-player or two 4-player Spotlight games at a time get it. | Always on, risking the Realtime cap disconnecting every game on the site, or Pro (5× the budget) | Some busy-time games have no live view, so no one game can stall everyone. |
| 10 | Leaving a game (D14) | No "has left" detection. A leaver's turns or rounds time out until they're out. | Online/offline dots (Realtime Presence) | Others see a leaver only when their turns time out. Presence would add message volume, and it's self-reported. |
| 11 | Live typing speed (D23) | Shown as "live", then replaced by the official time | Show only the official time afterwards | One more number on screen while watching |
| 12 | Mode names (D2) | Dash, Hourglass, Spotlight | Your names | Labels only. No stored values depend on them. |
| 13 | Avatar choices (D17) | 8 colours and 10 hats (the list is in spec §2.2) | More or fewer of either. New items can be added later, never removed. | How many distinct bees a room can show |
| 14 | "Surprise me" button (D18) | Included next to the arrows | Leave it out | One button in the avatar maker |
| 15 | Daily game cap per host (D30) | A host can start at most 60 games a day | Higher, lower, or none | Stops one room playing nonstop from using up the month's server allowance. No normal host gets near it. |
| 16 | When the allowance runs low (D28) | You can flip "multiplayer paused" with one SQL line. If Supabase cuts off anyway, players see "Multiplayer is resting until next month", and singleplayer still works. | Automatic pause at a threshold | What players see in a bad month |
| 17 | Shared monthly allowance (C10) | Stay on Free, with weekly checks. One determined script can still use up the month's function calls; this was already true. | Pro ($25/mo): 4× the calls, and paid overage instead of a shutdown | Whether an attack can stop multiplayer until the next month |
| 18 | Plan (D21) | Free. Move to Pro only if the tests show limits being hit. | Pro now | Cost, against headroom (items 9, 15 and 17) |
| 19 | Live-view flooding (C2) | Accepted, with the automatic budget and an instant off switch | Ship Spotlight without a live view | A modified client could still disturb everyone's games briefly, until the switch is flipped. |
| 20 | Live-view update rate (D16) | Up to 4 updates a second | 2 a second (cheaper, looks a little jumpier) | Smoothness, against how many games can have a live view at once |
| 21 | Old open tabs (C8) | A tab left open from before the update calls a new-mode room "Race" and fails safely until reloaded | Force a reload notice | A rare, confusing error for someone who hasn't refreshed |
| 22 | Network timing kept briefly (D29) | Dash and Hourglass measure your connection before each word, keep it with your guest ID for up to 10 minutes, and PRIVACY.md says so | No latency credit (slower connections lose close rounds) | One new short-lived piece of stored data |

Count check: §9 has 22 rows marked Default: C2, C3, C4, C8, C10, D2, D3, D9, D10, D13, D14, D15,
D16, D17, D18, D21, D22, D23, D27, D28, D29, D30. This page lists all 22.
