# S — how to deepen a chapter (for S2–S10, written by S1)

Read first: `prompt.md` §13 "S" (the rules for all of S), `story.md` (your
chapter's table, the cast sheet, §4 conventions), `facts.md`, and chapter 1
as the worked example: `content/world/gulou/quests.json` (`ch1`, 18 steps),
the `c1-*` scenes in `gulou/scenes.json`, `gulou/cutscenes.json` (`c1-drum`),
`books/shishizi.json` and `books/chenzhong-mugu.json`, and
`scripts/world/chapter1.test.ts`.

## 1. The hand-off contract (nobody changes another chapter's start)

A chapter **starts** when the chapter before it finishes: the last quest's
`reward` sets the next chapter number and moves the next main quest to its
**first step id**. That pair is fixed; the table is the contract.

| # | Chapter | Quest id | Folder (owner) | First step id (fixed) | Its `reward` must be |
|---|---|---|---|---|---|
| 1 | 新家 | `ch1` | gulou (S1) | `meet-wang` | `chapter 2`, `ch2/go-houhai` |
| 2 | 水与山 | `ch2` | houhai (S2) | `go-houhai` | `chapter 3`, `ch3/go` |
| 3 | 书 | `ch3` | wangfujing (S3) | `go` | `chapter 4`, `ch4/go` |
| 4 | 回声 | `ch4` | tiantan (S4) | `go` | `chapter 5`, `ch-xianghuo/go` |
| 5 | 香火 | `ch-xianghuo` | xianghuo (S5) | `go` | `chapter 6`, `ch5/go` |
| 6 | 新北京 | `ch5` | sanlitun (S6) | `go` | `chapter 7`, `ch6/go` |
| 7 | 故事 | `ch6` | yiheyuan (S7) | `go` | `chapter 8`, `ch7/ticket` |
| 8 | 龙 | `ch7` | tiananmen (S8) | `ticket` | `chapter 9`, `ch-guonian/go` |
| 9 | 过年 | `ch-guonian` | gulou/quests.json (S9) | `go` | `chapter 10`, `epilogue/ticket` |
| 10 | 尾声 | `epilogue` | changcheng (S10) | `ticket` | `chapter 11` |

- **Never** rename or delete a quest id or a step id, anyone's. Never change
  another chapter's quest, its reward or its first step. If you need
  something from another chapter, ask for it in §5 (hooks) and read it as a
  condition; don't edit their files.
- Your chapter's own steps you may reorder only by **adding** steps; the
  existing ones keep their order.
- `ch-xianghuo` and `ch-guonian` are one-step **placeholders** today (their
  step `go` is done by `{"chapter": N}`, so they finish on arrival and hand
  on). S5/S9 replace the placeholder step: keep the id `go` for the first
  step and keep the reward exactly as above. A save that already passed a
  placeholder has that chapter *done*; say in your design note whether you
  do anything for it (e.g. a side quest that retells it) — you may not reopen
  a finished main quest.
- A main chapter the save has already passed but never started opens by
  itself on load (`openMissedChapters`, `core/quests.ts`). That is how an old
  save in 新北京 gets 香火 — beside the chapter under way, never instead.

## 2. Adding steps

In your chapter's quest (`<district>/quests.json`, indent 2):

```json
{ "id": "list", "now": "…what to do, in English, with the Chinese it needs…",
  "past": "…one line in the past tense for the Journal…",
  "where": "siheyuan-yard", "when": "after dark",
  "done": { "flag": "c1-got-list" }, "onDone": "c1-drum" }
```

- **A save keeps its step.** A quest's place is its step **id**
  (`stepIndexOf`); the stored index is refreshed on load (`reindexQuests`).
  So steps you add *before* a save's step count as done (the Journal dates
  them by the next step reached), and steps *after* it are simply ahead. **No
  save bump is needed to add steps.** Bump the save only for a new *field*
  (the next number above main's at landing, one upgrade step in
  `migrate.ts`, a line in STATUS Decisions).
- **Don't make an old step wait for a new flag.** A save past your new step
  never got its flag. To keep order for new players, gate an *old* scene with
  "not at one of the new earlier steps":
  `{"all": [<its old condition>, {"not": {"quest": "ch1", "step": "list"}}, …]}`
  (`lantern` and `lion-night` in gulou/scenes.json do this). An old save is
  never at those steps, so nothing changes for it.
- **The same goes for items.** A save past a new step never got what it gives: a later step (new or old) must not *need* it. If it would, write a second scene for the save without it (S3: `c3-home` gives 王阿姨 the scarf; `c3-home-plain` is the homecoming without one — the golden save `mid-ch3` caught this).
- **Money for a purchase step:** give a free way for a player who can't pay (S3's `c3-gift-poor`: the shop's giveaway), or the spendthrift solver run fails.
- A new step's scene is gated on its own step: `"when": {"quest": "chN", "step": "<id>"}`,
  `"once": true`, `"priority": -5` (lowest priority wins, so it beats the
  person's everyday scenes; a shop's generated scene is 4).
