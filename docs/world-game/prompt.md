# Build: 走走 Zǒuzou — a Pokémon-style walk through Beijing

> **You are the builder.** This file is the whole brief. The design is in
> `docs/world-game/concept.md` (Russian, written with the learner — every
> decision in it is final). Your progress lives in
> `docs/world-game/STATUS.md`.
>
> **You work unattended, possibly across several sessions** (the learner is
> asleep; your session may stop when a usage limit is hit and be resumed
> hours later with only "continue"). So:
> 1. **Start every session by reading §0 below, then `STATUS.md`,** and pick
>    up at the first unchecked task. Do not redo checked tasks.
> 2. **Never wait for an answer.** If something is unclear, decide the way
>    the concept points, write the decision under "Decisions made without
>    the learner" in STATUS.md, and carry on.
> 3. **Work in small tasks and commit after each one** (§0.4), then tick it
>    in STATUS.md in the same commit. A session can die at any moment;
>    whatever is committed survives.

---

## 0. Ground rules (read every session)

### 0.1 Environment
- Node: `export PATH=/opt/homebrew/bin:$PATH` before any npm/npx command
  (the default nvm node is too old).
- Tests: `npm test`. Types + build: `npm run vercel-build` (runs `tsc -b`;
  `npx tsc --noEmit -p .` checks nothing — do not trust it).
- **Dev server uses the PRODUCTION database** unless told otherwise. Always
  run previews with `HANZI_DB=.data/world-test.db`. Use the preview config
  `hanzi-workshop-mac-5175` (or 5174) from `.claude/launch.json`, adding the
  env var; never 5173 (another session may own it). It runs without watch —
  restart after server edits. `HANZI_DEV_USER` signs you in automatically.
- The Browser pane is Chromium; the learner uses Safari on iPad. For layout
  and canvas checks also run `scripts/webkit-probe.swift`
  (`swiftc -O scripts/webkit-probe.swift -o .cache/webkit-probe`, then
  `.cache/webkit-probe <url> <width> <script.js>`).

### 0.2 Other sessions share this checkout
Other Claude sessions edit and commit in the same working tree on `main`.
There are uncommitted files that are not yours (e.g. `src/platform/install.ts`,
`src/features/settings/InstallCard.tsx`, `public/manifest.webmanifest`,
`index.html`, `src/main.tsx`, `src/styles.css`, `SettingsPage.tsx`) — never
stage, revert or reformat them. If you must edit a file someone else also has
uncommitted edits in (e.g. `src/styles.css`, `src/features/play/PlayPage.tsx`),
commit **only your hunks**.

### 0.3 Never
- Never `git add -A`, `git add .`, `git add -u`, never force-push, never
  rewrite commits.
- **Never push.** The learner reviews in the morning and pushes. (A push
  deploys to Vercel and runs your migration on the production Postgres.)
- Never write to the production DB; never bump the *workspace* format
  version (`src/store/migrations.ts`) — the world save has its own.
