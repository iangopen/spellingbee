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

## 2026-10-04: Access-Control-Max-Age on the edge functions (main)

Added `Access-Control-Max-Age: 7200` to `corsHeaders` in
`supabase/functions/_shared/mod.ts`. Nothing else changed: no client code, no
game logic, no function entry point.

Why: `callEdge` sends non-simple headers, so every call is preflighted, and with
no max-age the browser keeps the permission for only 5 s. Race rounds are 13 s
or more apart, so most answers paid an extra `OPTIONS` round trip. MDN: Chromium
76+ caps the value at 2 h and Firefox at 24 h, so 7200 is the most that helps.

Tests: `edge_errors.test.mjs` gained a "CORS preflight" block (header present on
an unauthenticated OPTIONS with no handler call and no Auth fetch; the other
three headers unchanged; exactly four headers). The first and third fail
without the change (checked by stashing `mod.ts`). `npm run build`, `npm test`
(46) and `npm run test:db` (97) pass; `npm run lint` has only the existing
warnings.

Deployed with `npx supabase functions deploy --use-api` (all five). Live check,
before and after:
- `OPTIONS` to all five: 200, and `access-control-max-age: 7200` appears only
  after the deploy; the other three CORS headers are identical.
- POST with the public anon key and no user, `{}` body: 401
  `{"ok":false,"error":"unauthorized"}` for all five, before and after. A POST
  with no Authorization header at all gets the gateway's 401
  (`UNAUTHORIZED_NO_AUTH_HEADER`), also unchanged.

No guest user was created for any of this.

### Browser check on the live site (for Ian)

1. Open https://iangopen.github.io/spellingbee/ in Chrome in a normal window and
   do a hard reload (Ctrl+Shift+R) so you have the current client.
2. Open DevTools (F12) -> Network. Tick **Preserve log**, and untick **Disable
   cache**. Type `functions/v1` in the filter box. Clear the list.
3. Start a multiplayer race (create a room, have a second browser or person
   join, then Start) and answer several words.
4. Expected: the first answer shows two rows for `submit-answer`, an `OPTIONS`
   (status 200, type `preflight`) followed by the `POST`. Every later answer
   shows only a `POST`. Click the `OPTIONS` row -> Headers -> Response Headers:
   `access-control-max-age: 7200`.
5. Not expected: an `OPTIONS` before each answer. (Chrome sometimes lists
   preflights under type `Other`; clear the type filter if you can't see one.
   Check that `start-game` and `submit-answer` each preflight once, because the
   cache is keyed per URL.)
6. If you still see a preflight on every answer, check the response header on
   it. A missing header means the old function is still live. A present header
   means the browser is not caching it, so tell me which browser.

Firefox keeps preflights up to 24 h, Chromium 2 h; Safari's cap isn't documented
by MDN, so a Safari check is a bonus and not a requirement.

### Rollback

```
git checkout 8b979dc -- supabase/functions/_shared/mod.ts
npx supabase functions deploy --use-api --project-ref wjorfdfpbgyykbhxydqj
```

Also in CLAUDE.md.

### Open

- The multiplayer spec on `plan/multiplayer-modes` still lists this as pending in
  stage 1 (§8) and §4.5.4 part 1. Update it there; that branch was not touched.