- **Vary what a step asks** (ask the way, buy at a real shop with the
  phone, read something back, listen and choose, tell someone, use an item,
  a photo `{"photo": "<map>:<object>"}`, a gift). Chapter 1 has one of each.
- **Money:** a step may send the player shopping only if the chapter gives
  the money (王阿姨 hands over 20 元 for her list) or the price is tiny; the
  solver's `spendAll` run must still finish.
- Every line follows §5: `npm run world:check` names each word over the
  budget. The usual fixes: a situation word in the scene's `words` said **at
  least twice**, a hard word only in the `key` line (one per scene), or an
  easier word. A new hard word needs someone's `explains` in `npcs.json`.
- The hint's `why` is where 兔儿爷 points at the book: "It's in 《石狮子》,
  page 3: …" — help stays free; the book is the reason to read, never a gate.

## 3. Books and cutscenes

**Books** — `content/world/books/<id>.json` (id = pinyin of the title, see
`books/shishizi.json`). Facts first: every claim gets a row in `facts.md`
with a source, then the book lists the fact ids. 6–10 pages of ≤ 60
characters, a faithful English page by page, the last one 「今天的北京」.
Books 1–4 are HSK 1–2 plus at most six glossed `words` (they must appear on a
page); from chapter 5 on HSK 3 may be ≤ 10 %. `world:check` levels every
page; `words`/`names` absorb what it flags. Give it on the route with
`{"do": "book", "id": "<id>"}` in a node's `onEnter`; a save that already
played past that scene gets it on load (`owedBooks`). The **next step needs
something the book says**, and the hint's `why` names the page.

