# Development standards: from a request to a finished feature

How work is done here, so that it comes out professional the first time:
- how a big task is cut into small steps;
- how each step is built, checked and fixed before the next one starts;
- the standards the code, the tests and the commits are held to.

Companion documents:
- `docs/making-changes.md`: listing states, seeing them, fixing bugs;
- `docs/guidelines.md`: the settled design and code rules;
- the `hanzi-design` skill: the look;
- `README.md` › Layout: the folders and the rules between them.

The rule under all of it: **a step is not finished until it has been seen
working in every state it can be in.** Building the next step on an unchecked
one is how one bug becomes five.

## 1. From a request to steps

### 1.1 Write the brief (five lines, before anything else)

- **Who and when:** the learner, on which device, in which part of their 20–30
  minutes.
- **The job:** what they can do afterwards that they cannot now, in their words.
- **Done looks like:** one or two sentences a person could check by looking.
- **Not in it:** what this change deliberately leaves alone.
- **Open questions:** only decisions that are the learner's to make. Ask those
  once, together. Settle everything else from the code, the data and these
  documents.

Example. "Set a word's level quickly in Read." Who: on the iPhone, going down
a text's word list. Job: mark ten words in a minute without opening each one.
Done: one tap per word on its row, the row stays put, the text's marks follow.
Not in it: the drawer's picker, Cards.

### 1.2 Write the spec

For a change bigger than one control, write it out first. Use the commit
message, or a note in the feature's own doc (`docs/speak-v2.md` is the model).

- **States:** the table from `making-changes.md` §1, filled in. Include every
  data generation that exists in the account.
- **Data:** what is stored, where (account or device), how old data reads,
  and how two devices merge it.
- **Screens:**
  - at 390 px and at 1024 px;
  - with the longest real content;
  - every label written out in its final words, not "TBD".
- **Rules:** each rule the screen shows, in one sentence that the code then
  implements once. For example: "a word counts as done once it is Known or
  Solid, or on the list".

### 1.3 Cut it into steps

Each step is a **vertical slice**:
- it runs end to end;
- it can be committed and pushed without breaking anything;
- the learner either does not see it yet, or sees something finished.

Guides:
- **Small:** one idea per step, usually under ~300 changed lines and one to
  five files. A step that needs "and" in its commit title is two steps.
- **In this order**, because each layer is checked before the next leans on it:
  1. the rule, in `src/domain/`, with its tests;
  2. storage: the type, the hydration whitelist, merge, and a round-trip test;
  3. the server route, if any, with its test in `server/test/`;
  4. the screen's main path, seen at 390 and 1024, light and dark;
  5. the other states: empty, loading, error, old data, the longest content;
  6. transitions and interplay: second tap, ends by itself, another control,
     leaving;
  7. polish: copy, spacing, the WebKit look.
- **Behind a switch when the whole is not useful yet.** A setting that is off
  by default (`speakV2` behind Settings › Speak) lets the steps land on `main`
  without the learner meeting half a feature.
- **Write the steps down** as a checklist, in the task list or in the
  feature's doc. Tick each one only when it is checked.

Example: the 0–3 levels, cut as they should have been:
1. `levelOf` and its tests, including a claim, a lapse, and a long-overdue
   item.
2. One shared level mark and its CSS tokens, seen alone at every width.
3. Library tiles and drawers use it; checked against the learner's real
   distribution (mostly claims).
4. Read: the passage marks; checked on a text with real data before choosing
   what to mark.
5. Setting a level by hand: the action, hydration and a round-trip test, then
   the drawer control in WebKit.
6. Row controls in Read: one control, rows that do not move, a filter that
   keeps the row.

Each of these was a separate commit, and each would have caught its bug before
the next step built on it.

### 1.4 The loop for every step

```
build  →  check  →  fix what the check found  →  check again  →  commit  →  next step
```

- **Build** only what the step says.
- **Check** with the routine in `making-changes.md` §2:
  - every state of the step, seen;
  - every control driven through its transitions;
  - `scripts/check-screens.mjs` on the screens it touches;
  - the touched tests;
  - `npm run vercel-build`.
- **Fix** everything the check found, in this step. A bug is not left for
  later because it is small.
