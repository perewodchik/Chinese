# Games

Small games for HSK 1–2, shown on `/play`. Each game is a mini-app: a folder
here and one line in `registry.ts`. Nothing else in the app needs to change —
not the router, not the store, not the navigation.

## What a game gets, and what it gives back

A game is a React component that receives `GameProps` (see `types.ts`):

- `ctx` — the library (`ctx.lib`), the band's words (`ctx.words`), which words
  have a photo (`ctx.pictureOf`), which texts have a native recording
  (`ctx.native`), what the learner knows (`ctx.known`), and a **seeded** random
  source (`ctx.rng`). Use `ctx.rng` for every random choice: the seed is in the
  address, so a reload replays the round and a test can pin one down.
- `report(result)` — call once per prompt, when it is settled (right, or
  missed after the second try).
- `finish()` — call when the game is over. The host records it, and shows the
  seal and every prompt that was missed.

The host draws the frame (leave button, name, progress dots), the results and
the seal. A game never touches the store or the router.

## The kit (`kit/`)

| | |
|---|---|
| `ChoiceGame` | the whole "look at this, pick one of 2–6" game — give it rounds and a way to draw the prompt |
| `useRounds` | the two-tries round state machine, for games that are not a choice |
| `Tiles`, `Feedback` | answer tiles, and the fixed-height line under a prompt |
| `Photo` | a word's photo in a square that keeps its size while loading |
| `useDrag` | finger / Pencil / mouse drag; drop point as shares of the stage |
| `pool.ts` | `pictureWords` (one word per photo, known words first), `leaning`, `pictureCount`, `gist` |
| `numbers.ts` | numbers as they are said, 两 before a measure word |
| `useGameKeys` | digits pick, Enter/Space for Next |
| `Seal` | the red seal |
| `fixture.test.ts` | `testContext(band, seed)` — a context built from the real data, for tests |

## Adding a game

1. Copy `_template/` to a new folder named after the game's id.
2. Write `content.ts`: a pure function from `ctx` to the rounds. Only HSK
   material up to `ctx.band`; photos only through `ctx.pictureOf`; native
   audio only for texts in `ctx.native` (never a synthetic voice for anything
   that teaches pronunciation).
3. Write `content.test.ts` with `testContext` — at least: a full game exists at
   each band the manifest claims, and the same seed builds the same rounds.
4. Write `Game.tsx` (most games are a `ChoiceGame`), and `game.css` scoped to
   the game's own class names.
5. Fill in `manifest.ts`. `available(ctx)` must not use `ctx.rng` — the round
   uses it, and a check must not change the round.
6. Add the manifest to `GAMES` in `registry.ts`.
7. Check it at iPad (768×1024) and phone (375×812) width, in dark mode, and
   with reduced motion. Nothing on the stage may move when a prompt is
   answered except what the answer is about.

## The ordering games (`order-kit/`, `order-<brand>/`)

The 点单 games copy real shops' WeChat mini-programs, and are the one
documented exception to "only HSK material" (R8 in
`docs/visual-learning/requirements.md`): a menu's words are whatever the real
app shows — 生椰拿铁, 不另外加糖, 取餐码 — because reading those is the skill.
Every Chinese string they show has a glossary entry (pinyin, English, a
note), and a test fails on one that does not. What they report is still only
HSK words. Inside the phone they look like WeChat, not paper (see
`order-kit/order-kit.css`). A new brand is a `menu.ts` of plain data — its
`model` (`chain`, `counter` or `table`), menu, option groups, fees, glossary,
tips and task templates — plus the usual manifest, a one-line `Game.tsx`, and
a `content.test.ts` that runs `brandSuite` from `order-kit/suite.test.ts`. The
plan is `docs/ordering-game/plan.md`.

Scoring: a game's result per prompt is right first time, right on the second
try, or missed. Games never reach the review schedule (see `domain/play.ts`).
