# 走走 — architecture and content rules

The rules every 走走 change follows: where code goes (§1) and what content
must satisfy (§3–§9). Section numbers are kept from the original build brief so
references like "§5 budget" or "§4.4" in code and commits still resolve.
How to work (environment, git, UI rules) is in the repo's `CLAUDE.md` and
`src/world/CLAUDE.md`.

## 1. Architecture

```
src/world/
  core/        pure TypeScript, no Phaser, no React, no DOM — fully unit-tested
    types.ts       ids, WorldSave, NpcCard, Scene, DialogueNode, Quest, Item,
                   Spirit, Idiom, Stamp, District, MapRef, Station, Line …
    content.ts     zod schemas for every content file + loader/validator
    clock.ts       game clock (1 real minute = 1 game hour, paused on demand)
    save.ts        WorldSave reducer: actions → new save (immutable)
    merge.ts       merge two saves (monotonic union + latest-wins fields)
    migrate.ts     world save format version + upgrades (starts at 1)
    grid.ts        collision grid, A* pathfinding (4-dir), line of travel
    flags.ts       conditions: has flag / item / time window / chapter …
    quests.ts      quest steps, advancing, "what now?" text
    dialogue/
      source.ts      interface DialogueSource (§4.6)
      scripted.ts    ScriptedDialogue implementation
      match.ts       utterance → intent (hanzi / toneless pinyin, groups)
      universal.ts   再说一遍, 慢一点, X是什么意思, 听不懂, 谢谢, 再见 …
      normalize.ts   punctuation, full/half width, pinyin → candidates
    budget.ts      HSK word-budget validator for lines (§5)
    travel.ts      subway graph (lines, stations, transfers), routes, fares
    schedule.ts    opening hours, NPC routines by game hour
    ime.ts         built-in pinyin input: "nihao"/"ni3hao3" → candidates
  engine/      Phaser: scenes, rendering, input, camera, lights (no game rules)
  ui/          React overlay: top bar, dialogue, input bar, companion,
               tasks, bag, map, 图鉴, 成语 book, stamps
  sync/        world save client: local cache, scheduler, conflict merge
  content/     (see §6) compiled content is loaded from public/world/
src/features/world/WorldPage.tsx   route /play/world (lazy — Phaser is heavy)
server/…                           world_saves table, repo, service, routes
shared/world.ts                    DTOs shared by client and server
content/world/                     SOURCE content (maps as text, scenes JSON…)
scripts/world/                     build scripts: art, maps, content check
public/world/                      BUILT output: atlases, maps, content JSON
```

Rules:
- **All game rules live in `core/`** and are tested with `node --test`. The
  engine only draws and reports input; the UI only shows state and sends
  actions. A scene that plays wrong must be reproducible as a core test.
- **The game state is one `WorldSave` object** changed only through
  `save.ts` actions. Engine and UI read it; nothing else mutates it.
- **Phaser is loaded only on `/play/world`** (`React.lazy` + dynamic
  `import('phaser')`) so the rest of the app does not grow.
- Canvas draws the world; **everything with text is React DOM** over the
  canvas (crisp hanzi, word drawer, IME, speech recognition).

---


## 3. The content model (what `types.ts` must express)

- **District**: id, hanzi name, English name, maps, stations/stops, chapter
  that opens it, music/ambience.
- **Map**: id, size, tileset refs, layers, objects: `door` (to map+tile),
  `edge` exits, `sign` (hanzi text), `npc` spawn, `light`, `zone`
  (triggers), `spirit` spot, `bike` stand.
- **NpcCard** (used by scripts now and by Claude later): id, hanzi name,
  role, look (sprite + palette), voice persona, character (calm), what
  they know (facts), what they want, allowed actions, routine
  (hour → map+tile), `explains`: words they can explain in HSK 1 words.
- **Scene**: id, where, when (condition), NPC, dialogue graph, situation
  words, stamp on completion.
- **DialogueNode**: `say` (hanzi; pinyin generated at build and reviewed),
  optional `simpler` variant (for 听不懂 / 慢一点), `key: true` for 📌
  lines, `expect[]` (intent, match groups, next node, actions), `hint`
  (word / frame / full), `translate` (English), `why` (English notes),
  `onEnter`/`onExit` actions.
- **Actions**: flag, item give/take, money, quest step, stamp, spirit,
  idiom, unlock station/district, teleport, open 点单 game, sleep.
- **Quest**: id, title (English), steps with conditions, "What now?" text
  per step.
- **Spirit**: id, hanzi, pinyin, English, source (山海经 / folk), woodcut
  image (Commons public domain; reuse `scripts/images/` fetching, paced),
  legend in simple Chinese + English, how to befriend (灯谜 / request /
  name with tones), district.
- **Idiom**: 成语, pinyin, parts with glosses, meaning (English), story in
  simple Chinese + English, tier (basic / story), where heard.
- **Stamp**: id, place, design (drawn with the art pipeline).

## 4. Dialogue rules

4.1 Normalise input: trim, strip punctuation, full→half width; if the
input is pinyin, convert to toneless syllables; keep the hanzi too.

