# Visual learning — requirements for C, D and E

Written 2026-09-24. Parts **A2** (radical families) and **B** (word pictures)
are being built now; this file holds what is still to come, so it can be picked
up later without re-deciding it.

- **C — Play**: children-style mini-games for HSK 1–2, built as pluggable
  mini-apps so new ones can be added without touching the rest of the app.
- **D — Interactive stories**: scenes you can tap, stories with choices, and
  dialogues drawn as comics.
- **E — Seeing it**: a wall of characters that fades like ink as you forget
  them, and mouth diagrams for the sounds that are hard.

Everything here builds on what B delivers: the **word picture pack**
(`public/images/words/`, one real photo per picturable word, with a manifest and
CREDITS) and the **compound pictures** (火 + 车 = 火车).

---

## 0. Rules that hold for all three

| # | Rule | Why |
|---|------|-----|
| R1 | **iPad first, phone must work.** Every screen is checked at 768×1024 and 375×812. Tap targets ≥ 44px mid-game (children style: prefer 56–72px). No horizontal page scroll. | The learner practises on the iPad over Vercel. |
| R2 | **No layout shift.** Controls render from the start (disabled while loading); labels that change have a fixed width; pictures reserve their box before they load (`aspect-ratio`). | See memory "stable-compact-ui". |
| R3 | **No extra cost.** No paid APIs. Anything Claude produces must also work through the copy-paste relay on the iPad (i.e. it is JSON text, never a binary). Images and audio are built on the Mac and shipped static. | Subscription-only rule. |
| R4 | **Native voices only** for anything that teaches pronunciation (listen-and-pick games included). A word without a native clip is not offered in a listening game. Designed voices are only for conversation partners. | See memory "native-voices-and-personas". |
| R5 | **Design language.** Tokens only (`var(--…)`), dark mode works, one accent (cinnabar = pronunciation + primary action), right = jade, wrong = accent, nearly = gold. **Never colour-code tones.** Children style may be *warmer and bigger* inside the game stage, not louder: rounded 20–24px tiles, soft paper shadows, small (≤ 180ms) scale/opacity motion, no bouncing loops, no confetti storms. Respect `prefers-reduced-motion`. | `.claude/skills/hanzi-design`. |
| R6 | **Picture after retrieval, not as the prompt** when the thing being tested is reading hanzi. Games whose *point* is the picture (listen → picture, picture → word) are fine because the picture is the answer, not a hint. | Pictures as prompts teach reading the picture. |
| R7 | **Offline-tolerant.** Once the data and the images are cached a game runs without network. Results queue in the store like everything else. | The store already syncs and merges. |
| R8 | **Only real HSK material.** Games draw from the 2026 HSK 1–2 word list (`words.json`, `hsk ≤ 2`) and the characters those words are written in; nothing invented. | The learner is HSK 1–2. |
| R9 | **Honest scoring.** A game never claims more than it measured: a tap in a 4-option game is not "you know this word". See §C.6 for what may reach the schedule. | Reviews must mean something. |

---

## C. Play — mini-games as mini-apps

### C.1 Goals

1. A **Play** section with a grid of small games for HSK 1–2, children-style:
   big pictures, big targets, short rounds (8–12 prompts, ≤ 3 minutes), a stamp
   at the end.
2. **Extensible**: a new game is a folder plus one line in a registry. No edits
   to the router, the store schema, the navigation or other games.
3. Every game is **deterministic from a seed**, so a round can be replayed,
   tested and linked to.

### C.2 Where it lives

| Address | What |
|---|---|
| `/play` | Grid of games (`.drill-grid` / `.drill-card`, mark hanzi + name + blurb + "last played / best"). Filter chips: HSK 1 · HSK 2 · all. Games that cannot run (not enough material, no images yet) are shown disabled with the reason in one line. |
| `/play/:gameId?band=1&n=10&seed=abc` | One round of one game. `seed` is optional; the page writes the one it used into the URL (replace) so a reload replays the same round. |

Navigation: a **Play** entry in the main bar (or under Review until the bar has
room — decide when building, keep the bar one line).

### C.3 The mini-app contract

