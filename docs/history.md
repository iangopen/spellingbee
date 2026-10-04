# Session history

## 2026-09-30: rename to Spelling Bee on main

Renamed every user-facing "Spelling Race" to "Spelling Bee", ahead of the
redesign: `index.html` title and meta description, the `<h1>` on ModeSelect and
DifficultySelect, `README.md` and `PRIVACY.md`. The GitHub About description was
updated with `gh repo edit`; homepage and topics were kept.

Kept on purpose: the "Race" mode label, the repo slug, the `/spellingbee/` base,
all `spellingbee:*` localStorage keys, and the `package.json` name.

The meta description said "A word-spelling race game"; "race" is now dropped
there because it described the product, not the mode.

Not done: README screenshots (retaken after the redesign merges).

## 2026-10-04: multiplayer modes and avatar maker spec (plan/multiplayer-modes)

A spec-only session on a new branch off `main`. No code, migrations or edge
functions were changed, and the redesign branch was read with `git show` only.

Read:
- migrations 0001-0020;
- the five edge functions and `_shared/mod.ts`;
- `useMultiplayerGame`, `rooms.ts`, `avatars.ts`, `serverClock.ts`, `tts.ts`
  and `useAnnouncedWord`;
- the redesign's `AvatarPicker`, `Art`, `beeArt.ts`, `standings.ts`, the lobby
  and waiting room, and `RaceResults`;
- HARDENING.md.

The Supabase Realtime limits, the message counting rules and the
authorization caching behaviour were fetched from the Supabase docs on the
same day.

Wrote `docs/multiplayer-modes-spec.md`:
- what exists today, with file citations;
- the avatar data model and its migration while the old client runs;
- Dash, Hourglass and Spotlight, each with an edge-case table;
- timing fairness;
- the live typing feed, with the quota arithmetic;
- migrations 0021-0027 and their tests;
- UI, 13 build stages, and a decisions list.

Choices made without asking (all listed in the spec's §9):
- a Hourglass miss is capped at 4 s rather than costing the full round;
- Spotlight keeps lives;
- a void Dash round uses up one of the five;
- only the tied leaders play sudden death;
- the player's speech rate is kept;
- client-reported timing is rejected in favour of an edge-entry receipt stamp
  measured from a scheduled reveal.

Found in today's code:
- random lead-ins are rolled per client;
- the clock sync takes one sample;
- Elimination still has no timeout fast path.