4.2 Match: an intent matches when **every group** in `match` has at least
one hit. A hit is a hanzi word from `segment()` equal to a group entry, or
(for pinyin input) the toneless pinyin of a group entry. Order and extra
words do not matter. Pick the intent with most groups matched; ties → the
first listed.

4.3 Voice input comes as hanzi. If hanzi fails but toneless pinyin of the
recognised text matches, **accept** and attach a note: "I heard 卖 (mài,
sell) — did you mean 买 (mǎi, buy)?" shown by the companion.

4.4 Universal intents in every node, before scene intents: 再说一遍 /
请再说一遍 (repeat), 慢一点 / 慢慢说 (slower + `simpler`), X是什么意思 /
X什么意思 (explain X — from the NPC's `explains`, else from the scene's
situation words, else the companion offers), 听不懂 / 我不懂 (simpler),
你好 / 谢谢 / 再见 / 对不起 (polite reply). Non-Chinese input →
`not_chinese`: NPC 「听不懂……」, companion offers the Chinese.

4.5 No match: NPC 「你说什么？」 (varies per NPC); after the 2nd miss the
companion shows the first hint step. Never a dead end: the third hint
step always gives a full sentence that works.

4.6 `DialogueSource`:
```ts
interface DialogueSource {
  start(scene: Scene, save: WorldSave): Turn;             // first NPC turn
  reply(state: DialogueState, utterance: Utterance): Turn; // may be async later
}
interface Turn { say: Line; intent?: string; actions: Action[]; end?: boolean; note?: string }
```
Design it so a future `LiveDialogue` can produce free lines **while key
lines, actions and quest progress still come from the script**.

## 5. Word budget (validator rules)

- Levels from `public/data/words.json` (2026 lists). Proper names and place
  names (listed per district) do not count.
- Normal line: HSK 1 free; **at most 1 HSK 2 word per line** and ≤ 15% of
  a scene's words; no HSK 3+.
- **Key line (📌)**: HSK 1–2 free; up to 3 HSK 3+ words **or** one 成语.
  At most one key line per scene. Every HSK 3+ word in it needs an
  `explains` entry on at least one other NPC within reach.
- **Situation words** of a scene/place are allowed at any level in any line
  of that scene; 3–8 per place; each needs an HSK 1 explanation and appears
  at least twice in the scene.
- The validator prints file, node id, the word and its level.

## 6. Content formats

6.1 **Maps as text** (so you can author them without the Tiled GUI):
`content/world/maps/<id>.map.txt` — a header (id, size, tilesets), then
one character grid per layer, plus `content/world/maps/<id>.objects.json`.
A legend file maps characters to tiles. `scripts/world/build-maps.ts`
compiles to `public/world/maps/<id>.json` **in Tiled's JSON map format**
(so the learner could open them in Tiled later) and validates: sizes,
unknown characters, doors pointing to existing maps/tiles, spawns on
walkable tiles.

6.2 **NPCs, scenes, quests, spirits, idioms, stamps**: JSON in
`content/world/<district>/`, validated by the zod schemas, compiled into
one file per district in `public/world/content/<district>.json` with
pinyin added (from the dictionary; polyphones need a manual `pinyin`
override — the checker lists lines where a polyphone is guessed).

6.3 Run order: `npm run world` (add the script) = art → maps → content →
check. Built files are committed so Vercel does not need the tools.

## 7. Save

7.1 `WorldSave` holds everything in concept §13 ("Что сохраняется"),
plus `version`, `updatedAt`, `deviceId`.

7.2 When to save: after each dialogue, map change, ride, find, purchase;
while walking at most every 30 s; on `visibilitychange` hidden /
`pagehide`. Local copy first, then server.

7.3 Merge on conflict: union of flags, completed scenes, spirits, idioms,
stamps, visited districts, stations, NPC memory entries, pinned riddles
(solved wins); quests → the further step; place, facing, clock, bag,
money, settings → from the save with the later `updatedAt`.

7.4 Words the learner keeps go to the app's normal collection
"Words from Beijing" through the existing store (`src/store/wordCommands.ts`
/ collections), not into the world save.

## 8. Beijing reference (real places, simplified)

Districts, buildings and chapters: concept §2–§3. Use real station
names: 南锣鼓巷 (6/8), 鼓楼大街 (2/8), 什刹海 (8), 天安门东 / 天安门西 (1),
王府井 (1), 前门 (2), 天坛东门 (5), 雍和宫 (2/5), 三里屯 area → 团结湖 (10)
or 东大桥, 国贸 (1/10), 奥林匹克公园 (8), 颐和园 by bus (concept §5),
潘家园 (10), 北京北站 → 八达岭长城 by train. Keep the network small but
true: real lines at real transfer stations.

## 9. Look (Pokémon Black/White spirit — concept §12)

16×16 tiles, ¾ top-down, bright but soft palette with 2–3 shades per
surface, dark outline on characters and props (not on ground/walls),
characters 16×32 with big heads, semi-transparent shadows all falling the
same way, lively idle animation. Integer scaling only, no smoothing. Night:
blue tint + warm lights. Beijing colours: grey brick and tile (胡同),
red walls and yellow roofs (故宫), green-blue painted eaves, red lanterns.

---