- Never use ripped Nintendo/Pokémon (or any other game's) graphics or
  sounds. Only CC0 / CC-BY / public domain assets, credited, plus art you make.
- Never add API costs: no paid APIs, no API keys. Live Claude dialogue is
  NOT part of this build (only its interface, §4.6).
- Never ask the learner anything. Decide and log.

### 0.4 How to commit (private index — the shared index may hold others' work)
```bash
export PATH=/opt/homebrew/bin:$PATH
IDX=/private/tmp/world-idx; rm -f $IDX
GIT_INDEX_FILE=$IDX git read-tree HEAD
# for each file wholly yours:
GIT_INDEX_FILE=$IDX git update-index --add --cacheinfo 100644,$(git hash-object -w PATH),PATH
# for a shared file: build a copy = `git show HEAD:PATH` + only your edits,
# hash-object -w that copy, update-index with it.
GIT_INDEX_FILE=$IDX git diff --cached --stat   # every path must be yours
GIT_INDEX_FILE=$IDX git commit -m "走走: <what> …"   # end with the attribution line below
git reset -q -- <the paths you committed>     # re-sync the shared index
```
Binary files (PNG, OGG) use the same `--cacheinfo 100644,...`. End each
commit message with:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
Before every commit: `npm test` and `npm run vercel-build` pass. If a
failure is in someone else's uncommitted code, not yours, note it in
STATUS.md and commit anyway (verify your files type-check).

### 0.5 Standing UI rules from the learner
- **No layout shift.** Controls render from the start (disabled while
  loading). Changing labels have fixed width. Images/canvas sit in boxes
  sized before they load.
- **Compact one-line toolbars** (`nowrap`, ~28px chips, horizontal scroll).
  Per-item actions sit on the item.
- **Help is free.** No penalties, no "help used" marks anywhere.
- A **tap on a word** opens the app's word drawer (`src/navigation/itemDrawer.ts`).
- UI language: **English**. The companion speaks English. Meanings in
  English.
- Check every screen at **375px, 768px and 1024px** width.
- Load `.claude/skills/hanzi-design/SKILL.md` before styling any React UI.

### 0.6 Read once at the start of the build (and again when a task touches them)
1. `docs/world-game/concept.md` — the design. **It wins over anything here
   except §0.**
2. `src/features/play/PlayPage.tsx`, `GamePage.tsx`, `src/games/README.md`,
   `src/games/kit/` — how Play looks and how 点单 goes full screen on phones
   (commits `cf4cc88`, `cd6205d`).
3. `src/domain/segment.ts` (word cutting), `src/domain/words.ts`,
   `public/data/words.json` (HSK 2026 levels `t1`…`t7`),
   `src/domain/pinyin/` (pinyin tools).
4. `src/platform/audio/recognition.ts` (speech → hanzi),
   `src/platform/audio/voiceOut.ts`, `src/ui/Say.tsx`.
5. Server: `server/src/application/workspace-service.ts`, `ports.ts`,
   `server/src/infrastructure/{sqlite,postgres}/` (migrations are
   append-only, kept identical), `server/src/http/routes/workspace.ts`,
   `shared/api.ts`, `server/test/workspace.test.ts`, `server/test/pglite.ts`.
6. Client sync: `src/store/sync/{engine,outbox,page}.ts`.

---

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

## 2. Tasks — in order

Each task ends with: tests for what it adds, `npm test` +
`npm run vercel-build` green, a commit, the box ticked in STATUS.md.
Phases A–F are the **MVP**. After F, continue with G onward.

### Phase A — core logic (no graphics yet)
- **A1 Setup.** Add `phaser` (latest stable) as a dependency. Create the
  folder skeleton from §1, `shared/world.ts`, and `content/world/README.md`
  explaining the content formats (§6). Commit.
- **A2 Types + content schemas** (`types.ts`, `content.ts`): everything in
  §3 and §6 as types and zod schemas. Tests: a valid fixture passes; each
  kind of broken fixture fails with a readable path.
- **A3 Clock** (`clock.ts`): game minutes since start, day number, hour,
  part of day (morning 6–11, day 11–17, evening 17–21, night 21–6),
  pause/resume, `sleep()` → next day 7:00. 1 real minute = 60 game minutes.
  Tests for boundaries and pause.
- **A4 Save reducer + migrate** (`save.ts`, `migrate.ts`): actions for move,
  enter map, set flag, give/take item, money, start/advance/finish quest,
  pin/solve riddle line, meet NPC, NPC memory, befriend spirit, learn idiom,
  stamp, unlock station, visit district, settings, clock tick. `version: 1`.
  Tests for each action and for upgrade from an older fixture.
- **A5 Merge** (`merge.ts`): §7.3 rules. Property-style tests: merge is
  commutative for the monotonic parts, never loses a found spirit, idiom,
  stamp, flag, station; latest `updatedAt` wins place/clock/bag.
- **A6 Grid + A\*** (`grid.ts`): walkable grid from map layers, doors,
  NPC blocking, path to a tile or to "next to" an NPC/object, facing.
  Tests incl. unreachable targets (return nearest reachable).
- **A7 Conditions + quests + schedule** (`flags.ts`, `quests.ts`,
  `schedule.ts`): condition language (all/any/not, flag, item, hour range,
  chapter, quest step), quest step advance, "What now?" text for the
  companion, opening hours and NPC routines. Tests.
- **A8 Dialogue** (`dialogue/*`): `DialogueSource`, `ScriptedDialogue`,
  matcher, universal intents, normalizer (§4). Tests with real phrasings:
  "请问地铁站怎么走" / "地铁在哪儿" / "ditie zai nar" / "di4tie3 zai4 na3r"
  all → `ask_subway`; 卖 for 买 → match with a "heard as" note; English
  input → `not_chinese`; "附近是什么意思" → explanation of 附近.
- **A9 Word budget** (`budget.ts`) + `scripts/world/check-content.ts`
  (also run from a test so `npm test` fails on bad content): §5 rules.
- **A10 Travel** (`travel.ts`): simplified Beijing subway — lines 1, 2
  (loop), 5, 6, 8, 10 with the real station names you need for the districts
  (§8) and real transfer stations; route finder (fewest transfers, then
  stops); bus routes to 颐和园 / 潘家园; train to 长城. Tests.
- **A11 IME** (`ime.ts`): pinyin syllable splitter (with or without tone
  numbers, `v`/`ü`, `r` endings), candidates from `words.json` +
  characters, HSK 1–2 first, then by frequency. Tests.

### Phase B — saves in the database (cross-device)
- **B1 Server.** New migration (append a step — never edit shipped ones) in
  **both** `sqlite/migrations.ts` and `postgres/migrations.ts`:
  ```sql
  CREATE TABLE world_saves (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    save       TEXT NOT NULL,
    updated_at BIGINT NOT NULL   -- INTEGER in SQLite, as the other tables
  );
  ```
  `WorldSaveRepository` port + SQLite + Postgres implementations,
  `WorldSaveService` with the **same revision rule** as `WorkspaceService`
  (refuse a stale base revision, return the current save; refuse an older
  `version` as outdated app). Size limit (e.g. 512 KB). Routes
  `GET /api/world` and `PUT /api/world` behind the existing auth guard.
  Tests in `server/test/world.test.ts` for SQLite and pglite, mirroring the
  workspace tests.
- **B2 Client sync** (`src/world/sync/`): local copy in `localStorage`
  (key per user, wrapped in try/catch), load = newer of local/server,
  save scheduler (§7.2), on conflict: `merge()` then retry, offline queue,
  flush on `visibilitychange`/`pagehide`. Unit tests with a fake server.

### Phase C — art pipeline and the prototype
- **C1 Palette + pixel builder.** `scripts/world/art/`: one palette in the
  Pokémon Black/White spirit (§9). A text format for sprites: a grid of
  palette letters per frame (`.px` files), compiled by
  `scripts/world/art/build.ts` to PNG atlases + JSON frame maps in
  `public/world/art/`. Include a `recolour` step that maps any imported
  PNG onto the palette. Tests for the parser.
- **C2 Free packs.** Look for 16×16 top-down packs with **CC0 or CC-BY**
  licenses (Ninja Adventure, Kenney RPG Urban / Roguelike packs,
  OpenGameArt). Read each license page; download only what fits; store the
  originals under `content/world/art/vendor/<pack>/` with their license
  file; list them in `public/world/CREDITS.md`. If a license is unclear —
  skip the pack. If nothing usable is found, draw everything yourself
  with C1 — that is allowed and fine.
- **C3 Beijing modules (drawn by you):** grey brick wall, 胡同 lane,
  red door with 门墩, 四合院 roof tiles (grey), palace wall (red), yellow
  glazed roof, eaves, columns, stone steps, lantern (lit/unlit), 槐树,
  bicycle, 三轮车, subway entrance sign. Characters 16×32, 4 directions,
  3–4 walk frames: the hero, 兔儿爷 (small, floats beside the hero), and
  6 NPC bases with palette-swap variants.
- **C4 Prototype scene:** one 胡同 street and the 天安门 gate front,
  rendered by the engine skeleton (D1 minimal) at 1024×768 and 390×844, day
  and night. Save screenshots to `docs/world-game/review/` and write in
  STATUS.md what looks weak. **Do not wait for approval** — continue; the
  learner reviews in the morning. If it is clearly below "Pokémon Black"
  quality, spend one more task improving it before Phase D.

### Phase D — engine
- **D1 WorldPage + Phaser boot.** Route `/play/world` (add to
  `src/navigation/paths.ts`, lazy). Full screen on phones like 点单
  (site top bar hidden below 690px). Canvas fills the box; integer scale
  (×3 on iPad, ×2–×4 by size), pixel-perfect (`pixelArt: true`,
  `roundPixels`). Loading state that does not shift layout.
- **D2 Maps.** Load compiled maps (§6.1), layers: ground, below, collide,
  above (drawn over the hero), objects (doors, signs, NPC spawns, lights,
  zones). Camera follows the hero with lerp, clamps to the map.
- **D3 Movement.** Tap-to-move with A* (dotted path flash), tap on NPC →
  walk next to and face → `talk`, tap on sign/object → walk and `look`,
  hold → walk toward finger, double tap → run, pinch → zoom 0.75–1.5,
  keyboard arrows/WASD, Space/Enter, Shift, M, B, Tab. Optional on-screen
  joystick (off by default). Tile-by-tile movement with smooth tween.
- **D4 Doors and transitions.** Edge exits and doors → fade → next map,
  position and facing kept in the save.
- **D5 Life.** NPCs idle (blink, turn), walk routines from `schedule.ts`,
  ambient crowd walkers on busy maps, pigeons, bicycles.
- **D6 Light and time.** Part-of-day tint, lights (lanterns, windows,
  street lamps) glowing at evening/night (Phaser lights or additive
  sprites — whichever runs smoothly on iPad Safari), soft shadows.
  Weather hook (snow/rain particles) — off for now.
- **D7 Performance.** Only the current district's assets in memory;
  60 fps target on iPad, 30 fps floor; pause the game loop when the tab
  is hidden or a full-screen panel is open.

### Phase E — overlay UI (React)
- **E1 Top bar:** place name (hanzi; 拼 on tap), clock icon + time, 🗺 🎒 📜.
  One line, fixed widths.
- **E2 Dialogue:** bubble over the bottom of the world (world does not
  move), NPC name + portrait, hanzi line with words tappable (word drawer),
  拼 toggle (remembered), 🔁 replay, scrollable history. 📌 key lines have a
  pin mark and go to 📜.
- **E3 Input bar:** `[🎤|⌨] [field / hold-to-talk] [💡] [➤]`. Voice: hold
  to record via `recognition.ts`, show hanzi + pinyin, auto-send after
  1.5 s, tap to edit or cancel. Keyboard: native field (system Chinese
  keyboard works) + built-in pinyin IME candidate row (§A11). The choice is
  remembered per device and in the save's settings. If speech recognition
  is unavailable, the 🎤 side is disabled with a one-line reason.
- **E4 Companion 兔儿爷:** button in the corner; action row
  Again / Translate / Why? / What do I say? (3 steps) / What now? / Keep.
  English text. Speaks up by itself only after 2 misunderstood lines in a
  row or 60 s idle during a quest step — one short line.
- **E5 Panels:** 📜 tasks and pinned riddles; 🎒 bag (items, 交通卡, money);
  🗺 Beijing map (districts, visited stations, quests, route hint +
  "Go" to the nearest station); 图鉴 (spirits: woodcut image, name,
  legend in simple Chinese with 拼 and unknown-word marks); 成语 book
  (§7 of the concept; printable through the existing print flow if it is
  cheap, else leave a TODO); stamps passport. All as sheets over the
  world; world paused while open.
- **E6 Settings** inside the game: input mode, 拼 default, joystick,
  text size.
- **E7 The /play card** (concept §13): first on `/play`, above 点单,
  labelled **Game**. Full-width pixel banner that follows the saved game
  clock (4 variants: morning/day/evening/night — render them with the art
  pipeline), title 走走 Zǒuzou · *Walk Beijing*, one progress line
  (chapter · spirits · 成语 · stamps), where you stopped, **Continue** /
  **Start**. Fixed aspect ratio, no shift; progress from the cached save
  first, then the server. At 375px the progress line collapses to icons.

### Phase F — content for the MVP
- **F1 District 1: 鼓楼 · 南锣鼓巷.** 4–5 street maps (南锣鼓巷 main lane,
  side 胡同, 鼓楼/钟楼 square, the lane to the subway), interiors:
  your 四合院 (room + courtyard), 早点铺, 小卖部, 理发店, 茶馆, public
  toilet (sign only), subway station 南锣鼓巷 (lines 6 and 8).
- **F2 NPCs:** 10–12 with cards (§3): 王阿姨 (landlady), the 早点铺
  owner, the old man with a bird cage, a kid, the barber, the 茶馆 owner, a
  delivery rider, tourists, a 三轮车 driver, the 小卖部 owner, two
  passers-by with one-liners.
- **F3 Chapter 1 scenes** (concept §3, §10): arrival and 王阿姨, the
  broken lantern and 兔儿爷, breakfast (豆浆 油条 包子, 多少钱), asking
  the way, 交通卡 at the station, the rumour of the stone lion → spirit
  石狮子 (灯谜 to befriend), idioms 马马虎虎 and 一心一意 (one of them
  in a 📌 key line), 5–6 stamps. Situation words where the place needs
  them (§5).
- **F4 The subway ride** to 天安门东: buy/tap card, the platform, the
  train with announcements "下一站：……", get off, the square and the 故宫
  gate from outside (inside locked: "you need a ticket" — sets up ch. 7).
- **F5 MVP check:** play chapter 1 end to end in the preview (1024 and
  390 widths) and in WebKit; save on one "device", load in a fresh
  profile → same place. Screenshots to `docs/world-game/review/`. Write a
  short "MVP done — what to look at" note at the top of STATUS.md.

### Phase G — audio
- **G1 Ambient** (CC0 only, credited): pigeon whistles (鸽哨), bicycle
  bells, crowd, subway chime. Volume setting, off when the tab is hidden.
- **G2 NPC voices.** NPC speech is conversation, not pronunciation
  teaching, so the designed voices are allowed (concept §12). If the local
  voice worker (`scripts/voices/speak.py`, Qwen) runs on this Mac,
  pre-render every scripted line to `public/world/voice/<hash>.mp3` with a
  build script (resumable, skips existing). If it does not run, skip this
  task, note it, and keep the lines silent with 🔁 hidden. Subway
  announcements use the same voices.

### Phase H — the rest of Beijing, one district per task group
For each chapter (concept §3): maps + interiors, NPC cards, scenes,
situation words, its spirit (with 灯谜 / request / name), its 成语, stamps,
stations/bus stops, then a play-through check and screenshots.
- **H1** Ch. 2 — 后海, 景山, 北海 (九尾狐, 狐假虎威; view from 景山 over
  the palace as a wide panorama).
- **H2** Ch. 3 — 王府井, 前门 (the 成语 book found in 书店; 京剧; 门神;
  人山人海, 画蛇添足; 药店 and 银行 with situation words).
- **H3** Ch. 4 — 天坛 (回音壁 listening puzzle), 雍和宫, 国子监 (麒麟;
  对牛弹琴, 井底之蛙).
- **H4** Ch. 5 — 三里屯, 国贸, 奥林匹克公园 (貔貅; 半信半疑, 七上八下).
  Doors of 瑞幸 / 蜜雪冰城 / 海底捞 etc. open the existing 点单 games
  (route to `/play/<id>` and back to the same spot on return).
- **H5** Ch. 6 — 颐和园 (长廊 paintings), 潘家园 bargaining (年兽;
  守株待兔 — 兔儿爷 is offended; 亡羊补牢).
- **H6** Ch. 7 — 故宫 inside: ticket booked in your name, security,
  午门, 太和殿, 御花园, 角楼; finale 画龙点睛 (龙).
- **H7** Epilogue — train to 长城, farewell (愚公移山, 一路平安).
- **H8** Side quests in every district (2–3 each) and the 共享单车.

### Phase I — finishing
- **I1** Live-dialogue hook: `LiveDialogue` class implementing
  `DialogueSource` that is **disabled and unused**, with a doc comment on
  how it will call the Mac server later; a hidden setting flag. No network
  calls.
- **I2** iPad pass: memory, frame rate, touch targets, safe areas, WebKit
  probe of every overlay at 375/768/1024.
- **I3** Final STATUS.md summary: what is done, what is weak, what the
  learner should try first.

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

## 9½. Beijing+ — side quests, items, cosy features, QA (added 2026-09-28, 22:40)

**When:** after every task A–I is ticked.
The learner approved every idea below. Everything is still Beijing. All
standing rules apply (§0, concept §1): no quizzes — understanding shows in
what you do; help is free; the §5 word budget (plus situation words);
companion speaks English; own or CC0/CC-BY art; everything saved in the
world save (bump its version with an upgrade + test when the save grows).

**Cultural references are homages, never copies:** your own short lines,
no passages from the books, no copied artwork. Name the source in the
quest's English "About this" note (shown by the companion's Why?).