- **Stop the line:** a bug found in an earlier step is fixed, with a test,
  before the current step goes on.
- **Commit** the step on its own (§4), then push.
- **Note** what the next step is, and anything this one taught that changes
  the plan.

### 1.5 When the last step is in

- **A tester's pass over the whole feature.** Use it as the learner would: on
  the phone width, from the place it is reached, with real data. List
  everything wrong before fixing any of it.
- **Fix the list** in small commits, each with its regression test or script.
- **Update the feature's doc** and `docs/backlog.md` with what is open.
- **Report** (§6).

## 2. Code standards

### 2.1 Types and structure

- **TypeScript is strict** (`strict`, `noUnusedLocals`,
  `noUnusedParameters`). Never use `any`.
  - `!` only where an invariant holds, with the reason on the line.
  - `as` only at a boundary: parsed JSON, a DOM event.
- **A state is a type, not a set of booleans.** One `sounding: 'hear' | 'mine'
  | null` cannot be in two states at once; `hearing` and `playingMine` can.
  Every value of a state type has a place in the states table.
- **Layers keep their place** (README › Layout):
  - `src/domain/`: pure rules, no React, no DOM, no storage;
  - `src/store/`: actions, reducer, commands, migrations;
  - `src/platform/`: browser APIs (audio, speech, files);
  - `src/features/<area>/`: screens;
  - `src/ui/`: shared components;
  - addresses only through `src/navigation/paths.ts`.
  - On the server, `http` calls `application`; `application` uses ports;
    `infrastructure` implements them.
- **One job per unit.** A component over ~300 lines, or one doing two jobs, is
  split. A rule used in two places is one function, and both places call it:
  the Words bar and its label disagreed because they did not.
- **No dead code.** When something is replaced, delete the old version, its
  CSS, its props and its imports in the same step.

### 2.2 State, effects and async work

- **One source of truth.** Store what was said and done; derive the rest
  (levels from recall, counts from lists). A derived value that is stored goes
  stale.
- **Every effect cleans up.**
  - Sound stops when its screen goes or the item changes.
  - Timers are cleared.
  - Listeners are removed.
- **A late answer is checked against the current item** before it is shown.
  The `current.current === asked` pattern: a score that comes back after Next
  belongs to the line before.
- **Every promise is handled.** A failure becomes a message in the learner's
  terms, with the next step to take. Never an unhandled rejection, never a
  silent nothing.
- **Things that play have a lifecycle.** Starting one stops the others, and it
  ends when the sound ends, by any route: end, stop, error, leaving.
  `playLine` returns a promise that settles on any of these, so the button can
  follow it.

### 2.3 Data the learner owns

- **Old data reads forever.** Every generation of a stored shape is handled
  and tested, including rows moved over from a device (`local-p-…`), rows
  without the service's whole answer, and fields added later.
- **Adding a field to the workspace** follows the four steps in
  `guidelines.md` › Adding to the workspace (type, hydration, merge, test).
- **Never drop or rewrite the learner's data** to make code simpler. Bump
  `VERSION` only when the shape of old data changes, and test the migration.
- **Production is read-only** for development: GET with the admin login to
  learn what is there. Never write to it, and never point a dev server at it.

### 2.4 Server and API

- **Every input is validated** (zod) and bounded: length, count, size. Every
  route checks the session.
- **Keys and secrets** live in the site's settings on the server. Never in the
  repo, the client or a log.
- **Errors are typed** (`ValidationError`, `NotFoundError`, `AppError`) and
  reach the client as a message the screen can show.
- **A route has a test** in `server/test/` against in-memory SQLite.

### 2.5 UI code

- **Colours, sizes and type come from the tokens.** No hard-coded colour, so
  dark mode is right by construction.
- **Controls:**
  - fixed sizes for labels that change;
  - room kept for what can appear;
  - touch targets per `guidelines.md`.
- **Accessibility:**
  - `aria-pressed` for a toggle, `aria-expanded` for what unfolds;
  - `role="radiogroup"` and `role="radio"` for a choice of one;
  - a label on every icon button;
  - keys ignored while a dialog or an input has focus.