**Cutscenes** — `<district>/cutscenes.json` (indent 1), ids:
`ch<N>-open` / `ch<N>-finale` (quest numbers, as the existing ones),
`memory-<n>` (story.md §1.3), anything else `c<N>-<name>`. Fields: `map`,
`chapter` (the chapter *number*, for Journal → Story's ▶), `title`,
`letterbox`, `music`, `cast`, `steps`, `then` (actions when it ends —
the cutscene `c1-drum` sets the flag its step waits for), `finale: true` for
a chapter's last (90 s instead of 40 s). Start one from a node
(`{"do": "cutscene", "id": …}`, runs when the talk closes), from a step
(`"onDone"`), or by itself on arrival (`"auto": <condition>`, `"on": <map>`).
An opening that plays by itself on arriving at a map (`auto` + `on`) takes that arrival: if the map also has an `auto` arrival scene (后海's `houhai-arrive`), name it in the cutscene's `talk` so it follows the cutscene, or it never runs and a step waiting for it is stuck (S2 found this). A key line (`key: true`) pins itself as a riddle — solve it (`{"do": "solve", "riddle": "<scene>/<node>"}`) where the player shows they understood it.
The spirit-return cutscene is automatic when a spirit comes home; the
**memory** (王阿姨 by the lantern) is yours: an `auto` cutscene on
`siheyuan-yard` with `{"spirit": "<your spirit>"}`, like `memory-1`. Lines
in cutscenes follow §5 too, and nothing in a cutscene asks the player to do
anything. Cast actors must stand on walkable tiles of the cutscene's map.

## 4. Proving a chapter: the solver and the golden saves

- `scripts/world/solver.ts` plays the whole game through the core with each
  line's hint. To watch just your chapter, run a file like this with `npx tsx`:
  ```ts
  import { solve } from './scripts/world/solver';
  const r = solve(undefined, 40000, (s) => !!s.quests.ch2?.done);
  console.log(JSON.stringify(r.save.quests.ch2), r.short, r.log.join(' '));
  ```
  It must finish every quest, never pay money it lacks (`short` empty), and
  the `spendAll` run must finish too (`solver.test.ts`).
- The solver only walks maps whose **district chapter** ≤ the save's
  chapter; a step on a map of a later district is unreachable for it.
- `content/world/test-saves/` are **old** saves: `chapter-N.json` (v1, at
  the start of each old chapter) and `mid-ch1.json`, `mid-ch5.json` (v15, in
  the middle of a chapter, made with the content before S1). Each must read
  through the migration and play to the end of the main story. **Don't
  regenerate them** — they are the proof that old saves survive. If your
  change breaks one, the change is wrong, not the save. You may *add* a
  `mid-chN.json` made with main's content before your change
  (`solve(undefined, 40000, goal)` with a goal at your chapter's middle step)
  — it is the best test that your steps keep a save's place.
- Also write your chapter's walk in `scripts/world/chapter1.test.ts` (each
  chapter has a `describe` there): scene by scene, the step after each.
- Before landing: `npm test` (≈ 10 min; the golden saves are the slow part),
  `npm run world:check`, `npx tsc -b`, `npm run vercel-build`; rebuild what
  you touched (`world:content`, `world:maps`, `world:art`, `world:minis`);
  play your chapter in the pane from a save at its start.

## 5. Id namespaces (ids are one namespace across the whole city)

| Chapter | Scenes, flags, cutscenes | Owner's folder |
|---|---|---|
| 1 | `c1-…` | gulou |
| 2 | `c2-…` | houhai, jingshan |
| 3 | `c3-…` | wangfujing, qianmen |
| 4 | `c4-…` | tiantan, yonghegong |
| 5 | `c5-…` | xianghuo (+ yonghegong's two temple maps, shared with S4: add, don't edit) |
| 6 | `c6-…` | sanlitun, aoyun |
| 7 | `c7-…` | yiheyuan, panjiayuan |
| 8 | `c8-…` | tiananmen |
| 9 | `c9-…` | gulou (after S1), plus a scene or two anywhere the city needs |
| 10 | `c10-…` | changcheng |
| substories | `sub-<who>-<n>…` (story.md §4) | the district of the episode |

- **Step ids** only need to be unique inside their quest; use plain words.
- **Your content goes in your own folder, even when it happens on another
  district's map** — a scene's `map` and a cutscene's `map` may name any map,
  and a scene may use any person. 王阿姨 phoning you in chapter 3 is a scene in
  `wangfujing/scenes.json`; the chapter-4 memory at the lantern is a cutscene
  in `tiantan/cutscenes.json` on `siheyuan-yard`. That way parallel sessions
  never edit the same file. The exceptions: map objects (a new person or
  sign on a map) go in that map's `content/world/maps/<map>.objects.json` —
  add at the end of the array, don't reorder; and `facts.md`, `story.md`,
  `STATUS.md`, where you add rows, never rewrite others'.
- **New people and items** get plain ids (`gulou-ayi`, `niunai`); grep
  every `npcs.json`/`items.json` first — `world:check` fails on a clash, and
  the later lander renames theirs. A new item needs a sprite in
  `scripts/world/art/gen/items.ts` (then `npx tsx scripts/world/art/generate.ts`
  and `npm run world:art`), else the bag shows a gift box.
- A new spirit is `content/world/<folder>/spirits.json`; the lantern's
  figure ids are fixed in `core/celebrate.ts` `LANTERN_FIGURES`:
  `shihou` (石猴, S5) and `zaowang` (灶王爷, S9) must use exactly those ids.
  `STORY_SPIRITS` in `ui/card.ts` (7 today) goes up by one with each.

## 6. What chapter 9 (过年) needs from the others

S9 runs in the same wave as S2–S8, so these are **promises**: each owner
sets them, S9 reads them as conditions and must also work when one is
missing (a chapter that is still a placeholder).

| Hook | Set by | How S9 reads it |
|---|---|---|
| 小军 is coming home | S8, at the end of `ch7` (finale / memory 8): flag **`xiaojun-coming`** | ch9's opening says so; if missing (old save), 王阿姨 says it herself |
| the call to 小军 | `story-wang` (side, gulou, exists) | ch9 offers it again at its start if `{"quest": "story-wang", "done": true}` does not hold |
| 小军's parcel | S6: flag **`c6-parcel`** (a note from 小军 inside) | a line at 年夜饭 remembers it; optional |
| the figures lit | each chapter's spirit (`spirits` in the save): `shishizi` `jiuweihu` `menshen` `qilin` `shihou` `pixiu` `nianshou` `long` | `litFigures()` — "every figure lit but one" when 小军 arrives; `zaowang` lights at 除夕 |
| 石猴 | S5's spirit id **`shihou`** | as above; a placeholder 香火 means it is missing: S9's line must not claim it |
| 老刘's brush | the 地书 mechanic (exists, side-dishu / trace nodes) | 春联 with 老刘 |
| 包饺子 | `side-jiaozi` (gulou, exists) | folded into ch9 by S9 (S9 owns gulou after S1) |
| substory finales at the 庙会 | U1 (胡半仙), U2 (老马 & 老牛) — wave 3 | S9 leaves a step **`miaohui`** in `ch-guonian` whose scene U1/U2 can join with `{"quest": "ch-guonian", "step": "miaohui"}` |
| the calendar | `core/calendar.ts` knows 春节 (week 5) and 元宵 but no 小年 / 除夕 | S9 adds them (and their weeks) to `FESTIVALS`; Q2's 睡到… takes a player there |
| 尾声 after 过年 | S10 reads `{"quest": "ch-guonian", "done": true}` only through the reward chain above | — |

### Smaller hooks between neighbouring chapters
- `c1-yandai/b` — 兔儿爷's 「听说后海那儿，也有一个小神……」 at the 烟袋斜街 sign is
  a pinned riddle; **S2** solves it (`{"do": "solve", "riddle": "c1-yandai/b"}`)
  when the fox is found.
- 小明 (xiaoming) is at school 8:00–16:00 (his routine) — a step that needs
  him says so in `when`.

## 7. Landing

Your own worktree and branch; tick your S box and add your morning note
(Russian, a paragraph at the top of "For the learner") and your Decisions /
Problems lines (prefixed with your task id) in the same commit; bring main in,
regenerate built files instead of merging them, rerun every check, then
`git -C <main checkout> merge --ff-only <your branch>`. Never force-push,
never `update-ref main`, never push to GitHub.