```ts
// src/games/types.ts
export interface GameManifest {
  id: string;                 // 'where-is-it' — URL-safe, never renamed
  name: string;               // 'Where is it?'
  mark: string;               // one hanzi for the card: '哪'
  blurb: string;              // one sentence, second person, no emoji
  bands: (1 | 2)[];           // which HSK bands it has material for
  teaches: GameTopic[];       // 'place-words' | 'measure-words' | 'time' | ...
  needs?: ('images' | 'native-audio' | 'mic' | 'drag')[];
  /** can this game run for this learner/band? returns a reason when not */
  available(ctx: GameContext): { ok: true } | { ok: false; reason: string };
  /** lazy — each game is its own chunk */
  load(): Promise<{ default: React.ComponentType<GameProps> }>;
}

export interface GameContext {
  lib: Library;               // characters + words
  images: WordImages;         // from B: word → picture (+ credit), compound parts
  voices: NativeVoices;       // word → native clip, or none
  known: Set<ItemId>;         // learned / in rotation, for weighting
  band: 1 | 2;
  rng: Rng;                   // seeded
}

export interface GameProps {
  ctx: GameContext;
  rounds: number;
  /** the host shows progress dots and the results screen from these */
  report(r: RoundResult): void;
  finish(): void;
}

export interface RoundResult {
  prompt: string;             // what was asked, for the results list
  items: ItemId[];            // the words/characters involved
  correct: boolean;
  firstTry: boolean;
  ms: number;
}
```

- **Registry**: `src/games/registry.ts` exports `GAMES: GameManifest[]`. The
  router has one route (`play/:gameId`) that looks the id up; unknown id → the
  Play grid with a notice.
- **Folder per game**: `src/games/<id>/manifest.ts`, `Game.tsx`,
  `content.ts` (pure: builds the rounds from `ctx` + seed), `content.test.ts`,
  optional `game.css` (scoped under `.game-<id>`).
- **Shared kit** in `src/games/kit/`:
  - `GameFrame` — header (name, ✕ quit, progress dots), stage, footer; results
    screen (score, the prompts missed with their picture + word + `<Say>`,
    "Play again" / "Another game").
  - `useRounds` — round state machine: `asking → answered(right|wrong) → next`,
    with a "try again once" rule (first-try tracked separately).
  - `ChoiceTiles` — 2–6 big tiles (picture, hanzi, or both), keyboard digits.
  - `Drag` / `DropZone` — pointer-events drag that works with finger and
    Pencil, snaps into zones, never scrolls the page while dragging
    (`touch-action: none` on the stage only).
  - `WordPicture` — the B picture for a word with a reserved box and a
    fallback (the hanzi on a card) when a word has no picture.
  - `Stamp` — the red seal awarded at the end (see C.5).
  - `rng.ts` — seeded PRNG (mulberry32), `shuffle`, `pick`, `sample`.
  - `distractors.ts` — same-topic distractors (never an option that is also
    correct; never two options with the same picture).
- **Adding a game** (checklist, to be kept in `src/games/README.md`):
  1. Copy `src/games/_template/`.
  2. Fill `manifest.ts`, write `content.ts` + a test for it.
  3. Add the manifest to `registry.ts`.
  4. Check at iPad and phone width, dark mode, reduced motion.

### C.4 Games to build first (HSK 1–2)

Each game lists its material (all from the HSK 1–2 list), the mechanic, how it
is checked, and what makes it done.

#### C.4.1 在哪儿 — Where is it? (place words)
- **Material**: 上面 下面 里面 外面 旁边 前面 后面 左边 右边 (HSK 2), objects
  with pictures: 桌子 椅子 杯子 书 书包 床 猫 狗 苹果 手机 (HSK 1–2).
- **Mechanic**: a scene with a big anchor object (桌子). A sentence in hanzi
  (pinyin on tap): 「猫在桌子下面。」 Drag the cat to where the sentence
  says. Variant B (reverse): the scene is already arranged; pick the sentence
  that describes it (3 options).
- **Checking**: the drop zones are computed from the anchor's box (above /
  below / inside / left / right / in front / behind — front/behind drawn as
  overlap with a slight scale). Pure function `zoneOf(point, anchorBox)`.
- **Assets**: object cut-outs. Photos from B do not cut out cleanly, so this
  game uses the picture on a rounded card as the draggable token, and a simple
  drawn anchor (table, box, bed) as SVG in `src/games/where-is-it/props/`.
- **Done when**: all 9 place words appear across a 10-round game at band 2,
  only 上/下/里/外 at band 1; zone tests cover every word.

#### C.4.2 几个 — Measure words by shape
- **Material**: 个 本 件 口 块 杯 张 条 只 位 间 次 (only those on the list), and
  the words that take them (from `words.json` field `cl`).
