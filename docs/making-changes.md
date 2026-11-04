# Making a change: design it, see every state, then commit

`docs/guidelines.md` says how the app should look and behave;
`docs/development-standards.md` says how a feature is cut into steps and the
standards each step is held to. This file says
how to get a change there in one go: what to work out before writing code, what
to look at before committing, and how to fix a bug so it stays fixed. It was
written after a day of bugs (November 2026) that were each simple and each
reached the learner. Every rule below names the bug that taught it.

The short version:

1. **Before code:** list every state the thing can be in, with the learner's
   real data and the longest real text, at the learner's real width.
2. **Before commit:** see each of those states, in WebKit as well as Chromium,
   and drive every control through all of its transitions.
3. **Before calling a bug fixed:** reproduce the reported state first, fix the
   cause and its siblings, and look at the reported state again.

## 1. Before writing code

### Write down the states

Before a line of code, write out every state the screen or control can be in.
Put the list in the commit message or in a comment at the top of the component.
A state nobody listed is a state nobody looked at. Go through these:

| Ask | For example |
|---|---|
| What is there before anything happens? | no tries yet, no narrator, an empty shelf |
| What while it loads, and if it fails? | scoring…, the service refused, offline |
| What does each control do on a second tap, and when its job ends by itself? | Hear → Stop → Hear; the line ends and the button is Hear again |
| What if another control starts meanwhile? | Mine while Hear plays; recording while anything plays; leaving the line |
| Which data generations exist? | tries with the service's whole answer, tries with only a summary, tries moved over from a device |
| What is the longest real content? | a narrator called "Pikachu story narrator", a 15-character line, "Not known" |
| What does the real distribution look like? | most characters claimed, so level 1 everywhere |
| One item different from the rest? | one card with a pause note, one row with a long name |

What went wrong without it:
- **Mine had only "play".** Nobody wrote "playing" as a state, so a second tap
  played the recording again instead of stopping it.
- **Picking an old try showed nothing.** Only new tries were in the test data.
  30 of the learner's 97 tries were older ones, kept without the full answer.
- **The green "met" underline marked nearly every word.** The test database
  had few claims; the learner's account is mostly claims, and every claim is
  level 1.

### Look at the learner's real data, read-only

The dev database is not the learner's account. Before designing anything that
shows saved data, read what the account really holds. Use the standing admin
login and GET requests only, against `https://chinese-inky.vercel.app`: count
the shapes (how many rows lack a field, the longest value, the most common
value). Never write to production. Never point a dev server at it.

### Design it before building it

- **Draw it at 390 px** (the learner's iPhone) with the longest real label.
  375 and 430 are its neighbours. A layout that only fits at 1024 is not done.
- **Prefer fewer controls on a row.** Four level buttons on every word row
  pushed each row onto two lines on a phone. One button that steps 0→1→2→3→0
  did the same job in one cell.
- **Show what can be opened.** Anything that unfolds has a chevron that turns.
  The score circle unfolded the pace line, and nothing said it could.
- **Show the state a control is in.** A toggle reads its state (`aria-pressed`,
  a changed label: Hear / Stop). A play button that does not turn into Stop is
  a bug, not a style.
- **Every colour has a reason on the same card.** A character turned yellow
  with 100, 100, 100 on its card. It was marked for an extra sound *before* it,
  which the card never showed. If the reason is not shown, the colour must not
  be either.
- **One item's extra line must not resize its neighbours.** A "pause after"
  note on one card made every card in an equal-height row taller. Put
  per-item extras where they cost no shared height, or leave them out.
- **Nothing moves under the thumb after a tap.** Setting a level re-sorted the
  list and moved the row away. A filter dropped the row being edited. Sort
  once on opening, and keep a row under its filter until the filter changes.
- **A number and its bar count the same thing.** The Words part said "3 of 5
  known" while its bar counted something else (any word ever touched), and a
  text without a word list got Words for free. Write the counting rule in one
  sentence, show that sentence, and use one function for both.

## 2. Before committing

### See every state

For each state in your list, get the screen into it and look at the picture.
A passing test does not count as looking.

- `node scripts/check-screens.mjs <paths…>` screenshots each path at 375, 390,
  430, 768, 1024 and 1194 px, light and dark. It also flags faults:
  - the page wider than the screen, or a control past its edge;
  - a button label on two lines, or a row of buttons that wrapped;
  - text cut off;
  - more than one primary button.

  It exits 1 on a fault; lines starting with `~` are only to look at. Use
  `#click=Tries` (or `#click=<selector>`) to open a menu or sheet before the
  picture. A row allowed to wrap carries `data-wraps`.
- Open the pictures. The script finds overflow, not ugliness. It would not
  have seen a yellow character with three 100s.
- Get the states the script cannot reach with a short Playwright script:
  recording with a fake microphone (`--use-fake-device-for-media-stream`), a
  sheet open, a try picked from the list. To show an older data generation,
  POST a row of that shape to the dev database, then delete it afterwards.

### Drive every control through its transitions

For every control you touched, script and check:
- tap, tap again;
- let it finish by itself;
- start another control while it runs;
- leave the screen while it runs.

Print the labels after each step. For the dock that was:
`Hear → Stop → Hear`, `Stop … (line ends) … Hear`, `Mine → Stop`, `Mine then
Hear → Hear shows Stop, Mine shows Mine`.

### WebKit, not only Chromium

The learner uses Safari on an iPhone and an iPad. Two of the day's bugs showed
only there: the level choice running off the word drawer, and a footer whose
two buttons wrapped. Run `check-screens.mjs --browser webkit` on the Mac (or
`scripts/webkit-probe.swift`). When WebKit was not available, for instance in
a cloud session, say so in the report, and keep controls to fixed-size cells
that do not rely on how each browser sizes content.

### Read your own diff as its reviewer

Before staging, read the diff and ask:
- What state did I not list?
- Where else does the same pattern live? The other play buttons, the other
  sheet footers, the shelf's copy of the text's list.
- What does this do to the learner's existing data?

Then run the repo's checks: `npm test` and `npm run vercel-build`.

## 3. Fixing a bug

1. **Reproduce the reported state first.** A screenshot is a state: get the
   same screen, the same data, the same width. If it does not reproduce here,
   the data is different. Go and read the real data (read-only) before
   guessing. The empty try was found in a minute once the account was read:
   `full: false`, no per-character numbers.
2. **Name the cause, not the symptom.** Not "the cards are missing" but "the
   screen draws only from the whole answer, and older tries do not have one".
3. **Fix the class, not the instance.** Look for the same mistake elsewhere
   and fix those too. Fixing Mine's toggle meant also:
   - recording stops whatever is playing;
   - leaving the line stops it;
   - a character's own play button stops the narrator first.
4. **Add the test that would have caught it.** Use real data where you can
   (the regression test for old tries uses the learner's real saved try), and
   a script for the interaction when it is a UI bug.
5. **Look at the reported state again** after the fix, at the reported width,
   and at its neighbours.
6. **Never break what is already right.** The fix keeps the old data readable,
   keeps other sessions' work (commit on top of `origin/main`, never over it),
   and is minimal.

## 4. Saying it is done

Say what was seen and how:
- which widths, which theme, which browser;
- which states were scripted.

Say what was not seen ("not checked in Safari"; "only one narrator in the test
database"). Never say a change is done because it compiles, and never say it
works in Safari when it ran in Chromium.