### X0 — QA harness first (so every later task is checked by it)
1. **Quest solver test** (`src/world/core/solver.test.ts`, runs in
   `npm test`): starting from a fresh save it plays every quest through
   the core only (no engine) — walking via the travel/door graph, feeding
   the dialogue the **full sentence of each node's third hint step** — and
   asserts: every quest can be finished; every hint's full sentence
   matches its intent; no dead ends (every node has a way out, incl. the
   universal intents); each needed item can be obtained before it is
   needed; every time window is reachable with the clock/sleep; every
   door leads to a walkable tile of an existing map; every NPC routine
   position is walkable; every spirit and 成语 can be collected.
2. **Golden saves** (`content/world/test-saves/`): one save at the start
   of each chapter and one per side-quest line; a test loads each, runs
   the migration, and continues the next quest with the solver.
3. **Map probe:** a script that opens `/play/world?map=<id>` for every
   map (dev-only query), in the pane **and** in WebKit
   (`scripts/webkit-probe.swift`), at 375/768/1024: no console errors,
   the canvas draws, frame time recorded. Screenshots to
   `docs/world-game/review/maps/`.
4. **Crash guard:** an error boundary around the engine and the overlay;
   on a crash the save stays intact, a calm screen offers "Back to where
   you were". Log the error to the console with the map and quest.
5. **Stress checks** (automated where possible): fast repeated taps,
   hiding the tab mid-dialogue, going offline mid-save, two tabs open,
   rotating the iPad, very long input, empty input, emoji input.
6. Fix everything these find in A–I content **before** X1.

### X1 — usable items
- Use an item from 🎒 on a person or object (tap item → tap target, or
  drag). Scene/NPC data says which items do what; **a wrong item gets a
  gentle funny HSK 1 reaction**, never a dead end.
- **Gifts:** every NPC has likes / dislikes / neutral (data). Giving
  changes friendship (X2). One gift per NPC per game day.
- Items and their situations (build all):