- **Mechanic**: a picture of 3 books → fill 「三＿书」 by tapping 本 / 张 /
  条 / 个. The explanation card after answering shows the shape rule with small
  drawings: 张 flat, 条 long and bendy, 本 bound, 杯 in a cup, 件 clothes and
  matters, 口 people in a family, 只 animals.
- **Checking**: correct = the word's first `cl`; 个 is accepted as "works, but
  sounds childish" (gold) when it is not the first.
- **Done when**: every word with a picture and a `cl` on the list is a
  possible prompt; numbers are 一 to 十 and 两 (two before a measure word is 两,
  and the game says so when 二 is attempted in a free-input variant later).

#### C.4.3 几点了 — What time is it?
- **Material**: 点 分 半 刻? (刻 is not HSK 1–2 → leave out), 上午 中午
  下午 晚上 早上, numbers.
- **Mechanic**: an analogue clock (SVG) + four time phrases; or the reverse —
  drag the hands to 「下午三点半」.
- **Checking**: hour and minute to the nearest 5 minutes; 上午/下午 decided
  from a sun/moon cue next to the clock.

#### C.4.4 多少钱 — At the shop
- **Material**: 块 元 毛? (毛 is not on the list → only 块/元), 钱 多少 贵
  便宜 买 卖, food words with pictures (苹果 牛奶 面包 鸡蛋 茶 咖啡 饺子 包子).
- **Mechanic**: a price tag 「苹果：七块」; drag coins/notes (1, 5, 10, 20,
  50, 100 块) into the tray until it matches. Later level: two items, "which is
  cheaper?" 「哪个便宜？」.

#### C.4.5 连一连 — Picture pairs (memory game)
- **Material**: any picturable HSK 1–2 word (from B).
- **Mechanic**: 12 face-down cards (6 pairs: picture ↔ hanzi). Flip two; a
  match stays open and plays the native clip if there is one. Children's
  classic, good for first exposure.
- **Checking**: pairs found and number of flips; no "correct/wrong" per item
  goes to the schedule (it is exposure, see C.6).

#### C.4.6 听一听 — Listen and tap the picture
- **Material**: only words with a **native** clip in `public/voices` (R4) *and*
  a picture.
- **Mechanic**: hear the word (replay button), tap one of 4 pictures.
- **Checking**: first tap counts.

#### C.4.7 拼一拼 — Build the character
- **Material**: HSK 1–2 characters with two top-level parts (`parts.length ===
  2`) where both parts are drawable (radical outlines or characters).
- **Mechanic**: the meaning + picture of the word it is read in is shown; drag
  two parts from a tray of 5 into the ⿰ / ⿱ frame (the frame comes from
  `ids`). 女 + 子 → 好, 日 + 月 → 明. Links to the radical family page (A2)
  in the results.

#### C.4.8 火 + 车 = ? — Compound maker
- **Material**: the compound pictures from B (every two-character word whose
  parts have literal glosses).
- **Mechanic**: two part-pictures with their hanzi (火 fire + 车 car) → pick
  the resulting word's picture from 4. Reverse level: see 火车's picture, pick
  the two parts.

#### C.4.9 句子火车 — Sentence train
- **Material**: the example sentences in `words.json` (`ex`) that use only
  HSK 1–2 words and have 3–6 words after segmentation (`segment.ts`).
- **Mechanic**: train cars with a word each, shuffled; drag them into order.
  The engine can only be the subject — a cue that Chinese puts time and place
  before the verb.
- **Checking**: exact order match against the original; any alternative that
  is also grammatical is not accepted in v1 (say so on the result).

#### C.4.10 一家人 — Family tree
- **Material**: 爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 爷爷 奶奶 儿子 女儿 丈夫 妻子 我.
- **Mechanic**: a family tree with 我 in the middle and photos in the other
  slots; drag the word cards onto the people (older/younger shown by height).

#### C.4.11 颜色 — Colours
- **Material**: 红色 白色 黑色 绿色 颜色 (only those on the list).
- **Mechanic**: an outline picture and 「把苹果画成红色」 — tap the paint pot,
  tap the object. (This is the one place colour *is* the content; tones are
  still never coloured.)

#### C.4.12 反一反 — Opposites
- **Material**: 大/小 多/少 冷/热 上/下 前/后 左/右 早/晚 远/近 快/慢 高/— 贵/便宜
  好/坏 长/— 买/卖 来/去 开/关? (关 not HSK 1–2 → drop), 对/错 新/— (only pairs where
  both halves are on the list).
