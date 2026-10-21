# Guidelines — how the app is kept good-looking and correct

What the redesign of October 2026 settled, written down so the next change
lands the same way. The look itself (tokens, type, colours, page parts) is the
`hanzi-design` skill; load it before styling anything. This file is the craft
around it: the rules that came out of real bugs and real complaints from the
learner, and how to check a change before it ships.

## The learner, in one paragraph

One person, HSK 1–2, 20–30 minutes a day, on an iPhone and an iPad in Safari.
Learns from texts: read, listen, translate, words, write, questions. Practises
with cards, a fixed number a day. Wants it calm and light, never a list of
debts, never a game that can be clicked through. Notices everything: a label
that shifts by 5px, a heading under the status bar, two blue buttons.

## Design craft

**Nothing moves when something is switched.**
- Keep the room for what can appear: render it hidden (`visibility: hidden`,
  `data-hidden`) rather than not at all. Pinyin keeps its width when switched
  off; the dictation's sentence keeps its height before it is shown.
- A label that changes ("Mark as read" / "Read", "Show all" / "Hide all")
  gets a `min-width` of the longer one.
- A row whose content arrives later (the voice chips) has a `min-height` from
  the start.
- Measure it: take the boxes before and after a toggle and compare
  (`textcheck.mjs`-style Playwright scripts did this for pinyin modes).

**Size things to what is on them.** A card stretched to the screen is an empty
frame on an iPad. Let the content set the height (with a floor), and pin the
actions to the foot of the screen, where the thumb is.

**One primary button a screen.** Second action `.btn.tonal`, third
`.btn.quiet`, destructive `.btn.danger`. A list of ten "Add" buttons is ten
tonal buttons. A "Learned/Known" state is tonal and `aria-pressed`, not
primary.

**Whole rows, not rows with a button.** A suggestion, a list, a printed sheet
to mark: the row is the link, with a chevron. Per-item actions sit on the item.

**Touch sizes** (under `(pointer: coarse)`): icon buttons 40px, segmented
controls 34–36px, chips 36px, anything used mid-exercise 44px. Line-number and
stroke-player buttons included.

**Words over marks.** Chinese marks (读听译词写问) are decoration; the
meaning is said in English next to them ("Text done. Next: listen.").

**Never show the machine.** No `npm run …`, no `claude auth login`, no
"server", no admin hints on a learner's screen. Say what to do in their terms
or say nothing.

**Copy.** Sentence case, curly apostrophes (don’t), dates written out
(`toLocaleDateString(undefined, { day: 'numeric', month: 'long' })`), numbers
with their commas (`toLocaleString('en')`), a singular for one ("Practise it
as a card"). Buttons say what happens.

**Overflow.** Fade what does not fit (`mask-image`) instead of cutting a
character in half; names wrap rather than ellipsis when the name is what
tells two things apart; grids use `minmax(0, 1fr)`; a modal body is one
`minmax(0, 1fr)` column, or a canvas that measures its width gets its own
width back.

**Phones.** Pages start below `--top-clear` (iOS blurs the status-bar band);
bottom sheets use `useSheetDrag` and lock the page behind
(`:root[data-sheet]`); the phone page ends 32px above the tabs.

**Meanings.** A character's gloss comes from the syllabus word when the
character is a word at the same level (`leadWithUse` in `data/load.ts`): 穿 is
"to wear", not the dictionary's first "to drill".

## Code craft

**Style.** Match the file: single quotes, prose comments that explain *why*,
long lines are fine. There is no Prettier config — never run `prettier` on a
file (a default run once rewrote a whole file with double quotes).

**Where things go.** Pure rules in `src/domain/` with a `*.test.ts` beside;
screens in `src/features/<area>/`; shared UI in `src/ui/`; addresses only
through `src/navigation/paths.ts`.

**Adding to the workspace** (anything synced to the account):
1. the type (`store/state.ts`, or `domain/text.ts` for a text's `study`);
2. the hydration whitelist in `store/migrations.ts` — validated and clamped,
   unknown values dropped;
3. how two devices merge it (`store/merge.ts`, or `mergeStudy`: `max` for a
   count or a time, union for a list);
4. a test. Bump `VERSION` only when the shape of old data changes.

**Account or device?** A choice about learning (which cards are asked, how
many a day) goes in the account's settings. A choice about the device (a
voice, the size of the copying squares, the iPhone's own Speak) goes in
`localStorage`, every access in `try/catch`.

**Removing a feature.** Delete the pages and what only they used; turn their
routes into `<Navigate>` to where the job lives now (`router.tsx`); remove
their `paths` helpers and the settings only they read; move the entry points
that still matter (marking a printed sheet went to Lists to print, sorting
words to the Cards tab); update `docs/backlog.md` and the README. Find what is
no longer reachable with an esbuild metafile from `src/main.tsx`.

**Speech on iOS.**
- Start speaking inside the tap that asked for it (`openDictation`, Listen's
  first line); after that, later lines may follow.
- Never `cancel()` between lines of one reading: Safari carries a cancel out
  late, on the next queued line. Queue (`speak(…, { queue: true })`).
- Let go of the run before cancelling (`halt()` in `readAloud.ts`): a cancel
  can fire the line's `end` at once.
- Keep a reference to the utterance; ignore `interrupted` as an end.
- Safari never lends a page the voices downloaded in Settings; the iPhone's
  own voice is reached by selecting text for the system's Speak.

**Keys on `window`.** A page-level handler (the reader's arrows) ignores keys
while a dialog, drawer or panel is open, while an input has focus, and Enter
or Space on a focused button.

**Scrolling.** `.main` scrolls, not the window; `useScrollRestoration` keeps
places by history entry and puts them back while slow content grows. In the
reader's two-column layout each column scrolls on its own.

## Checking a change

- `npm test` and `npm run vercel-build` (which runs `tsc -b`).
- Never the production database: a dev server with `HANZI_DB=.data/<copy>.db`
  and `HANZI_DEV_USER=admin`.
- Screens at 375, 768, 1024 (and 1194 for the reader), light and dark, with
  an overflow audit (anything wider than the screen or cut). Look at the
  screenshots, do not just run them.
- Interactions scripted in Playwright: toggles compared before and after, keys
  pressed with overlays open, sheets dragged with touch events.
- Sound without a voice: a fake `speechSynthesis` that, like Safari, carries a
  cancel out late — it caught the skipped lines and the pause that kept
  talking.
- WebKit is the learner's browser; Chromium is not. When a change touches
  speech, selection, sheets or the status bar, say it was not seen in Safari.
- For a bigger change, a tester's pass: go through every screen as a
  nitpicking user and list what is wrong before fixing any of it.
