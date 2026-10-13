# Privacy

Last updated: 2026-09-29. Last checked against the code: 2026-10-03.

Spelling Bee is a free spelling game. It has no accounts, ads or analytics, and the app sets no cookies. It is not directed at children under 13.

**Every visit.** GitHub Pages hosts the site and logs visitors' IP addresses for security.

**Singleplayer** sends nothing else: the page, its fonts, icons and web manifest all come from the same site. Your best scores and settings (including the theme and the reduce-motion switch) stay in your browser's local storage.

**Reading words aloud.** Your browser's voice reads the word, its definition and a short lead-in. Some browser voices run on the browser maker's servers, which then receive that text. Nothing you type is read aloud.

**Multiplayer** sends more:

- Cloudflare Turnstile checks that you are not a bot.
- Supabase signs you in as a guest with a random ID. There is no email or password. The sign-in session records your IP address and browser type, and your browser keeps the session in local storage.
- The game stores your display name, avatar, rooms, scores, and every guess with its timing. Players in your room see your name, avatar and scores.

**Deletion.** Guesses are deleted within 10 minutes of a game ending. Rooms, with their scores and results, are deleted 30 days after the room was created. Your guest ID and its session are deleted once the ID is more than 30 days old and no game still refers to it. Supabase and Cloudflare keep their own request logs under their own policies.

To have your data deleted sooner, or to ask a privacy question, open an issue at https://github.com/iangopen/spellingbee/issues. Include your guest display name and room code, but please don't post any other personal details in the issue, because issues are public.