- **Mechanic**: a seesaw: one side shows 大 with a picture; drop the opposite on
  the other side from 4 cards.

Later candidates (not v1): weather board (天气 下雨 雪 晴 阴 热 冷), calendar
(星期 几月几号 生日), body parts (头 手 眼睛 身体), numbers bingo with native
clips, 找不同 (spot the difference in two described scenes).

### C.5 Rewards

- A round ends with a **red seal stamp** (印章) pressed onto a card: the game's
  mark hanzi in seal style. 3 levels by first-try accuracy: faint (≥ 50%),
  clear (≥ 80%), gold rim (100%). One accent colour — the stamp is the "one red
  stamp" the design already talks about.
- A **stamp book** at the top of `/play` shows the stamps collected per game
  (best level). No streak pressure, no lives, no timers by default; a timer is
  an opt-in "quick" mode per game.

### C.6 What reaches the memory / schedule

- By default **nothing is scheduled** by a game. Results are stored per game
  (`plays`, `best`, `lastPlayed`, `stamp`) and per item as **exposure**
  (`seenInGames` counter) for stats.
- A game may declare `counts: 'read-word'` only if its prompt shows the hanzi
  and hides the meaning (e.g. C.4.6 does not qualify — it shows pictures after
  hearing). Such a game passes first-try results to the existing "Read it"
  schedule exactly like the word drill (grade = right first try → good,
  wrong → again). v1: no game declares it; decide per game after trying.

### C.7 Store

- New synced field `games: Record<gameId, { plays: number; best: number; stamp:
  0|1|2|3; last: number }>` and `exposure: Record<ItemId, number>`.
- Migration adds empty objects; `hydrate` must **keep unknown game ids** (a
  newer build may add games — the same lesson as the word ids being dropped by
  `isCharId` filtering, see memory "word-learning-decisions").
- Merge rule across devices: `plays` sum-of-deltas is overkill; take max for
  `plays`, `best`, `stamp`, `last`.

### C.8 Acceptance for the Play section

- [ ] `/play` grid lists every registered game; disabled ones say why.
- [ ] Adding `src/games/_template` copy + registry line shows a working game
      with no other file changed (verified by doing it once in review).
- [ ] Each game's `content.ts` has a seeded test; the same seed builds the same
      rounds.
- [ ] Drag works with finger, Pencil and mouse; the page does not scroll while
      dragging; nothing jumps when a round advances.
- [ ] Dark mode, reduced motion, 375px width checked for every game.
- [ ] Listening games offer only words with native clips.

---

## D. Interactive stories

The reader already imports passages written by Claude as one JSON code block
(relay-friendly). D extends that JSON; nothing needs a new service.

### D.1 Tap-able scenes (sprite scenes)

- **What**: a passage can carry a *scene* per paragraph. The app draws it from
  its own parts: a background (8–10 line-art rooms: 家 kitchen/bedroom,
  学校 classroom, 商店/超市, 饭店, 公园/路上, 医院, 车站/机场, 办公室) and
  word pictures from B placed on it.
- **Schema** (added to the passage JSON, optional):
  ```json
  "scenes": [{
    "para": 0,
    "bg": "kitchen",
    "things": [{ "w": "杯子", "x": 0.32, "y": 0.61, "s": 1 }],
    "people": [{ "who": "chen", "mood": "speaking", "x": 0.7, "y": 0.5 }],
    "ask": { "q": "杯子在哪儿？", "w": "杯子" }
  }]
  ```
  `w` must be a word that has a picture (the brief lists them); `who` is a
  persona id; coordinates are 0–1 of the stage. Validated with zod; unknown
  words/people are dropped, never fatal.
- **Prompt**: the brief gains a section "Scenes (optional)" listing available
  backgrounds and picturable words; only asked for when the text options
  include "with pictures".
- **Interaction**: tap a thing → the word drawer (`?item=w杯子`). If `ask` is
  set, after the paragraph a one-line question appears; tap the right thing
  (checks `w`). Results are exposure only (C.6 rule).
- **Rendering**: an SVG/HTML stage with fixed aspect ratio (4:3), reserved
  before images load; the reader's "holds still" rule applies — the scene sits
  above its paragraph and never resizes the text.
- **Done when**: a passage with scenes imports through the relay, renders on
  iPad and phone, and a passage without scenes is unchanged.

