# A text from a photo, added on the site

Not built yet. This is how it would work, what it needs, and what is hard
about it — written down so it can be picked up without starting over.

What the learner wants: on a shelf, tap **Add a text**, photograph a page of
the book (or choose photos), and a few minutes later the passage is on that
shelf the way `/add-text` puts it there — pinyin, translation, words, grammar,
questions, and an easier retelling first when the page is too hard.

## The constraint: no API key

The site cannot ask Claude anything by itself. Vercel has no Claude Code, and
calling the Claude API needs a key, which is paid per token and is exactly
what this app has avoided. A subscription cannot be used from a server either:
there is no way for a website to borrow the learner's claude.ai login, and
running Claude Code with the learner's credentials on Vercel would be against
the terms.

So the work has to happen where Claude already runs on the subscription:

1. **A Claude Code routine with an API trigger** — the way to do it unattended.
2. **The learner's own Claude chat**, with the site preparing everything —
   the way that works today with nothing set up.

## 1. Routine with an API trigger (the real version)

Claude Code on the web can keep a *routine*: a saved prompt that runs in a
fresh cloud session on the learner's subscription, on a schedule or when an
HTTP request fires it. Docs:
<https://platform.claude.com/docs/en/api/claude-code/routines-fire>.

    POST https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire
    Authorization: Bearer <routine token>
    anthropic-beta: experimental-cc-routine-2026-04-01
    { "text": "<run-specific context>" }

The token is generated on the routine's page in claude.ai, is shown once, and
can only fire that one routine. It is not an API key: runs count against the
subscription, like any Claude Code session.

### The flow

1. **The site.** Add a text → camera or photos (`<input type="file"
   accept="image/*" capture="environment" multiple>`). Each photo is shrunk in
   the browser to about 1600px on the long side, JPEG ~0.8 — 200–400 KB, well
   under Vercel's 4.5 MB request limit. The choice the skill would otherwise ask
   for is made in the same sheet: *If it is too hard: easier and original /
   original only*.
2. **The server** stores the photos in an *inbox* row — user, shelf id, the
   choice, the photos as bytes, status `waiting` — and fires the routine with
   `text: "inbox <id>"`. The routine id and token live in Vercel's environment
   (`CLAUDE_ROUTINE_ID`, `CLAUDE_ROUTINE_TOKEN`), never in the repository.
3. **The routine** is a short prompt: *run /add-text for inbox item <id>*. The
   skill gets a mode for it: read the item from `GET /api/inbox/<id>` (photos
   and choices), transcribe, write the study material, check it, add the
   easier version if the choice says so, add to the shelf with `npm run texts`,
   then `POST /api/inbox/<id>` with the result — the text ids, or what went
   wrong.
4. **The shelf** shows the inbox row while it waits ("Reading your photo…
   usually 2 to 4 minutes"), then the text in its place. A failure says what
   failed and offers to send it again.

### What is hard about it

- **Experimental.** The endpoint needs a beta header and may change shape;
  keep the call in one small module with a test against a recorded response.
- **A daily cap on routine runs**, per account, set by the plan. Batch: one run
  takes every waiting photo, not one run per photo.
- **Minutes, not seconds.** A cloud session has to start and install the
  repository first. Say so on screen; let the learner leave and come back.
- **The network.** The routine's cloud environment must allow
  `chinese-inky.vercel.app` (Network access → Allowed domains), as `/add-text`
  already needs.
- **No questions.** The skill asks which shelf and whether to simplify; here
  both are answered in the sheet before sending. Characters the transcription
  was unsure of are listed on the text with the photo beside them, to check.
- **The account.** The skill signs in with the admin password, which is in this
  public repository. For the routine, give the inbox its own token (an env var
  on both sides) that can only read inbox items and add texts — and change the
  account password.
- **Storage.** Photos in Postgres are fine at this size; delete them once the
  text is in, or after a week.

## 2. Through the learner's own Claude chat (works today)

No setup at all, more taps:

1. Add a text → **Through Claude**: the site copies a prompt — the `/add-text`
   instructions trimmed to one passage, what the learner knows (`knownChars`,
   `knownWords`, `met`), and the shelf's name.
2. The learner opens the Claude app, pastes, attaches the photo, sends.
3. Claude answers with the JSON. The learner copies it and pastes it back into
   the sheet, which runs the same parser as Paste back and adds it to the shelf.

The writing session (`/texts/session`) already works this way for generated
texts; this is the same three steps with a photo attached.

## 3. A first draft in seconds, then Claude

iOS reads text out of photos itself (Live Text: press on the text in the photo,
Copy). Pasting that Chinese into the sheet can give a usable draft straight
away from the app's own dictionary — words, pinyin, how much is known — while
the translation, grammar, questions and retelling come later from 1 or 2.
Worth doing only once 1 or 2 exists.

## Order to build it in

1. The inbox (table, routes, the sheet on a shelf, the waiting row) with route
   2 as its only way through — useful on its own.
2. The routine and its trigger, behind the env vars; route 2 stays as the
   fallback when they are not set or the day's runs are used up.
3. Live Text paste as a draft.
