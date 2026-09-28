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