### D.2 Choose-your-path stories

- **What**: a new genre `branching`. 6–8 nodes, 2–3 choice points; choices
  written in Chinese using only known characters (+ the passage's teach set).
- **Schema**:
  ```json
  { "genre": "branching", "start": "a",
    "nodes": { "a": { "lines": [...], "choices": [{ "zh": "喝茶", "to": "b" }, { "zh": "喝咖啡", "to": "c" }] },
               "b": { "lines": [...], "end": "good" } } }
  ```
  `lines` use the existing line shape (hanzi + pinyin + translation), so the
  reader's pinyin, tap-for-word and read-aloud all work unchanged.
- **Validation**: every `to` exists; every node reachable from `start`; at
  least one `end`; no cycles longer than the story (loops back are allowed only
  to a choice node); the existing coverage check (`coverageOf`) runs over the
  union of all nodes.
- **UI**: the current node's lines, then the choices as big buttons (hanzi,
  pinyin under). A small path map (dots and lines, current node filled) in the
  header; endings found are collected as stamps on the text's card.
- **Persistence**: path taken and endings found per text in the store (synced).
- **Done when**: a branching text imports via the relay, every ending can be
  reached, and "read" is marked when any ending is reached.

### D.3 Dialogues as comics

- **What**: the existing `dialogue` genre gains a **comic view** toggle: each
  line is a speech bubble from a portrait (`Portrait.tsx`, the talk personas),
  alternating left/right, with the portrait's mood (`speaking` while its line
  is read aloud).
- **Speakers**: the passage JSON may name `speaker` per line (persona id or a
  free name); without it, lines alternate between two default faces.
- **Voice**: read-aloud uses the voice setting the reader already has; no new
  audio rules.
- **Done when**: any existing dialogue passage can be shown as a comic with no
  change to its data, and the toggle is remembered per device.

---

## E. Seeing it

### E.1 The ink wall (memory made visible)

- **What**: every character (or word) of a band as a tile in a grid; the ink of
  each tile is as dark as it is held *now* (retrievability from the schedule),
  so forgotten ones visibly fade. Not-yet-met ones are outlines. Tap → drawer.
- **Where**: inside the progress drawer another session is building
  (`src/domain/progress.ts`, `src/features/library/ProgressDrawer.tsx`) — as a
  tab or a section "The wall". Coordinate with that work before starting.
- **Data**: `masteryOf(book[id], now).score` → ink opacity 0.18–1, in 5 steps
  (not continuous — five steps read better and do not shimmer as time passes).
  Toggle: characters / words; band chips.
- **Rules**: one grid, `minmax(0,1fr)` columns, 40px tiles on phone, 52px on
  iPad; no colours besides ink (R5); a small legend with the five steps.
- **Done when**: 248 HSK 1 characters render in < 50ms on the iPad, tiles are
  stable (no reflow on refresh), and the wall agrees with the drawer's numbers.

### E.2 Mouth diagrams for the hard sounds

- **What**: side-view (sagittal) diagrams in the sound lessons for j/q/x vs
  zh/ch/sh vs z/c/s, ü vs u, -n vs -ng, r. Two diagrams side by side with the
  difference named ("tongue tip down behind the lower teeth" vs "tip curled
  up").
- **Source**: adapted from the IPA sagittal diagrams on Wikimedia Commons
  (check each file's licence; record in `public/voices/CREDITS.md` or a new
  `public/images/CREDITS.md`). **Not drawn from imagination** — accuracy
  matters more than style.
- **Style**: redrawn as single-weight line SVG using `currentColor`, the moving
  part (tongue) in the accent colour — it *is* the pronunciation, so R5 allows
  the accent.
- **Where**: the "mouth" card of `SoundLessonPage` (`/speaking/sounds/:lesson`).
- **Done when**: every lesson whose sound depends on tongue/lip position has a
  diagram pair, each with a credit line, and the page does not shift when the
  SVG loads (inline SVG, no fetch).

---

## Order of work (suggested)

1. C framework (types, registry, kit, `/play`) + C.4.5 memory pairs (simplest,
   proves the kit) + C.4.1 在哪儿 (proves drag).
2. C.4.2 measure words, C.4.8 compound maker (uses B directly), C.4.6 listen.
3. D.3 comics (cheap), then D.2 branching.
4. E.1 ink wall once the progress drawer has landed.
5. D.1 scenes, E.2 mouth diagrams, the remaining games.