- **Performance:** work over the whole library is memoised on what it reads,
  never done per row per render. Images and canvases have their size before
  they load.

### 2.6 Style, names and comments

- **Match the file:** single quotes, long lines allowed. Never run Prettier;
  there is no config, and a default run rewrites the file. No drive-by
  reformatting.
- **Names say what it is in the learner's terms:** `wordDone`, `levelOfWord`,
  `mineSamples`, not `flag2` or `data`.
- **Comments are prose that explain why:** the reason, the trap, the bug it
  prevents. Not what the next line does.
- **No new dependency** without a reason written in the commit. Versions are
  pinned.

## 3. Testing standards

| Layer | What is tested | Where |
|---|---|---|
| Rules | every rule, its edges, and one fixture shaped like the learner's real data | `src/domain/*.test.ts` |
| Workspace | each action through the reducer, and a save-and-load round trip | `src/store/*.test.ts` |
| Server | each route: good input, bad input, signed out | `server/test/` |
| Controls | each transition, scripted in Playwright, labels printed per step | a probe script, kept when reusable |
| Screens | every width, light and dark, with the overflow audit | `scripts/check-screens.mjs` |
| People | the tester's pass over the finished feature | §1.5 |

- **A test is named for the behaviour** ("a slip in writing does not undo what
  you said about reading it"), and fails for one reason.
- **Every bug gets the test that would have caught it**, in the same commit as
  the fix. Use the real data that showed it where possible.
- **Running tests:**
  - While iterating, run the touched files:
    `node --import tsx --test src/domain/x.test.ts`.
  - Before pushing a step, run the full `npm test` (about 12 minutes; never
    two copies at once) and `npm run vercel-build`.
  - Not everything has a test: a UI-only change that no test covers is
    checked with its script and screenshots. Say so in the report.
- **Never weaken a test to make it pass.** If the expectation was wrong, say
  why in the commit.

## 4. Commits and working beside other sessions

- **One step per commit.**
  - The title says what changed for the learner.
  - The body says why, and what was checked.
  - Never mix two concerns, and never commit a red build.
- **Commit from a private index, on top of `origin/main`** (the
  compare-and-swap recipe in `CLAUDE.md`).
  - Stage explicit paths only.
  - Before committing, compare your files with `origin/main`. If another
    session changed one of them, merge by hand; never overwrite.
  - Make it a check that stops the commit, not a step to remember. Committing
    a file whole on top of a newer `main` replaces every change made to it
    since your copy was taken. On 5 November that took out two other
    sessions' work: per-account storage on a shared iPad, and a cast's
    voices. So, with `B` the commit your copy is based on:
    ```bash
    git fetch -q origin main
    test -z "$(git diff --name-only $B origin/main -- <your paths>)" || echo "MERGE FIRST"
    ```
    Merge each listed file with `git merge-file <yours> <B's> <origin's>`
    (conflicts by hand), build and test the merge, then commit.
- **Generated files** (`public/world/…`, `stamps.gen.ts`) are rebuilt, never
  edited or merged by hand.
- **No `reset --hard`, no force-push,** and nothing rewritten that someone
  else committed. Sync a stale working copy with a stash, which can be
  undone.

## 5. Definition of done

A step or a feature is done when all of these hold:

- [ ] The brief's "done looks like" is true, seen on screen.
- [ ] Every state in the table was seen: empty, loading, error, old data,
      longest content, one-different-item.
- [ ] Every control was driven: tap, tap again, ends by itself, another starts,
      leaving.
- [ ] `check-screens.mjs` is clean on the touched screens at every width,
      light and dark, and the pictures were opened.
- [ ] Seen in WebKit, or the report says it was not.
- [ ] Rules have tests, the bug has its regression test, old data has its
      fixture.
- [ ] `npm test` and `npm run vercel-build` pass.
- [ ] No dead code, no second primary button, no hard-coded colour, no layout
      shift.
- [ ] Committed on its own, on top of `origin/main`, and pushed.

## 6. Reporting

Report to the learner in their language, briefly:
- what changed, in their terms;
- what was checked, and how;
- what was not checked;
- anything they now need to decide.

Never "done" because it compiles. Never "works in Safari" when it ran in
Chromium.