| Item | Where / how it is used |
|---|---|
| 雨伞 | on rainy days lend it to the neighbour caught in the rain → friendship; get it back next day |
| 保温杯 + 热水 | fill at home or the 茶馆; the old man in the park in winter |
| 药 (bought at 药店 with situation words) | the neighbour with a cold (感冒/发烧) — you tell the pharmacist the symptoms |
| 手机 | map app (Chinese UI), 扫码 pay at stalls, camera for photo tasks ("拍一张红门的照片") |
| 手电筒 | dark 胡同 at night; one spirit only shows in the dark |
| 竹竿 (from 小卖部) | the kite stuck in the 槐树 |
| 红包 | give to the children on 春节 (say 新年快乐) |
| 春联, 福 | put on your door; 福 upside down — the companion explains 倒 / 到 |
| 糖葫芦, 包子, 月饼 | gifts (likes differ) |
| 毛笔 | 地书 in the park, writing postcards |
| 风筝, 毽子, 空竹 | the park games (X8) |
| 钥匙 | one day you lose your keys and find them by asking the neighbours who saw what |

### X2 — friendship and NPC memory
Hearts (0–5) per NPC, raised by talking, gifts, helping. NPCs greet you
by name, recall what you told them (NPC memory in the save). At 3 hearts
each main NPC opens a **personal story** (2–3 short scenes): 王阿姨's son
abroad, the barber's first shop, the bird-cage grandpa's bird.

### X3 — diary 日记
Every game day writes itself in simple Chinese from what you did
(templates over the day's actions: "今天我在王府井买了一本书。晚上我和
王阿姨包饺子了。"). Words tappable, 拼 toggle, unknown words marked. A
diary page in the panels; it stays within the §5 budget (validator
covers the templates).

### X4 — calendar, festivals, weather
A game calendar (one game day ≈ one week of the year, so a festival comes
round every few sessions): 春节 (饺子, 春联, 红包, 庙会 at 地坛),
元宵 (灯谜, lanterns), 端午 (粽子, 龙舟 on 后海), 七夕, 中秋, 国庆
(crowds 人山人海). Weather: snow (雪人 you can build), rain (umbrellas
appear on NPCs), windy days (kites), clear. Weather and festivals change
NPC lines, the streets, and which side quests are open. The /play card
banner reflects snow/festival.

### X5 — the room and the cat
- **Your room in the 四合院:** buy 剪纸, 灯笼, 书法, plants, a 京剧 mask;
  place them on a small grid; visitors comment ("你的灯笼真好看！").
- **The 胡同 cat:** feed it a few days → it trusts you → you name it
  (type/say a name in Chinese) → it follows you in the 胡同 and sleeps in
  the courtyard. Tap = purr.

### X6 — photos, postcards, stickers
- Photo mode: freeze, frame, zoom; photos go to an album; some quests ask
  for a photo of something described in Chinese.
- **Postcards:** a photo + a caption you write in Chinese → printable
  through the app's print flow (or a clean PNG if print is too costly —
  log it).
- **Stickers** (表情包-style, drawn in the pixel style) you can send in
  dialogue; NPCs react to them.

### X7 — 兔儿爷 alive
Emotes (happy, sulky, sleepy, proud), seasonal hats (snow hat, festival
flower, 中秋 armour as in the clay figure), hold to pat → blushes, sulks
at 守株待兔, dozes when you stand still, cheers when a spirit is found.

### X8 — Beijing life (small activities, each a side quest)
- **地书:** write with water on the pavement next to the old men — trace
  with a finger; the stroke dries and fades (use the app's stroke data).
- **象棋:** you move pieces by saying the move (马走日, 象走田, 车, 炮…),
  a short puzzle, not a full game.
- **广场舞:** evening dance on the square — 左, 右, 前, 后, 转, 拍手 in
  time with the music.
- **放风筝** at 天坛 on windy days — choose the kite from the maker's
  description.
- **抖空竹, 踢毽子** — old people teach each step in Chinese.
- **包饺子 with 王阿姨 on 春节** — her shopping list, then the steps
  (和面, 擀皮, 包).
- **烤鸭** — the waiter explains how to wrap it; do it by his words.
- **相声** — a short crosstalk bit with a simple sound pun; the companion
  explains if you missed it.
- **京剧 masks** — the make-up artist explains colours (红 loyal, 白
  cunning, 黑 honest); pick the mask for the hero described.
- **外卖 rider lost** — read the door numbers (门牌号) to find the address.
- **收破烂儿** — the recycler on a tricycle with a loudspeaker ("收——旧
  手机、旧电脑") — sell him your old things; he appears again in X11.
- **Fishing on 后海** with the old men — calm, they chat beside you.

### X9 — side quests from books and theatre (homages)
1. **《骆驼祥子》** — 祥子, a rickshaw man in the 胡同, saves for his own
   cart; you pedal a 三轮车 and take tourists where they ask.
2. **《茶馆》** — the 茶馆 at 前门 has a "莫谈国事" sign; guests try to
   talk news, you steer them politely to weather and food.
3. **《城南旧事》** — the girl 英子 lost a camel bell from the old camel
   caravans; find it from people's descriptions.
4. **《红楼梦》** — at 恭王府 near 后海 a poetry club (海棠诗社) asks you
   to pick the second line of simple couplets.
5. **《孔乙己》** — at the Lu Xun house an old man asks if you know the
   ways to write 回; you write them with a finger.
6. **《西游记》** — a boy dressed as 孙悟空 near the 京剧 theatre "turns
   into" things around you; guess from descriptions ("红色的，圆的，可以
   吃"). And 猪八戒 has eaten everything on 小吃街 — find out who ordered
   what.
7. **《三国演义》** — a 说书 storyteller in the teahouse tells a new
   episode each day (桃园结义, 空城计…) — listening; come back for more.

### X10 — tales and festival stories
8. **神笔马良** — a boy with a magic brush whose drawings come alive;
   leads into the 画龙点睛 finale.
9. **孔融让梨, 司马光砸缸** — small park stories with children.
10. **牛郎织女 on 七夕** — gather magpies (喜鹊) around the city to make
    the bridge; each found through an NPC's hint.
11. **兔儿爷's own story on 中秋** — make 月饼 with 王阿姨; he tells of
    嫦娥 and the jade rabbit.
12. **哪吒** — a child in a 哪吒 costume argues with a friend whether
    哪吒 or 孙悟空 is stronger; you settle it.

### X11 — 《天官赐福》 homage line (the learner's favourite)
A side line of 5–6 scenes built on real folk culture — 天官赐福 is the
blessing of the Heavenly Official (天官) on 上元 (元宵) — as a homage to
墨香铜臭's novel. Original characters and lines only:
- **The scrap-collecting god:** a gentle man in plain white with a bamboo
  hat who goes around the 胡同 collecting 破烂 (he works with the 收破烂儿
  recycler, X8). He is always unlucky (things fall, rain starts when he
  arrives) and never complains. He wants to rebuild a tiny forgotten
  shrine (a 菩荠观-like 小庙) at the edge of the city: you gather
  donations and materials by talking to people (friendship helps), and he
  says 「百无禁忌」 when something goes wrong.
- **The man in red with silver butterflies:** at night a young man in red
  appears near the shrine; **silver butterflies (银蝶)** lead you through
  dark 胡同 — a collectible: once befriended they light the way at night
  and show hidden spirits.
- **鬼市 at 潘家园** (the antique market at night becomes a ghost
  market): strange sellers, bargaining with riddles; the red-clad man
  owns it.
- **上元 finale:** the shrine is done on 元宵 night; the sky fills with
  thousands of lanterns (长明灯) — ties back to the broken lantern of the
  main story. A special stamp and a 图鉴 page.
- **成语 / phrases:** 百无禁忌, 所向披靡 (as the red-clad man's motto),
  一念之间. Mark them in the 成语 book as "from the 天官赐福 line".

### X12 — polish and the final bug hunt
**Run it after §9¾ (Y1–Y7, items and money)** — the order is X10 → M1–M5 (§9⅞) → X11 → Y1–Y7
→ X12. Run X0's solver, golden saves, map probe and stress checks over **all**
content; then play every chapter and every side line in the pane and
in WebKit like the learner would (tap-to-move, both input modes, phone
and iPad widths), fix what you find, and write a bug report + what was
fixed into STATUS.md.

## 9¾. Items and money — shops, 支付宝-style paying, a living bag (added 2026-09-29)

**When:** after X11, **before X12** (so the final bug hunt covers it). The learner found items and money "very primitive" and chose
**QR paying in the style of 支付宝** as *the* way to pay — no cash notes.

**What is there now (the problem):** money is one number (200 元 at the
start); ~36 hand-written purchase scenes each bake in a price ("the
breakfast is always 4 元"); a shop scene only offers itself when you can
pay, so a broke player sees shops silently vanish; income is 20 元 once
and 700 元 from the bank in ch. 3, then nothing. Items are
`{id, name, en, gift}`; every item gets the same "Use / give" button; you
cannot eat, sell, combine, or tell a story item from a snack; the diary
cannot tell bought from given. The richest HSK 1 topic of daily life —
多少钱, numbers, 块/毛, 扫码, 便宜一点 — is almost unused.

All standing rules apply (§0, §5 budget, help is free, never a dead end,
no quizzes, companion speaks English, stable compact UI, tap opens a
card). **No hunger or survival meter** — food is a pleasure, not a need.

### Y1 — shops and prices as data
- `content/world/<district>/shops.json`: `{id, npc | object, map, name
  (e.g. 李阿姨小卖部), pay: 'scan' | 'code', hours?, when?, stock: [{item,
  price, when?, perDay?}]}`; zod schema in `content.ts`, checked by
  `world:check` (every item exists, every price is a whole 元 or x.5 —
  五毛 is the only small unit, the stock words are in the budget as
  situation words of that shop).
- `Item` grows: `kind: 'food' | 'drink' | 'gift' | 'tool' | 'decor' |
  'toy' | 'key'` (`key` = story item: cannot be given away as a present
  or sold), `price?` (base value, for selling), `verbs?` (Y4),
  `combine?` (Y4). Keep `gift` working (old content).
- **A generic shop talk**, generated in code like the ticket machine in
  `travel.ts` (`core/shop.ts`): 「你要什么？」 → you name one or more
  things with quantities and measure words (「两个包子，一杯豆浆」 —
  parse 一/两/二…十 and the measure words 个 杯 瓶 本 张 串 斤 块);
  「多少钱？」 always works and is answered with the price (listen-first
  line, voiced by the seller's voice with a numbers-clip set, see Y2);
  「还要别的吗？」 → 不要了 / 没有了 / another item → the total → Y2's
  paying. Sold-out / closed / wrong season get short HSK 1 lines.
- **Real 2026 Beijing prices** (table in `docs/world-game/economy.md`):
  包子 3, 豆浆 3, 油条 3, 水 2, 糖葫芦 10, 月饼 8, 小鱼干 3, 茶叶 20,
  红纸 5, 书 30–45, bike 1.5, 故宫 60, and so on.
- **Convert** the plain purchase scenes (breakfast, water, bait, 竹竿,
  保温杯, 雨伞, 红包, 春联, 福, flowers, paper-cuts, 小鱼干, 月饼, 糖葫芦,
  lantern, calligraphy …) to shop stock; story purchases with special
  lines keep their scenes but pay through Y2. Chapter 1's breakfast
  becomes an ordinary order (bun + soy milk or whatever you ask for).
- **No vanishing shops:** when the money is short the seller says
  「钱不够吗？没关系。」 and 兔儿爷 names a way to earn (Y3).

### Y2 — paying with the phone (支付宝-style)
The 手机 opens a small phone overlay over the frozen world (like photo
mode). Drawn in our own pixel style in an Alipay-like blue; the app is
called 支付宝 as a word to learn, but **no copied logo or real UI**. The
real words: 扫一扫, 付款码, 收款码, 余额, 账单, 支付成功, 余额不足,
到账. **Never a password or PIN field** — confirm with a button and a
short fingerprint animation.

1. **扫一扫 — scan the stall's code** (street stalls, small shops, 早点铺,
   糖葫芦, 潘家园): the seller says the total aloud (「一共十五块。」);
   the QR sign on the counter (a new prop, drawn) lights up; tap it → the
   phone shows the shop's name → **type the amount you heard** on a
   keypad (0–9, ., ⌫) → 付款 → fingerprint → 支付成功, and the seller's
   speaker box says **「支付宝到账，十五元。」** (the famous voice — a second
   hearing of the number). This is the core listening drill.
   - Wrong amount → the seller: 「不对，是十五块。」; from the second miss
     the amount is filled in for you. Too much → 「多了！」 and it is
     not taken. Never a dead end.
   - Not enough → 余额不足 on the screen, then Y1's "no vanishing shop".
2. **付款码 — show your code** (便利店, 百货大楼, bookshop, tickets, chain
   shops): the cashier scans you; the charge pops up (「支付成功
   ¥23.00」) and you check it. Now and then (content-flagged, at most
   once a day) the cashier rings up the wrong amount — say 「不对」 /
   「我只买了一个」 / 「是二十块」 and it is fixed with a thank-you and a
   friendship heart; missing it costs a few 元 and 兔儿爷 points it out
   afterwards (reading drill, not a trap).
3. **收款码 — get paid** (Y3): people scan *your* code and your phone
   says 「支付宝到账，五元。」.
- The phone's home screen: 余额 (the save's `bag.money`), the 交通卡
  (stays a card — chapter 1 is built on buying it), and 账单 — the last
  20 payments (「李阿姨小卖部 −15.00」「王阿姨 +20.00」), words tappable.
- The ticket machine and the train pay the same way (scan or code). The
  bank's 100 美元 goes to 余额 (「到账」).
- **Numbers audio:** pre-render per seller voice 一 … 十, 百, 块, 元,
  毛/五毛, 一共, 找你, and the speaker box line in a neutral machine-like
  voice; assemble totals from clips (test: every price in shops.json can
  be said). Pinyin/English under the numbers like any line.
- Solver and tests pay by typing the amount from the hint; a test plays
  one of each flow including a wrong amount and a wrong charge.

### Y3 — earning, so the money goes round
- **Small repeatable jobs** (once a game day each, 5–20 元, paid to your
  收款码): stack shelves for 李阿姨 (choose lines: 「水放这儿，面包放那儿」);
  the breakfast rush at the 早点铺 (hand out the order you hear);
  deliver for the 外卖 rider (read the door numbers — X8's rider);
  carry tea at 老刘's 茶馆.
- **Selling:** the recycler 收破烂儿 (X8, `met-polan`) buys 旧 things
  and extra items at part of their `price` (「这个多少钱？」「五块。」); at
  潘家园 you can sell finds (Y6's bargaining works both ways).
- **Gifts of money:** 红包 from 王阿姨 and 赵爷爷 at 春节 (you say
  新年快乐), people paying you back 「我请你！」 after a favour (the
  treat is free food, not cash).
- **Economy table** in `docs/world-game/economy.md` (start money, every
  price, every income, per chapter); tune START_MONEY if needed.
- Solver asserts: money never below zero; a broke player can always
  earn enough within one game day for the next thing the story needs; a
  player who buys everything they are offered never soft-locks.

### Y4 — items that do something
- **Chinese verbs on the item instead of "Use / give":** 吃 喝 给 用 放
  看 穿/戴 (umbrella: 打, kite: 放), each item shows only its `verbs`.
  给 and 用 keep X1's tap-a-target flow; 吃/喝 happen at once; 看 opens
  the item's card (Y5).
- **Eating and drinking** are small pleasures: 兔儿爷 reacts (X7 moods),
  the diary writes 「我吃了两个包子。」, a hot 豆浆 or 热水 on a snowy day
  warms you (the cold shiver emote stops), food bought today is 热的 and
  tomorrow 凉的 (NPCs like warm food more). No hunger meter.
- **Give by saying it:** in any talk, 「给你糖葫芦」「这个给你」 (with the
  item held) / 「我有雨伞」 when it is in the bag hands it over — a new
  universal intent that falls through to the X1 gift logic; tap-to-use
  stays.
- **Combine** (`combine: [{with, makes}]` in items.json): 红纸 + 毛笔 →
  春联, 保温杯 + 热水 (the existing refill becomes one), 竹竿 + 网 → 捞鱼网
  … drag one item onto another or "用 → tap another item".
- **`key` items** (护照, 钥匙, 老照片, borrowed things) are marked with a
  small seal, never given as presents, never sold.
- After two wrong item tries in one place, 兔儿爷 glances at the right
  item in the bag (help after a miss, not before).

### Y5 — the bag, redesigned
- One compact filter line: 全部 食物 礼物 工具 装饰 重要 (fixed width,
  no layout shift, fits 375 px).
- **Tap an item → its card** (drawer, like the app's cards): big hanzi,
  pinyin, English, where it came from and what it cost, who liked or did
  not like it (learned from your gifts), its verbs as buttons, hot/cold.
- The money header becomes the phone's mini summary (余额, 交通卡, the
  last payment) and opens the phone.
- Check at 375 / 768 / 1024 in the pane and in WebKit.

### Y6 — bargaining 砍价 (潘家园, the night market, selling)
- A generic bargaining talk (`core/bargain.ts`): the seller has an
  asking price and a lowest price (data); you answer with numbers and
  phrases — 太贵了, 便宜一点, 最多X块, X块行吗, 算了 (walk away → the
  seller calls you back once at a better price). Hot/cold feedback in
  the seller's lines; a deal ends in Y2's 扫一扫 at the agreed price.
- A Chinese number parser (二十五, 两百, 一百五, 一百零五, digits too) in
  `core/numbers.ts` with tests — shared with Y1/Y2.
- The old map at 潘家园 (H8) becomes a real bargain; add 3–4 more
  stalls (a teapot, an old coin, a paper fan, a snuff bottle 鼻烟壶).

### Y7 — save, diary, checks
- **Save format +1** with an upgrade and tests: `bag.ledger` (last 20
  payments), `bag.bought` (shop purchases per day for `perDay`), item
  freshness (the day food was bought), jobs done per day. Merge: ledger
  union by id, counters keep the higher.
- A `buy` save action so the diary says 「我花了六块钱买包子。」 (fixes
  X3's "bought or given" note); `earn` for 「我挣了十块钱。」.
- Content checker, solver, golden saves updated; STATUS notes with
  renders of the phone screens at 375 and 1024.

## 9⅞. Maps and finding the way — minimap, neighbourhood maps, a metro diagram (added 2026-09-29)

**When:** right after the task in progress when this was written (X10),
**before X11**. The order is X10 → M1–M5 → X11 → Y1–Y7 → X12 → M6.
The learner plays every day and finds the map "harder to navigate than
the actual Beijing metro", so this comes first.

**What is there now** (built with the learner 2026-09-29, uncommitted work
in the tree at that time — build on it, don't redo it):
- `src/world/core/places.ts`: every map as a place `{map, zh, en, kind:
  street | sight | inside | station, at, label, apart}` on a hand-laid
  160×100 drawing; `walkPath` (BFS over doors and edges), `districtFrame`,
  `districtCentre`; tested in `places.test.ts` (every map has a place).
- `public/world/maps/index.json` has `links` per map (doors and edges), written
  by `scripts/world/build-maps.ts`.
- `src/world/ui/CityMap.tsx` (the 🗺 tab): a drawn Beijing (rings, lakes,
  palace, parks, subway lines as polylines) with every place, dotted walk
  links, pan/pinch/scroll zoom, "北京" / "Where I am", tap a place →
  "On foot: 我的房间 → 四合院 → …" or the subway route + the walk from the
  station. Styles `.wp-city*`, `.c-*` in `src/features/world/world.css`.
- Stations: walking into the ticket gates goes through (a card with money
  from the street side; always out); without a card the gate sells one
  (`core/machine.ts`: `machineScene`, `gateCheck`); every ticket machine sells
  and tops up; walking to the platform edge / tapping the tracks opens the
  train board; the train list shows the next five stops (exitable ones bold).
- The "Mark what I can use" setting (`settings.highlight`, diamonds over
  people, signs, bikes, machines and props with a look scene).

**The learner's model — use it everywhere:** Beijing in the game is 13
**neighbourhoods**, each a cluster of places around one or two stations,
joined on foot through doors and street ends (a few neighbourhoods also
join on foot: 鼓楼 → 后海 → 北海 → 景山). Everything else is a ride.

**Learner's decisions:** the minimap is **always on**, can be collapsed by
the learner, and **collapses by itself indoors and expands outdoors**
(a manual collapse holds until the next indoor/outdoor change). The city
level is a **metro diagram, drawn well** (see M4). "Take me there" comes
**only after the maps are fixed** (M6, last).

All standing rules apply (§0, stable compact UI — no layout shift, check at
375 / 768 / 1024 and in WebKit; tap opens a card; hanzi-design tokens only,
dark mode; no emoji in UI text; names in Chinese, English on tap).

### M1 — neighbourhood data and place pictures
- A **neighbourhood layout per district**: a simple street plan in its own
  frame (not the city drawing): streets as lines with their names along
  them, each place **on the street it really opens onto** (the teahouse on
  南锣鼓巷, the courtyard off 帽儿胡同, the shops of 王府井大街 on its side),
  the station as a roundel with its line numbers, water and parks as flat
  shapes, and exits to walkable neighbours as labelled arrows at the edge
  ("← 鼓楼 · walk"). Data in `content/world/<district>/layout.json` (or
  extend `places.ts` — your call, write it down), zod-checked; the checker
  fails if a map of the district is missing from its layout or a drawn
  street link disagrees with the door/edge graph in `index.json`.
- **A picture for every place**: at build time render a small thumbnail of
  each map with the game's own art (`scripts/world/render-map.ts` already
  draws maps to PNG) — a crop around the main door or the most typical
  spot, ~96×64, pixel-perfect, into `public/world/thumbs/<map>.png`, built
  by `npm run world` and listed in the map probe. Interiors show their
  inside; stations their gates.
- One clear shape per kind: street = line, shop/inside = small door card
  with the thumbnail, sight = outlined roof mark, station = metro roundel.

### M2 — the minimap (always on)
- A small card in a corner of the game (bottom-right on phones above the
  joystick area; top-right under the tools on iPad/desktop — pick what does
  not cover the hero or the input bar and write it down), showing **this
  neighbourhood's** layout from M1: streets, places, the station, and a red
  dot where you are (on the current map's place; on a street, placed along
  the street by the hero's x/y as a fraction of the map).
- **Collapse**: a toggle on the card (collapsed = one compact pill with
  the neighbourhood name and a 🗺-style icon button, no layout shift).
  Auto: **collapsed indoors** (a map whose place kind is `inside`, and the
  station interiors count as outdoors), **expanded outdoors**; a manual
  toggle holds until the next indoor↔outdoor change. Remember the manual
  state per device (`localStorage`, try/catch), not in the save.
- Tap the expanded minimap → the 🗺 panel opens on this neighbourhood (M3).
  Hidden while a dialogue, a panel, photo mode or the ride sheet is open.
- Cheap: an SVG redrawn only on map change or every ~250 ms of walking,
  never per frame; check the frame rate on the iPad stays as before.

### M3 — the 🗺 panel, reworked
- Opens on **your neighbourhood** (M1 layout, big, with thumbnails and
  names); a header row: neighbourhood name + station, "北京" (to M4), and
  prev/next or a small picker for other neighbourhoods.
- Tap a place → its card (thumbnail, 汉字, pinyin, English, kind, and the
  way there: on foot inside the neighbourhood, or the ride + the walk from
  the station, as now). Unvisited places are outlines until you have been
  there (needs a `visited` set of maps in the save → save version +1 with
  an upgrade, merged as a union).
- Current task's place marked (from `whatNow` / the active quest's step,
  when the step names a map or an NPC whose place is known).
- Keep `walkPath` and the route text; retire the old free-form city drawing
  from the panel once M4 replaces it (keep `places.ts` if M1 builds on it).

### M4 — the city as a metro diagram, drawn well
- A proper schematic metro map, not a sketch: lines as **45°/90° runs with
  rounded corners** in the real line colours, even stroke width, stations as
  ticks and interchanges as white roundels with a dark ring, names set
  horizontally with consistent offsets and **no overlaps** (a test checks
  label boxes do not collide), Line 2 as the rounded rectangle around the
  old city, Line 10 as its arc, the bus and the Great Wall train dashed. Only
  the game's lines and stations (`travel.ts`); stations with a game map are
  full-colour and tappable, others are small ticks.
- Each neighbourhood is a soft bubble around its station(s) with its name;
  tap → M3 for that neighbourhood. "You are here" on your station.
- Faint landmarks only where they help (the palace block, 后海, 天坛 green) —
  the diagram is the picture. Works at 375 wide (pan/zoom as now) and fills
  the iPad nicely.
- Lay it out by hand in data (station → grid position) and render it;
  write the rules for the next person in a comment.

### M5 — checks
- Content checker: every map in exactly one layout, links agree with doors,
  thumbnails exist; `places.test.ts` and new layout tests; the map probe
  opens the panel on every neighbourhood and screenshots it (`review/m/`).
- In the pane and in WebKit at 375 / 768 / 1024, light and dark: the
  minimap collapses entering 茶馆 and opens again on 南锣鼓巷; nothing
  overlaps the hero, the joystick or the input bar.

### M6 — "Take me there" (only after M1–M5 and the learner's look at them)
- On a place card: **Take me there**. In the world a faint footprint trail
  leads to the next door or street end on the `walkPath`; each new map
  continues it; across town it leads to the station, and on the platform
  the right train is marked in the train list ("往X方向 — 3 stops"), then
  on from the arrival station. 兔儿爷 can say "This way." The minimap shows
  the route. Cancel from the card or by arriving. Saved nowhere (a
  per-session goal).

## 10. The menu — journal, people, collection (added 2026-09-29)

**When:** now, before the X12 play-through and before M6. The order is
X12 automated half (done) → **P1 → J1 → J2 → J3 → P2 → P3 → P4** → the X12
play-through with the learner → M6.

**Why:** the learner finds the panels plain and not very useful. There are
ten tabs in one row, so they scroll sideways on a phone and nothing says
which one has news. Every tab is the same flat list of white boxes. Tasks
shows one line per quest, and finished quests fill most of the list ("·
done" ×5). It never says what happened, where to go, or how to get there,
and it doesn't separate the story from side quests. Collections (图鉴, 成语,
印章, 相册) are split over four tabs, and 日记 and Tasks tell the same story
without linking to each other.

**Learner's decisions:**
- Tasks become a **journal**. It shows what happened, the main quest now
  with the place to head to and **the route with metro stations**, and side
  quests with their description and info.
- Side quests not yet started show as **vague hints (leads)**, never
  spoilers.
- The 成语 book gets a **Practise** mode.
- The whole menu is regrouped and restyled. It should look clean and be
  more useful.

All standing rules apply: §0, the stable compact UI (no layout shift,
one-line toolbars, per-item actions on the item, checked at 375 / 768 /
1024 and in WebKit, light and dark), a tap opens a card's drawer,
`hanzi-design` tokens only, and names in Chinese with English on tap. The
world stays paused while the menu is open.

### P1 — the menu shell
- **Five tabs plus ⚙.**

  | Tab | Holds |
  |---|---|
  | 📜 日志 Journal | tasks, riddles, diary |
  | 🎒 包 Bag | as built in Y5 |
  | 🗺 地图 Map | as built in M3/M4 |
  | 👥 朋友 People | friends and the cat |
  | 📖 收藏 Collection | 图鉴, 成语, 印章, 相册 |

- Each tab shows an icon, a 汉字 label and a small English word under it.
  ⚙ becomes an icon button beside ×, and settings are grouped into Sound,
  Text (pinyin, size), Controls and Game (Start over).
- **Inner views** use one segmented control at the top of the tab, never a
  second tab row. Journal: Now · Story · 日记. Collection: 图鉴 · 成语 · 印章 ·
  相册. Map: as now.
- **Red dots** mark news: a new 成语, stamp, spirit, riddle or lead, or a
  quest step that moved. A dot shows on the tab and on the inner view, and
  clears when that view is opened. `seen` markers live in the save
  (additive, merged by max, no version bump).
- **Phones (<768):** the sheet is full height with the tab bar at the
  bottom, within thumb reach. **iPad/desktop:** the tab bar stays on top.
- The menu reopens on the last tab and view, kept per device in
  localStorage (try/catch). Keyboard: 1–5 switch tabs, Esc closes.
- Old `PanelId`s (`tasks`, `spirits`, `idioms`, `stamps`, `friends`,
  `diary`, `album`, `settings`) map onto the new tab + view, so
  `onOpenPanel` callers (TopBar, companion, minimap) keep working.
- **Look:** cards only for things you act on. Passive and finished things
  are quiet one-line rows. One accent for "current / go here" (the gold
  already used for the task ring on the maps). Drawers slide over the list
  and never push it down.

### J1 — quest data
- `Quest.kind: 'main' | 'side'`, required. Main = `ch1`…`ch7` and
  `epilogue`; everything else is side (`story-*`, `wang-cold` too).
- `Quest.giver?: npcId`.
- `Quest.blurb: string`, required for side quests: 1–2 English sentences
  on what it is about and why it matters to the giver.
- `Quest.lead?: string`: the vague hint shown before the quest starts
  (see J2), in English, naming a person and/or a place and never the
  answer. Example: "赵爷爷 by the 鼓楼 square looks worried about
  something." When it is missing, it is generated from the giver and the
  giver's usual place.
- `QuestStep.past: string`, required: the step told afterwards, in the
  past tense, first person, one line. Example: "Had 包子 and 豆浆 at the
  早点铺 — my first order in Chinese."
- `QuestStep.where?: mapId`, for steps whose `done` names no place (a
  flag, an item). Use `"anywhere"` when the step truly has no place.
- `QuestStep.when?: string`: timing the player must know ("after dark",
  "open 9:00–17:00", "at 春节").
- **Save:** `QuestState.at?: Record<stepId, gameMinute>`, stamped when a
  step is reached and when the quest is done. It is additive, merged by the
  earlier minute, with no version bump. Old saves have no stamps and show
  as "earlier".
- **Content check:** `kind` on every quest, `blurb` on side quests, `past`
  on every step, and every **main** step must resolve to a place
  (`goalMaps` or `where`) or be `where: "anywhere"`.
- Write `past`/`blurb`/`lead` for all ~64 quests (~180 steps). Keep them
  short and warm, in the companion's voice, English only (Chinese names as
  usual).

### J2 — `core/journal.ts` (pure, tested)
- `stepTargets(save, quest, content)`: `goal.ts`'s condition walk,
  generalised from "the first active quest" to any quest, plus `where`.
  Returns maps, and for each its neighbourhood (`hoodOf`) and station.
  `goalMaps` becomes a thin wrapper around it.
- `directions(save, map, index)`: builds on `wayThere` and returns
  display legs rather than text. Example:
  - `{walk: [我的房间 → 四合院 → 南锣鼓巷 → 南锣鼓巷站]}`
  - `{ride: line 8, 往… direction, 3 stops, from 南锣鼓巷, to 王府井}`
  - `{change: at 王府井 to line 1}`
  - `{ride …}`
  - `{walk: exit → 天安门广场}`

  Plus `fare` and `hasCard` (with enough money). "Here" and "on foot"
  are cases of their own.
- `journal(save, content)` returns:
  - `tracked`: the tracked quest, else the current main step.
  - `active`: main first, then side, newest first; each with step `now`,
    targets, `when` and giver.
  - `story`: chapters in order. Each is a list of `{day, past}` for the
    steps done, with finished side quests filed under the chapter in which
    they finished (by `at`).
  - `leads`: side quests not started whose giver you have **met** or
    whose giver's neighbourhood you have **visited**, and whose start
    conditions could hold now or soon. At most 5 at a time: nearest
    neighbourhood first, then lower chapter.
- **Tracked quest:** `save.tracked?: questId`, synced (additive, merged by
  the newer revision). 兔儿爷's "What now?", the minimap's gold ring and the
  🗺 task ring all follow it. If it is finished or missing, fall back to
  the current main step.

### J3 — the Journal tab
- **Now** (the default view):
  1. A one-line header: day, weather, time, 余额, and chapter progress
     ("第二章 · 2 / 7").
  2. **The tracked quest card:** the title (a small 主线 / 支线 tag), the
     step `now`, the destination with its mini thumbnail
     (`public/world/minis/`) and 汉字 · pinyin · English, the `when` note,
     and the **route strip**. The strip is the J2 legs as chips: 🚶 walk,
     then line chips in the line colour with the number, direction and
     stops, a small ↔ at changes, and the final walk. Under it: the fare
     and "交通卡 ✓ / top up / buy one at the station". One button:
     **Show on map**, which opens 🗺 → metro with the route drawn (J3b).
     If the step has no place: "Ask around — …" plus the `lead`-style
     hint.
  3. **Other active quests:** compact rows (giver portrait 32px, title,
     neighbourhood tag, one-line step). A tap opens the quest drawer:
     blurb, giver, where, route strip, `when`, the log of past steps with
     days, a reward hint when the reward is known to the player (a stamp,
     a friend's heart — never spoil items or spirits), and **Track**.
  4. **Leads:** faint rows with a 📍 neighbourhood tag and the lead
     sentence. A tap shows the route to the giver's place now
     (`schedule.ts`).
  5. **📌 Riddles:** unsolved first, as now. Solved ones fold into one line
     "Worked out: N" that opens.
- **Story:** a chapter timeline. The current chapter is open; finished
  chapters are one line ("第一章 · A new home in the hutong ✓ · days
  1–3") that opens their log. Side quests sit under their chapter as
  indented one-liners with their own `past` lines on tap.
- **日记:** the diary as built in X3, moved here unchanged. Each day adds a
  small "Also: <quest step past lines of that day>" link, and a Story
  entry's day links to that diary day.
- **J3b, the route on the map:** `MetroMap` gets `route?: Leg[]`. The legs
  are drawn thick in their line colours, other lines dimmed to ~25%, rings
  at the changes, "you" and "there" pins, and the view fitted to the
  route. The neighbourhood plan keeps the gold ring on the target.
- **J3c, in the world:** a small chip under the minimap shows the next hop
  of the tracked quest ("→ 南锣鼓巷站 · 8号线"). A tap opens Journal → Now.
  It hides indoors with the minimap and never overlaps the hero, the
  joystick or the input bar. This is not M6's footprint trail; M6 later
  reuses `directions`.

### P2 — the People tab
- Rows: portrait, 汉字 name, ♥ hearts, role, and **where they are now**
  from `schedule.ts` ("茶馆 · until 18:00", or "not about now · usually at
  鼓楼 in the morning"). Sort: people with an active quest first, then
  hearts, then last met.
- A tap opens the person's drawer:
  - what they remember about you (X2 notes)
  - likes and dislikes learned from gifts (Y5 already records them)
  - their quests, active and done, linking to the journal drawer
  - the 成语 they taught you
  - the route to where they are now (J2 `directions`)
  - "Talk topics" they answer, from their card, shown only once met
- Your cat gets its own card: name, days fed, where it sleeps. Your name
  goes in the header as now (我叫…).

### P3 — the Collection tab
- **图鉴:** a grid of portraits (3 columns on phones, 5 on iPad) with a
  count "3 / 8". Missing spirits are silhouettes with a district hint
  ("Something stirs near 天坛") from `Spirit.district`, never the name. A
  tap opens the drawer with legend, befriend line and credit.
- **成语:** compact cards: the 成语 large, pinyin, and a one-line meaning. A
  tap opens the drawer with parts, story (ZhText), and who you heard it
  from. Filters in one line: 全部 · 听到的 · 故事. A count "N / total"
  where the total counts only 成语 already met.
- **成语 Practise** (learner asked for it): a button in the 成语 view's
  toolbar, active once ≥4 成语 are known. A short round of up to 8
  questions, only from the 成语 you have heard (the test-only-learned
  rule). Question kinds, mixed:
  1. English meaning → pick the 成语 from 4
  2. 成语 → pick the meaning from 4
  3. a gap — the 成语 with one character hidden → pick the character from 4
  4. **say it:** the meaning is shown, and the player says or types the
     成语 through the existing input bar (voice / keyboard / IME),
     matched after normalising
  5. listen: the 成语 is played in the voice clip or system voice → pick
     it

  Distractors come from other known 成语 first, then from the game's list.
  At the end: a score, the ones missed with their story line, and a small
  reward the first time a round is all right (a friend's heart for the
  person who taught the most, or a 成语 stamp — pick one, write it under
  Decisions). Keep per-成语 `practised: {right, wrong, last}` in the save
  (additive, merged by max) and ask weak ones first. No timers, no lives.
- **印章:** a passport with one page per neighbourhood (swipe or ‹ ›),
  stamps as red seal art in a grid, and missing ones as dashed outlines
  with the place name ("天坛 · 回音壁") so the page says where to go. Each
  page shows a count, and the cover shows the total. A tap on a missing
  stamp shows the route there (J2).
- **相册:** a grid as now. A tap opens a full-width drawer with the photo,
  place and day, and the postcard / delete actions (as in X6).

### P4 — checks
- Tests: `journal.test.ts`
  - targets for every main step
  - `directions` for the chapter 1 ride (南锣鼓巷 → 8 → 王府井 → 1 → 天安门东),
    a walk-only case and a no-card case
  - leads (none before meeting, max 5, never a started quest)
  - story ordering by `at`
  - tracked fallback
- Tests: panel rows for People and Collection. Practise question building
  (only learned 成语, 4 distinct options, weak first).
- Tests: the old `PanelId` mapping, and the merge of `at` / `tracked` /
  `seen` / `practised`.
- The solver and golden saves still pass. The solver's final save has
  `at` stamps for every step it did.
- The map probe screenshots every tab and view, and a quest drawer, into
  `review/p/`.
- Check in the pane at 375 / 768 / 1024, light and dark: no horizontal
  scroll, no layout shift when a drawer opens or a dot clears. Run
  `scripts/webkit-probe.swift` at 390 and 1024.
