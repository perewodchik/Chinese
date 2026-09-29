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

## 11. 兔儿爷's bubble — talking to the rabbit, not a help menu (added 2026-09-29)

**When:** now, before P1. The order is **R1 → R2 → R3 → R4** → P1 … (§10).
It's small, and the learner runs into it in every conversation.

**Why:** the learner finds the companion's help panel too big, jumpy and
off-style (screenshot 2026-09-29: a white site-style card saying "What do
you need?" with six buttons below it, half of them greyed out and Keep off
screen):
- **It jumps.** `.wc[data-talking]` moves the rabbit and the panel from
  `bottom: 10px` to above the dialogue box when a talk starts. The panel
  also grows upward from the rabbit, and `.wc-out` is 0–150px tall
  depending on the answer. So each answer (placeholder, translation, the
  Keep list) moves the top edge.
- **Too many buttons.** Again, Translate, Why?, What do I say?, What now?
  and Keep always show, and the disabled ones stay visible. The row scrolls
  sideways (`.wc-acts { overflow-x: auto }`), so Keep can't be seen on the
  iPad.
- **Off-style.** It uses the site's card (`--card`, a thin line, a big
  radius) with a placeholder and a button bar. Nothing says it's him
  talking.

**Learner's decision:** the menu should feel like **interacting with the
bunny**, cosy and cute in the game's own style: compact, no jumping, never
more options than fit without scrolling. This replaces the "one row of
actions" in concept §9 for how help looks. What each kind of help does
(repeat, slow repeat, translate, the three hint steps, what now, keep a
word) stays the same, and everything stays free.

**Defaults (the learner may still change them; log them under Decisions):**
- During a talk he **perches on the top-left rim of the dialogue box**
  instead of floating above it. If this can't be done without covering the
  NPC's name or the tools, use a fixed spot for the whole game (top-left
  under the HUD) and write down why.
- **Keep lives inside Translate:** each translated word gets a small ☆.

Standing rules apply: §0, stable compact UI (no layout shift, check at 375 /
768 / 1024 and in WebKit, light and dark), `hanzi-design` tokens, no emoji
in UI text (use pixel icons), Chinese with pinyin, English from him.

### R1 — options as data (`companionLines.ts`, pure, tested)
- `companionOptions(ctx)` returns **at most three** options
  `{id, icon, label, run}` for the moment, where `ctx.phase` is
  `'walk' | 'heard' | 'reply'` plus flags (has a line, can hint, has kept
  words from the last talk):

  | Phase | Options |
  |---|---|
  | walk (no talk open) | *What now?* · *What did I learn?* (words from the last talk to keep; only when there are some) |
  | heard (an NPC just spoke) | *Say it again?* · *What did they say?* · *Help me answer* (only in reply mode with a hint left) |
  | reply, nothing said yet / no line | *Help me answer* · *What now?* |

- Options that don't apply are **left out**, never disabled.
- Labels are things you ask him, in English, short enough for a 375px
  row: "Again?", "What did they say?", "Help me answer", "What now?",
  "What did I learn?". Write them into the concept §9 table as the English
  labels.
- **Why?** stops being a button. When the node has a `why`, his "What did
  they say?" answer ends with it on its own line. `whyText`'s key-line note
  folds in the same way. With no `why`, nothing is added.
- Tests: the options for each phase (never more than 3, none without an
  action), and the translate answer with and without a `why`.

### R2 — the bubble (`Companion.tsx`, `world.css`)
- The panel becomes **his speech bubble** in the dialogue box's own pixel
  style: the same border and background as `.wd`, a small pixel tail
  pointing at his portrait. Retire `.wc-panel`, `.wc-out` and `.wc-acts`.
- **Fixed size:** an answer area of two lines (his line, typed out like
  NPC lines, with a small portrait expression) and one options row. For
  longer content:
  - The translation shows the English line and one row of word chips
    (汉字 + pinyin + ☆) that **wrap to at most two rows**. The rest go
    behind a "+N" chip that opens the word drawer (`useOpenItem`).
  - Nothing inside the bubble scrolls, and its height is the same for
    every answer.
- **Opening** scales and fades from the tail using `transform`/`opacity`
  only, so nothing around it moves. Close by tapping outside, tapping him
  again, or Esc. Tab opens him, and 1 / 2 / 3 pick an option.
- The bubble opens **to his side** (right of the portrait), never upward
  over the conversation. Check that at 375 it fits between him and the
  screen edge, and that on the iPad it's no wider than ~420px.

### R3 — where he sits, and his little reactions
- Remove the `bottom` jump of `.wc[data-talking]`. When a talk opens he
  **hops** onto the rim of the dialogue box (a ~250ms arc using
  `transform`), and hops back down when it closes. The dialogue box doesn't
  move and the bubble doesn't resize.
- When he wants to speak by himself (`said`), a small pixel **"!" / speech
  mark** pops above his head instead of the gold ring. A tap opens the
  bubble with that line.
- Reuse the X7 emotes: *thinking* while an answer types, *happy* after a
  keep, the blush pat (hold) as now, hats as now. A soft blip per answer
  uses the existing synthesized sounds, respecting the sound setting.

### R4 — checks
- Unit tests from R1, and the existing companion tests updated.
- In the pane at 375 / 768 / 1024, light and dark, play one full talk in
  早点铺 and check:
  - the rabbit and the dialogue box never jump
  - the bubble keeps the same height through Again → What did they say?
    → Help me answer → keep a word
  - no horizontal scroll anywhere
  - nothing covers the NPC's name, the input bar or the hint chips
- Run `scripts/webkit-probe.swift` at 390 and 1024. Put screenshots
  (walking, in a talk, translation with ☆, the "!" cue) into
  `docs/world-game/review/r/`.

## 12. You, dressed your way — character creator, wardrobe, clothes shops (added 2026-09-29)

**When:** after §11 (R1–R4) and §10 (P1–P4, J1–J3), before the X12
play-through (so the browser pass covers it). Order: … R → P/J → **W1–W7**
→ X12 → M6.

**The learner's decisions (final):**
- **Body and face too**, not only clothes: a character creator.
- **Changing happens at home**: clothes at the 衣柜 (wardrobe), body, face
  and hair at the 镜子 (mirror) — both in your room at the 四合院. Shops
  only let you *try on* (试衣间); you change into what you bought when you
  get home (or wear it out of the shop right after buying it — "穿着走",
  one tap on the receipt; that is the one exception).
- **Real famous shops and real brands**, by their real names.

All standing rules apply (§0; own pixel art only; help is free, never a
test; companion speaks English; stable compact UI — no layout shift, check
at 375 / 768 / 1024 and in WebKit; hanzi-design tokens, dark mode; the
§5 budget plus situation words for clothes).

**Real names, done respectfully:** shop names and signs in Chinese as the
shops really write them, drawn in our own pixel lettering — **no logos,
no copied designs or photos, no slogans**. Facts in the companion's
"About this" (Why?) note only when you are sure of them (look them up; if
unsure, say less): 瑞蚨祥 — the silk and 旗袍 shop on 大栅栏; 内联升 —
cloth shoes (布鞋) on 大栅栏, since the Qing; 盛锡福 — the hat maker on
王府井; 王府井百货大楼 — the big department store; 李宁 and 回力 — Chinese
sports brands (sneakers, tracksuits); 三里屯太古里 — the fashion streets.
Prices are the game's own (economy.md), never claimed to be the shops' real
prices. Nothing in the game mocks or misrepresents a real shop.

**No gendered locks:** every garment (旗袍, skirts, 中山装, 西装) can be
worn by any body. Nothing in content assumes the player's gender: lines
that address you use your name or 你; if a line needs a word like
小伙子 / 姑娘, it reads the creator's **address** choice (below).

### W1 — the layered hero (art pipeline; the hard part first)
- Split the people drawer (`scripts/world/art/gen/chars.ts`) into layers,
  each drawn for the same 4 directions × 3 frames on the same 16×32 box:
  **body** (build + skin), **face** (eyes, brows, mouth; blush optional),
  **hair** (style + colour; back and front parts so hats sit right),
  **bottom**, **top** (with sleeves on the arms), **shoes**, **hat**,
  **accessory** (scarf, glasses, bag). Draw order per direction is data
  (a scarf is in front going down, behind going up).
- **Two builds** (a broader and a slimmer silhouette — shoulders, waist,
  hips; same height) and **five skin tones**, all from the palette. Faces:
  4 eye shapes × 3 brows × 2 mouths. Hair: at least 10 styles (short, buzz,
  side part, long, ponytail, twin buns, bob, curly, 刘海 fringe, bald)
  × 8 colours.
- Garments are drawn once each and **recoloured by palette swap** (2–5
  colours per item), packed into an `outfit` atlas (`public/world/art/
  outfit.png/json`, built by `npm run world:art`).
- **Runtime composer** `composeHero(look)` (engine): draws the chosen layers
  into one canvas texture with **the same frame names as today**
  (`hero/down-0` …), keyed by a hash of the look; the scene only swaps the
  texture key, so walking, the bike, depth sorting, photos and emotes are
  untouched. Re-compose only when the look changes. The same composer
  (pure pixel code shared with the build) is used by `render-map.ts` for
  review shots and postcards, and by the dialogue `Portrait` for 我.
- Checks: every layer has every frame; nothing draws outside the box; the
  outline stays closed for a sample of looks; frame time unchanged on the
  iPad (compose once, not per frame).

### W2 — data and save
- `content/world/clothes.json` (zod, checked by `world:check`):
  `{id, zh, en, slot: hat|top|bottom|shoes|accessory, measure: 件|条|双|顶|副|个,
  colours: [{id, zh (红的/蓝的…), palette}], price, shop, when?, story?}`.
  Hair styles, faces and builds are a catalogue in code (not bought).
- **Save format +1**: `look` ({build, skin, face: {eyes, brows, mouth},
  hair: {style, colour}, address: name|小伙子|姑娘}), `wardrobe` (owned
  `item:colour` ids), `outfit` (slot → `item:colour`), `outfits` (3 saved
  sets). Upgrade: old saves get today's hero look (short black hair, blue
  jacket, red scarf, dark trousers, white shoes) as owned clothes and as
  the outfit, and `created: false`. Merge: wardrobe union; look, outfit
  and outfits from the later save.
- Clothes are **not in the bag** (they would crowd it); the recycler can buy
  one from the wardrobe sheet ("Sell" on its card) at half price.
- Actions: `create`, `wear`, `take_off`, `save_outfit`, `buy_clothes`
  (through the shop engine — a paid line whose item is clothing goes to the
  wardrobe), diary: 「我买了一件红毛衣。」「今天我穿了旗袍。」.

### W3 — the character creator (创建角色)
- Shown **once**: on a new game (first open, or after Start over) before
  the first morning; on an existing save the first time after this ships,
  prefilled with today's hero, with "Keep this look" as one tap.
- One screen, big preview in the middle turning through the 4 directions
  (drag to turn), rows below: 身体 build (2) · 肤色 skin (5 swatches) · 眼睛
  / 眉毛 / 嘴 · 发型 (grid) · 发色 (8 swatches) · "People call me" (your
  name / 小伙子 / 姑娘). Chinese labels with English under them, as the
  ⚙ panel does. 🎲 Surprise me. Done. No name here — 王阿姨 still asks it.
- Tests: the creator's choices round-trip through the save; every
  combination composes.

### W4 — your room: 衣柜 and 镜子
- Two new props in `siheyuan-room` (a wardrobe on the wall side, a mirror
  on a stand), marked by "Mark what I can use". Look at the 衣柜 → the
  **wardrobe sheet**; look at the 镜子 → the creator again (body, face,
  hair; your clothes stay).
- Wardrobe sheet: the turning preview on the left (on top on phones),
  six slot rows on the right (帽子 · 上衣 · 裤子/裙子 · 鞋 · 配饰 · and 发型
  shown for reference with "change at the mirror"); each row a strip of
  owned things as small tiles with the colour; tap to wear, tap again to
  take off (hat, accessory; a top and a bottom are always worn). 套装 1–3
  to save and put on a set. A tile's long-press / ⓘ opens its card: hanzi,
  pinyin, measure word (一件毛衣), where bought, Sell.
- Changes show on the world sprite as soon as the sheet closes.

### W5 — clothes shops (real ones)
- A **rack talk** on top of Y1's shop engine: the seller's 「你好！随便看看。」;
  the **rack sheet** shows the shop's clothes as cards (picture on your own
  body, hanzi, price, colour dots). Tap → **试衣间**: your preview wearing it
  (everything else as you are). Say or tap: 「这件多少钱？」→「一百五。」,
  「有红的吗？」→ the colour switches (or 「没有红的，有蓝的。」), 「我可以试试吗？」,
  「太贵了」 (bargain only at 潘家园, Y6's engine), 「我要这件」 → pay by the
  支付宝 flow (Y2) → the receipt offers **穿着走** (wear it out) or 放进衣柜.
  💡 offers each phrase; the rack's buttons always work too.
- Shops (new doors on streets that exist, plus two small new maps):
  - **瑞蚨祥** (前门 · 大栅栏, new interior): 旗袍, 唐装, silk scarves.
  - **内联升** (前门 · 大栅栏, new interior): 布鞋 in several colours.
  - **盛锡福** (王府井, a door on 王府井大街): hats — 毛线帽, 草帽, 鸭舌帽, 礼帽.
  - **王府井百货大楼** (王府井, new two-floor interior with stairs): 毛衣,
    外套, 羽绒服 (winter only), 衬衫, 裤子, 裙子, 西装.
  - **李宁 / 回力** (三里屯 · a shopfront each on 三里屯 street): sneakers,
    tracksuits, T恤.
  - **南锣鼓巷 文创 shop** (a door on 南锣鼓巷): 胡同 T恤, 帆布包, 熊猫 caps.
  - **潘家园 vintage stall**: 中山装, old caps, round glasses — bargained.
  - **理发店** (exists): hair styles for 20–40 元 with a short talk
    (「剪短一点」「染成棕色」) — the one place besides the mirror that
    changes hair, and it's paid.
- Stock by season and festival (`when`): 羽绒服 and 毛线帽 in winter, 草帽
  in summer, red things around 春节, 汉服 hire at the 元宵 finale.
- Economy: a basic outfit (T恤 + 裤子) is affordable after two days of
  jobs; the 旗袍 and 西装 are things to save up for; update economy.md and
  the solver's `spendAll` check (the whole game still finishes when a
  player buys clothes).

### W6 — people notice
- The first time you wear something new, one friend comments once (a note
  in NPC memory, X2): 王阿姨 「新衣服？真好看！」, 老刘 「穿得很精神！」. Red
  at 春节: neighbours smile, +1 heart once per festival. 兔儿爷's English
  remarks: a T-shirt in the snow, the umbrella and a 旗袍, a hat indoors.
- Photos and postcards (X6) show your outfit; the diary mentions a new one.
- No stats, no penalties, nothing in the story requires buying clothes.

### W7 — checks
- Tests: composer (every frame of every layer), save upgrade + merge,
  wardrobe actions, rack talk played by the solver with hints, economy.
- `world:check`: every clothes item has art for every colour and frame, a
  shop that sells it, a measure word; shops' names and facts listed in
  `docs/world-game/brands.md` with the source you checked.
- Review renders: every garment in 4 directions on both builds
  (`review/w/`), the creator, the wardrobe sheet and a rack at 375 / 768 /
  1024 light/dark; WebKit probe.

---

## 13. One long story through real Beijing — cutscenes, temples, books, substories, your own bike (added 2026-09-29, night)

**When:** now, before the X12 play-through and M6 (both still wait for the
learner). Order: **Z0 → K1–K3 → Q1–Q3 → V1–V4 → T1–T5 → B1 → S1–S10 → U1–U5
→ L1–L4 → N1–N2 → V5 → Z9**. Each task is one or more commits; tick the
box in the same commit. If a session ends mid-way, the order above is
also the order of value: the tools (cutscenes, clear quests) make every
later task better, the story is the heart, the rest is flavour.

### 13.0 What the learner asked for, and why (read this first; it decides every trade-off)

The learner (HSK 1–2, 20–30 minutes a day, learns Chinese from English)
said, in their words:
- *"My primary focus is learning the language — not playing longer."* The
  game is a **reason to hear, read and say Chinese in real situations**,
  wrapped in a story good enough that they want to come back tomorrow.
  Nothing here is grind, collect-a-thon or a timer. If a feature does not
  make the learner hear, read or say more Chinese, or understand Chinese
  culture better, or remove friction from doing so, **cut it**.
- *"One long main story that immerses me in Chinese culture, and makes me
  visit every (or almost every) place."* Today the main story is 40 steps
  over 8 quests (3–7 steps each). Most of the city — and most of the good
  content — sits in 57 side quests that are easy to miss. By an audit of
  `quests.json`, no main step points at: 北海 north, 景山 park, 药店,
  小卖部, 雍和宫 street, 天安门 square, 百货大楼, 国贸 plaza, 瑞蚨祥,
  内联升. There is no real temple interior at all (雍和宫 is a street,
  天坛 has no 祈年殿 of its own).
- *"Books to read, in English and Chinese, about events in the culture, so
  I understand how the game relates to real Chinese culture."*
- *"Side quests should be more explicit."* (This **reverses** §10's
  "vague leads" decision — log it under Decisions.)
- *"Cutscenes for important events, so I know I am doing something
  correctly."*
- *"The graphics more animated and good looking, embracing the style. More
  Chinese temples. The map should remind me of real Chinese places."*
- *"At least 3 substories — a bit comedic — with memorable, charismatic
  characters, and cutscenes."*
- *"Real Beijing sounds."*
- *"A bike I can buy in a shop, and ride anywhere."*
- **Art packs:** the learner approved downloading **CC0-only** pixel-art
  packs (check each license page; credit in `public/world/CREDITS.md`
  even when CC0; recolour to our palette). CC-BY or unclear → do not use.
- **Story:** the learner chose **deepen the existing chapters, not
  rewrite**: keep the lantern-and-spirits frame and every scene that
  works; add a human thread, many more steps, routes through every place.
  Saves in progress must keep working.

All standing rules still apply (§0; concept wins; Beijing only; no
dialect; companion speaks English; help is free, never a test, no
penalties; stable compact UI — no layout shift, 375 / 768 / 1024, WebKit,
light/dark; hanzi-design tokens; own or CC0 art; homages, never copies;
the §5 word budget plus situation words; everything in the world save
with an upgrade + test). **Save format: v12 → v13 in K1, and each later
task that adds fields bumps once more** (write each bump in Decisions).

**Quality bar for every feature below.** Before building a task, write a
short design note for it in `docs/world-game/s13/<task>.md` (why it helps
the learner, what exactly the player sees, data, edge cases, what you
decided not to do). Keep it to one screen. Then build. This is how the
learner asked for it: *thought through, not there for the sake of
existing*. A feature you could not make good is better left as a note
than shipped half-done.

---

### Z0 — the story bible and the place audit (write before any content)

**Why:** 100+ new scenes written across several sleepy sessions will
drift (names, tone, facts, what each chapter teaches) unless one document
holds the truth. Write it first; every content task reads it.

Create `docs/world-game/story.md` with:
1. **The throughline — 团圆 (reunion).** It is the emotional heart of the
   Chinese year (中秋, 春节, 元宵 are all about families being together),
   so the story teaches the culture by being about it:
   - The lantern that broke in chapter 1 is a **走马灯** (revolving
     lantern) that 王阿姨's grandfather, a lantern maker, painted for her
     when she was small; each spirit is one of its painted panels. Keep
     what the content already says ("hung there since her grandmother's
     time" can become "her grandparents'" — adjust the one line).
   - 王阿姨's son **小军** works abroad (already in `story-wang`). He
     loved the lantern as a boy. Each spirit you bring back lights one
     panel, and 王阿姨 remembers one thing about the family (a 20–40 s
     **memory cutscene** in the yard, K2). The memories build a picture of
     three generations in one 四合院 — the learner lives this Beijing
     family's story, not a tourist's.
   - The story ends on **春节** (小军 comes home; 年夜饭 all together) and
     **元宵** (the mended lantern is lit in the courtyard, and the
     spirits — now friends — take their places in it). `story-wang`
     (calling him) becomes the setup: keep it a side quest, but chapter 9
     requires that call to have happened and offers it again if not.
   - 兔儿爷's own small arc: he is a 中秋 clay toy (a real Beijing folk
     toy); he fears that when the lantern is whole he goes back to clay.
     At 元宵 he doesn't — 王阿姨 puts him on the windowsill "where he
     belongs", and he winks. Light, never sad for long.
2. **Every chapter as a table**: places in visit order (every map in the
   game must be in some chapter's route — list the few that are allowed
   not to be, with the reason, e.g. `hutong-proto`), the cultural focus,
   the book (B1), the 成语, the spirit, the cutscenes, which substory
   episodes sit on its route, and which side quests its route passes.
3. **The cast sheet**: every named character (existing 51 + new) with
   voice, sprite, catchphrase, how they speak (HSK level, speed, habits),
   and which chapters they appear in. Main people recur across chapters —
   王阿姨, 老刘, 李阿姨, 张师傅, 赵爷爷, 小明 should each appear in at least
   three chapters outside 鼓楼 (they visit, they call, they send you).
4. **Facts register** `docs/world-game/facts.md` (like `brands.md`): every
   real-world claim a line, a book or an "About this" note makes, with the
   source you checked. **Look facts up** (WebSearch / WebFetch are fine
   for reading); if you cannot confirm one, soften it ("people say…") or
   drop it. Items below marked *(check)* are ones I believe but you must
   confirm.
5. **Place audit** (script): `scripts/world/coverage.ts` prints, for each
   map, which main steps / side quests / substory episodes / books point
   at it; `world:check` fails if a map (except a listed exception) is on
   no main route by the end of S10. Commit the script in Z0 with the
   exception list; it will fail until S10 — gate it behind a flag
   (`WORLD_COVERAGE=strict`) until then.

---

### K — cutscenes and "you did it" (the tool every later task uses)

#### K1 — the cutscene runner
**Why:** the learner wants to *know* they did something right, and big
moments should feel big. Today a finished step is a line in a dialogue;
the game never shows it. Cutscenes also give listening practice with
context (you *see* what is said).

**Data** — `content/world/<district>/cutscenes.json` (zod in
`core/content.ts`, checked by `world:check`):
```ts
{ id, map, title?: {zh, en}, letterbox?: true, music?: Mood | 'sting-*',
  cast?: [{ actor: 'hero'|'rabbit'|npcId|'spirit:<id>'|'extra:<sprite>', at: Tile, facing }],
  steps: Step[] }
Step =
 | { camera: Tile | actor, ms?, zoom? }          // pan / follow / zoom (integer zooms only)
 | { move: actor, to: Tile | Tile[], speed? }     // walks by A* if one tile given
 | { face: actor, dir } | { emote: actor, kind }
 | { say: actor, zh, en, voice? }                 // the dialogue box, read-only; tap to go on
 | { wait: ms } | { fade: 'in'|'out', ms?, colour? } | { flash } | { shake: ms }
 | { title: { zh, en } }                          // a chapter card: big 楷 title, English under
 | { fx: 'sparkle'|'petals'|'snow'|'lanterns-rise'|'fireworks'|'butterflies'|'incense'|'danmaku'|'seal', at?, n?, text?: string[] }
 | { sound: SoundId } | { music: Mood | Sting }
 | { spawn: actor, at, facing? } | { despawn: actor }
 | { together: Step[] }                           // steps that run at once
```
- **Pure core** `core/cutscene.ts`: validates a script against the map
  (tiles in bounds and walkable for `move`, actors on the cast or map),
  computes the step list the engine runs, and the `say` lines that the
  budget checker and voice builder must see. Tests.
- **Engine** `engine/cutscene.ts`: runs steps with Phaser tweens and the
  existing camera; the clock is paused (as in talks); people the cutscene
  doesn't use keep idling but don't walk into the cast; input is
  captured. Particle textures are made once at boot (iPad frame time).
- **UI**: letterbox bars (a transform, not a layout change), the dialogue
  box in read-only mode (tappable words and 拼 still work — they pause
  the cutscene), **Skip** = hold ⏭ for 0.6 s (a tap would be too easy to
  hit by mistake), 兔儿爷 is silent during cutscenes unless scripted.
- **Triggers**: a scene action `{ do: 'cutscene', id }` (runs after the
  talk closes), and `onDone` on a quest step. A cutscene can end with
  actions (`then: Action[]`, same as scene actions) so it can give items
  or move the story.
- **Replay**: Journal → Story shows ▶ on every chapter entry with a
  cutscene seen — the Journal only, one place for it. Save (v13):
  `seen: string[]` of cutscene ids.
- **Rules:** a cutscene is **at most 40 s** unless it is a chapter finale
  (90 s); every Chinese line in it follows §5; never in a cutscene
  anything the player must *do* (no hidden quiz); it must make sense with
  sound off (the lines are on screen).
- **Checks:** runner tests; `world:check` validates every script;
  the solver runs every cutscene headless (it only checks that it ends and
  its `then` actions apply); a probe records a strip of 6 frames per
  cutscene to `review/k/<id>.png` so the learner can see them in the
  morning without playing.

#### K2 — "you did it": step seals and story beats
**Why:** most steps finish silently. A tiny, consistent reward after each
step tells the learner they understood — which is the whole point of the
game (understanding shows in what you do).
- **Step done:** a red seal 「✓」 stamps in at the top centre with the
  step's `past` line (J1 already has one for every step) and a soft wood
  block + chime; 1.8 s; does not block input; never moves layout (an
  overlay in a fixed box). The NextHop chip (under the minimap) then
  shows the next step with a gentle glow once.
- **Quest done:** a bigger seal with the quest name, the stamp, and the
  reward line (item / 成语 / friend heart) — 2.5 s — then, for main
  chapters, the chapter-finale cutscene.
- **Spirit returned (every chapter):** a short standard cutscene
  (`spirit-return` template with the spirit id): the spirit glows, turns
  into light, flies off the screen to the north-east (home), then a 3 s
  cut to the courtyard: one panel of the lantern lights up. **Then the
  memory cutscene** (Z0): 王阿姨 by the lantern tells one memory in 2–4
  simple lines (HSK 1–2, the English under), next time you are home.
- **Right answer in a talk:** already shows ✓ on your line (dialogue box
  rework); keep it, don't add more.
- Settings ⚙: "Celebrations: full / quiet" (quiet = seals only, no
  sound). Default full.

#### K3 — chapter openings and finales
One **opening** per chapter: the title card (第二章 · 水与山 · *Water and
the hill*), a slow pan over the district's landmark with its real sounds
(N1), 兔儿爷's one English line on what we are here for. One **finale**
per chapter (spirit-return + memory). Write them with S1–S10; K3 is the
template and the first two (ch1 opening, ch1 finale) done here to prove
the runner. Also convert the existing big moments to cutscenes: the
lantern breaking (ch1), the view from 景山 (ch2), the 回音壁 whisper
(ch4), the dragon's eyes (ch7 → 画龙点睛 is *the* moment of the game:
the brush stroke, lightning, the dragon rising over 太和殿).

---

### Q — clear quests and less friction

#### Q1 — side quests you can't miss (explicit)
**Why:** the learner wants side quests explicit; vague leads hid 57
quests' worth of language practice.
- **Markers over people** (engine, pixel art, 8×10): a red 「!」 paper tag
  = a main-story person to talk to now; a gold 「!」 = a side quest you can
  start now; a small 「…」 = a person with the next step of a quest you're
  on. Shown only when the person's scene could start **now** (J2's "could
  hold now" logic); on the minimap as dots in the same colours.
  ⚙ "Quest marks: on / off" (on by default).
- **Journal → Side**: every available side quest by name, giver, place,
  the first thing to do, what it gives (a story / a 成语 / an item / a
  friend), and its time window — no vague leads any more. Quests whose
  scene can't start yet show *when* ("mornings 6–9", "at 中秋", "after
  chapter 3"). Grouped by district, your district first. Show on map.
- **Metro map**: a small count on each district bubble ("3 new · 1 on").
- **On arriving** in a district with side quests near the main route,
  兔儿爷 says once per district per chapter: "Someone here could use a
  hand — 李阿姨 at the 小卖部." (English, one line, never repeated.)
- **Chapter-end nudge:** before a chapter's finale cutscene, if side
  quests *of this district* are open, 兔儿爷 lists up to 2: "Before we
  go…" — one tap to go on anyway. Never blocks.
- Update the J2 tests and the "vague lead" copy; log the reversal.

#### Q2 — waiting for a day or a festival
**Why:** the story now reaches 春节 and 元宵, and some quests wait for
mornings or a festival. Walking in circles to wait is dead time for a
20-minute learner.
- The bed in your room: 睡觉 (to 7:00, today) **and**, when something
  the player follows waits for a later day, "睡到…" with that day's name
  (「睡到中秋」「睡到星期六早上」— one day = one week, calendar.ts). Only
  offered when a tracked or main step needs it; each skipped day gets a
  one-line diary entry so the diary has no hole.
- The NextHop chip says *when* for a step that waits ("After 17:00 —
  sit on the bench to wait" already exists for some; make it general: a
  `wait here` button where a bench/café exists).

#### Q3 — "last time" recap
**Why:** after a day away, a learner forgets both the plot and the words.
- On opening the game after ≥ 12 real hours: a small card over the world
  (not a cutscene): 兔儿爷's 2–3 English lines of what's going on (from
  the Story journal's last entries + the current step), and **the 3–5
  Chinese words of the last session** (from the talks you had — the save
  already knows who you talked to; keep the last session's new words in
  the save, max 8) as chips with 🔊. Tap = the word drawer. One button:
  "Let's go".

---

### V — the look: temples, real streets, animation

**Why:** the learner finds the world flat. Seen in the pane (2026-09-29):
streets are 16-tile strips where grey roof bands take ~40 % of the screen,
one tree, empty paving; the courtyard is mostly bare floor; 兔儿爷 draws
over the hero's head when he's behind; everything is still. The style
target stays Pokémon Black/White (§9, concept §12): 3/4 view, big
buildings of many tiles, soft 2–3-shade palette, outlines on characters
and props, **lively idle animation everywhere**.

#### V1 — CC0 packs (approved by the learner 2026-09-29)
- Candidates: **Ninja Adventure** (Pixel-boy & AAA; 16×16, East-Asian
  roofs, nature, interiors), **Kenney** RPG Urban Pack / Roguelike City /
  Roguelike Indoor / Tiny Town. **Read each license page**; only CC0
  (or public domain). Record URL, license text, date in
  `public/world/CREDITS.md` and `content/world/art/vendor/README.md`.
- Import through `recolour.ts` into the one palette. Use packs for what
  is generic (trees, bushes, water edges, rocks, grass variety, furniture,
  modern city: cars, street lights, benches, shopfronts at 三里屯/国贸,
  interior clutter). **Beijing-specific architecture stays ours** (V2),
  but may start from a pack's roof tiles recoloured.
- Don't mix sizes (16 px only) or styles that fight (no pack with thick
  black outlines on ground tiles).

#### V2 — the Beijing architecture kit
Draw (in `scripts/world/art/gen/`, `.px` or code) modules so any building
is assembled from them, in **3/4 view with the roof's pitch visible**
(not flat bands): each roof type has a ridge, slopes, eave, and a front
face row, and buildings cast one-direction shadows.
- **Roofs** — the real hierarchy is itself culture (put it in a book):
  grey 筒瓦 of houses (硬山, gable ends), **green** 琉璃 for princes' and
  temple halls, **yellow** 琉璃 only for the emperor (故宫, 天坛's walls),
  **blue** 琉璃 for heaven (祈年殿). Types: 硬山 (houses), 歇山 (halls,
  temples), 庑殿 (太和殿), 攒尖 pavilions (景山 万春亭), the triple
  round roof of 祈年殿, 重檐 double eaves, with 脊兽 ridge beasts on
  palace roofs (a row of tiny figures — count matters: 太和殿 has the
  most, *(check)* 10).
- **Walls and fronts:** red pillars, 彩画 painted beams (blue-green 旋子
  for temples; 苏式 story paintings for 长廊), lattice windows, 门钉 on
  palace doors (9 × 9 *(check)*), 门墩 stones at 四合院 gates, 垂花门
  (the inner courtyard gate), 影壁 screen walls, grey 胡同 walls with
  doors, 汉白玉 marble balustrades and stairs, 丹陛 carved ramps, 金水桥.
- **Temple set:** 山门, 钟楼/鼓楼 pairs, 香炉 incense burners (with smoke,
  V3), 转经筒 prayer wheels (雍和宫), 石碑 on 赑屃 tortoises, 牌楼 /
  牌坊 archways (wood and glazed), 石狮 pairs (male with a ball, female
  with a cub *(check)*), a 白塔 dagoba, bells, 蒲团 cushions, 签筒.
- **Street life props:** 胡同 overhead wires, AC boxes, 煤棚, parked
  bikes and 三轮车, washing lines, stacked 大白菜 (winter), 春联 and 福
  on doors (at 春节 — the X4 "couplets on the gate" leftover), 小广告
  stickers, 公厕 sign, 早点 steamers (笼屉), 烤串 grills, 冰糖葫芦
  stands, 修车摊, newspaper kiosks, 共享单车 racks, bus stop signs.
- **North–south streets:** today lanes only run east–west because the kit
  has no side-view walls. Add side-facing wall/roof tiles so streets can
  run N–S (南锣鼓巷, 王府井, 前门大街 all run N–S in reality).
- Review sheet `review/v/kit.png`; `art.test.ts` for every new frame.

#### V3 — animation everywhere (engine + atlases)
- **Animated tiles and props**: `frames` + `fps` in the atlas JSON; one
  global animation clock in the engine (no per-object timers — iPad).
  Required list: water (后海, 北海, 金水河; 3–4 frames + sparkle), lanterns
  swaying and flickering at night, flags on 天安门 and 国贸, 香炉 incense
  smoke, 早点铺 steam, 烤鸭 chimney smoke, 烤串 smoke, prayer wheels
  turning when you walk past (雍和宫), trees swaying (2 frames, random
  phase), willow strands at 后海, a fountain at 奥林匹克, traffic lights,
  the 鼓楼 drum being struck at the real show times *(check the hours)*,
  the station's escalator.
- **People**: hero 4-frame walk, run, idle breathing, pedalling (L2);
  NPC idle actions from their card (`idle: 'fan'|'knit'|'birdcage'|'chess'
  |'taiji'|'dance'|'kongzhu'|'jianzi'|'read'|'phone'|'sweep'`, 2–4 frames),
  so 赵爷爷 swings his bird cage, 老刘 fans himself, the 广场舞 group
  dances in time with the music, chess players move pieces.
- **Weather and seasons on the tiles**: gold ginkgo leaves drifting in
  autumn (Beijing's signature), snow on roofs and 胡同 edges in winter,
  puddles + ripples in rain, 柳絮 in spring; crows at dusk in winter
  (N1).
- **Light**: warm light pools under lanterns and lit windows at night
  (additive sprites, pre-drawn), morning mist on 后海, a slow sun-shaft in
  temple halls. The night blue tint exists (D6) — keep it.
- **Depth sort fix**: sort by feet y every frame for every moving sprite
  (兔儿爷 now draws over the hero's head when he is behind).
- Frame time check on the iPad profile (D7): no more than +2 ms per frame
  in the busiest map; if over, lower particle counts, never remove life.

#### V4 — redraw the weak art
The fox (九尾狐) and the dragon (龙) are the weakest (STATUS); give every
spirit a proper sprite with a 2–4 frame idle, and a **woodcut-style
picture** for 图鉴 and the lantern panels (48×48, the lantern's painted
look — flat colours, black outline; the "no woodcuts in the content yet"
leftover). The hero's new 4-frame walk must keep W1's layered composer
working (every layer gets the extra frame).

#### V5 — the final look pass (after the content, before Z9)
Walk every map in the pane at 1024 day and night and at 375; fix empty
stretches (no more than ~6×6 tiles of bare ground without a prop, a
person or a texture change), roof bands > 25 % of the screen, props that
float, people that clip. Before/after renders per map in `review/v/`.

---

### T — maps that look like the real places, and the temples

**Why:** the learner wants to recognise real Beijing. Real layouts also
teach real directions (「往北走」 means something when 南锣鼓巷 really runs
north–south). Use real geography as a *reference* (OpenStreetMap, official
site maps — read them, never copy tiles or images); simplify freely, but
keep the **shape, order and orientation** a visitor would recognise.

#### T1 — 鼓楼 · 南锣鼓巷 redone
- **南锣鼓巷 runs north–south**, with 胡同 branching east and west like
  a centipede's legs (people call it 蜈蚣巷 *(check)*); 帽儿胡同 (your
  home) is one of the western ones. The 早点铺, 小卖部, 理发店, 茶馆
  stay on it. Station 南锣鼓巷 at the south end *(check which end;
  exits on 地安门东大街 / 平安大街)*.
- **钟鼓楼**: the 鼓楼 south, the 钟楼 north, a square between them
  (钟鼓楼广场) — one map with both towers; the 钟楼 is new. A 胡同 west
  of the square leads to **烟袋斜街** (a slanted street — draw it stepped)
  and on to 银锭桥 (T2).
- **鼓楼东大街** (new strip): the **bike shop** and the 修车摊 (L1), a
  shop or two, the bus stop.

#### T2 — 什刹海 · 北海 · 景山
- 后海 and 前海 with **银锭桥** between them (the view from it to the
  western hills — 银锭观山, *(check)* one of the 燕京小八景), bars and
  willows along the shore, 恭王府 as a door (X9's 诗社 lives there —
  check where its scenes are now and give it a real gate).
- **北海**: 琼华岛 with the **白塔** (built 1651 for the Fifth Dalai
  Lama's visit *(check)*) — new map `beihai-baita` (永安寺 steps up to
  the dagoba, the lake below, boats).
- **景山**: the five pavilions on the ridge, 万春亭 in the middle, the
  view south over the whole palace (the ch2 cutscene).

#### T3 — the temples (new maps; each is a real place with its real layout, simplified)
- **雍和宫** (Lama Temple): the gate street exists; add the temple itself
  in two maps: the front courtyards (incense, 转经筒, halls in green-and-
  yellow roofs) and the back hall **万福阁** with the huge standing
  Maitreya carved from one sandalwood tree *(check: 18 m above ground)*.
  The real history for B1: a prince's mansion (the future 雍正 emperor)
  that became a lamasery in 1744 *(check)*.
- **孔庙 · 国子监**: the Confucius temple beside the academy (both on
  国子监街, which has the painted 牌楼 archways *(check: four)*); the
  stone tablets with the names of 进士 exam graduates *(check number)*.
- **天坛**: the central axis north → south: **祈年殿** (the round blue
  triple-roofed hall — its own map), 丹陛桥, 皇穹宇 with the 回音壁
  (exists), **圜丘** (the round open altar; the centre stone 天心石 where
  your voice echoes back *(check)* — a second listening moment). Morning
  life in the park: 太极, singing groups, 毽子 (exists in part).
- **白云观** (Daoist; station 木樨地 or 南礼士路 on line 1 *(check)*):
  the stone monkeys hidden in the carvings that people touch for luck
  (摸石猴 *(check: three monkeys)*), 窝风桥 where people throw coins at a
  bell in a giant coin (打金钱眼) at the 春节 temple fair *(check)*.
  Used by chapter 5 (new) and 春节.
- **东岳庙** (folk Daoist; near 朝阳门 *(check station and line)*): the
  halls of the "departments" of the afterlife (七十六司 *(check)*) — kept
  gentle and funny (a department for everything), a real contrast right
  next to 国贸's towers for chapter 6.
- **地坛** (the temple fair 庙会 at 春节 *(check that 地坛庙会 is held
  and where)*; the X4 leftover): an open park map dressed for 春节 (stalls,
  performers, crowds, 糖人, 风车) only during the festival; plain park
  otherwise.
- Add only stations on lines the game already models (`metro.ts`); if a
  temple's real station is on an unmodelled line, add the line only if
  small and true, otherwise arrive by bus (as 颐和园 does) — log it.

#### T4 — 王府井 · 前门 · 故宫 realism pass
- **王府井大街** north–south, the pedestrian street with 百货大楼 on the
  east side *(check)*, 新华书店, the snack street 小吃街 on the west side
  *(check)*.
- **前门大街** north–south from the 前门 gate (箭楼), the old tram
  (铛铛车), **大栅栏** going west off it with 瑞蚨祥 and 内联升, 老舍茶馆
  (a door — the X9 茶馆 homage can live there).
- **故宫**: 午门 → 太和门 → 太和殿's huge square → 中和殿/保和殿 → 乾清宫
  → 御花园 → 神武门, in order; 九龙壁 (it is in the east, near 皇极殿
  *(check)*) as its own small map (exists).

#### T5 — checks
- `map-probe` renders every new and reworked map at day and night
  (`review/t/`), a before/after pair for each reworked one.
- `build-maps.test.ts`: every door leads somewhere, every N–S street
  walks, every station exit matches `metro.ts`.
- `world:check`: every new map is in a district, in `hoods.ts` (M1), has
  a thumbnail (M1), and is on some chapter's route (Z0 coverage).

---

### B — books: read the culture in Chinese and English

**Why:** the learner wants to understand how the game's events relate to
real Chinese culture, and reading is the skill the game trains least. A
book is also the perfect **graded reader**: short, illustrated, with a
reason to read (the story needs what's in it).

#### B1 — the reader and the book format
- **Data** — `content/world/books/<id>.json` (zod, `world:check`):
  `{ id, zh, en, level: 1|2|3, cover: sprite, source: 'gift'|'shop'|'found',
  pages: [{ zh, en, pic? }], today: { zh, en }, place?: mapId, facts: [factId] }`.
  - 6–10 pages, each **≤ 60 characters of Chinese** in 1–4 sentences, an
    optional 64×48 picture (V2 kit, or a spirit's woodcut).
  - **The English is a faithful translation** (sentence by sentence), not
    a summary — the learner checks their understanding against it.
  - The last page is always **「今天的北京 · In Beijing today」**: what
    you can still see or do in real Beijing (the 鼓楼 drums are still
    played, the 祈年殿 was rebuilt after a fire in 1889 *(check)*, people
    still touch the 白云观 monkeys at 春节…). This is the bridge the
    learner asked for between the game and real culture.
  - **Level:** books 1–4 HSK 1–2 only (+ ≤ 3 situation words, glossed on
    first use); books from chapter 5 on may use HSK 3 words (≤ 10 %),
    glossed. `budget.ts` checks them like lines (new rule set `book`).
- **Reader UI** (`ui/BookReader.tsx`, a full sheet in the menu's paper
  style): one page at a time, page turn by swipe / ‹ ›; the Chinese on
  top, **English hidden under a tap by default** (a "Show English" toggle
  remembered per device — the learner can choose to read side by side);
  拼 toggle; tap a word → the app's word drawer; 🔊 reads the page (the
  NPC voice builder renders book pages with a narrator voice — G2 worker
  if it runs, system voice otherwise; `build-voices` learns a `book`
  kind); unknown words marked as in the app's reader (reuse
  `src/domain/reading.ts` helpers, don't copy the app's Passage). No
  layout shift between pages (fixed page box).
- **Where books live:** a **书架** (bookshelf) prop in your room (tap →
  the shelf sheet: covers on shelves, the ones you don't have as grey
  spines with where to get them), and Collection → a 书 view (5th inner
  tab; the collection tab stays one tab). Books are not bag items (like
  clothes).
- **Reading is part of the story, not homework:** each chapter's book is
  *given* on the main route (a person hands it to you, or it's where the
  clue is), and **the next step needs something the book says** — e.g.
  the 门神 must be repainted facing each other, and only the book tells
  you they are the generals 秦琼 and 尉迟恭; the 圜丘 echo only works if
  you stand on the centre stone the book mentions. The player can also
  just ask 兔儿爷 (help is free): he answers in English and says "it's in
  the book, page 3" — reading is encouraged, never forced.
- **Diary:** 「我读了《门神的故事》。」 Save: `books: {id: {got, readPages}}`.

#### The book list (write each with its chapter in S1–S10; titles are working titles)
| # | Book | Chapter | What it's about (verify every fact in facts.md) |
|---|---|---|---|
| 1 | 《灯笼》 | 1 | lanterns, the 走马灯, 元宵 and 灯谜 — how our lantern works |
| 2 | 《石狮子》 | 1 | guardian lions: the pair, ball and cub, why at gates |
| 3 | 《晨钟暮鼓》 | 1 | the Drum and Bell towers kept the city's time; drums still played |
| 4 | 《什刹海》 | 2 | the lakes, 银锭桥, skating in winter; the 白塔 |
| 5 | 《狐假虎威》 | 2 | the fox and the tiger (战国策 *(check)*), foxes in Chinese tales |
| 6 | 《门神》 | 3 | 秦琼 and 尉迟恭 guarding 唐太宗; 春节 door gods today |
| 7 | 《脸谱》 | 3 | 京剧 face colours (red 关羽, black 包公, white 曹操 *(check)*) |
| 8 | 《天坛》 | 4 | praying for harvest, 天圆地方, the blue roof, the echoes |
| 9 | 《科举》 | 4 | the imperial exams, 国子监, the names in stone |
| 10 | 《三教》 | 5 | 儒 释 道 — the three teachings you just walked through |
| 11 | 《数字》 | 6 | lucky and unlucky numbers (8 发, 4 死), 貔貅, 红包 |
| 12 | 《长廊的画》 | 7 | the Long Corridor's thousands of paintings *(check count)* |
| 13 | 《年》 | 7 | the 年兽 legend, red, firecrackers, 春联 |
| 14 | 《故宫》 | 8 | the palace, colours of power, the 9,999½ rooms legend vs the real count *(check)* |
| 15 | 《画龙点睛》 | 8 | 张僧繇 and the dragons without eyes |
| 16 | 《灶王爷》 | 9 | 小年, the kitchen god, 糖瓜 *(check northern date 腊月二十三)* |
| 17 | 《团圆》 | 9 | 年夜饭, 守岁, why everyone goes home (春运 *(check scale)*) |
| 18 | 《长城》 | epilogue | the Wall, 孟姜女, 不到长城非好汉 |
| 19 | 《自行车王国》 | L3 | the "kingdom of bicycles": 永久, 凤凰, 飞鸽, commuting in the 1980s |
| + | one per substory (U) | — | e.g. 《属相》 (胡半仙), 《煎饼果子》 (老马 & 老牛) |

---

### S — the main story, deepened (one task per chapter)

**Rules for all of S:**
- **Deepen, don't replace.** Keep every existing scene id that works; add
  steps and scenes around them. Quest ids stay; step ids stay; new steps
  get new ids.
- **Target ~12–20 main steps per chapter** (today 3–7), each step
  2–6 minutes of play: a place, a person, something to *say or do* in
  Chinese, and a small reward (✓ seal, K2). Vary what each step asks:
  ask the way, buy, read a sign, listen and choose where to go, tell
  someone what you saw, use an item, take a photo, give a gift.
- **Every place in the chapter's district is on the route** (Z0 table);
  shops that exist (药店, 银行, 小卖部, 百货大楼, the clothes shops,
  便利店) become story beats with a reason (a cold → 药店; a gift for
  王阿姨 → 百货大楼; a proper jacket for the temple ceremony → 瑞蚨祥 —
  lend clothes free if the player can't pay: **no step may require
  money the player can't have**; the solver's `spendAll` check stays).
- **One book per chapter on the route** (B1 list); one cutscene opening,
  one finale (K3), 2–4 cutscenes in between for the big beats.
- **The recurring cast visits**: at least one 鼓楼 friend appears in
  every chapter (王阿姨 phones you; 老刘 wants tea from 王府井; 小明's school
  trip is at 天坛; 赵爷爷 flies kites at 奥林匹克).
- **Save upgrade (v13 → v14 in S1):** a save mid-chapter keeps its place:
  new steps inserted *before* the save's current step count as done
  (dated like J2's skipped steps); new steps after it are simply ahead.
  New chapters shift numbers (below): upgrade `chapter` accordingly and
  test with every golden save.
- **New chapter numbering:** 1 新家 · 2 水与山 · 3 书 · 4 回声 · **5 香火
  (new)** · 6 新北京 (was 5) · 7 故事 (was 6) · 8 龙 (was 7) · **9 过年
  (new)** · 尾声 长城 + 元宵.

Per chapter (the beats listed are the minimum; the builder adds the
connecting steps):

- **S1 · 1 新家 (鼓楼 · 南锣鼓巷)** — opening cutscene (arriving with a
  suitcase through 南锣鼓巷, the 胡同 at morning). Add: 王阿姨 gives the
  lantern book 《灯笼》 when it breaks; a step at the 小卖部 (buy what
  王阿姨 needs — you read her list); 钟楼 and 鼓楼 both (book 3: listen for
  the drum at dusk — the time the book says); the 石狮子 (book 2: which
  one is the lion, which the lioness); first memory cutscene (王阿姨 as a
  girl under the lantern). Route: yard → 南锣鼓巷 → 小卖部 → 早点铺 →
  茶馆 → 钟鼓楼 → 烟袋斜街 (a glimpse, for ch2) → station.
- **S2 · 2 水与山 (后海 · 北海 · 景山)** — 烟袋斜街 → 银锭桥 (the view,
  a cutscene) → the fisherman → 恭王府 gate → boat or walk to **北海 白塔**
  (book 4) → 景山's five pavilions → 万春亭 view cutscene → the fox at
  角楼 (book 5 tells you the fox borrows the tiger's power — you must
  get the tiger's roar: a recording from 小明's toy / the 京剧 CD… let the
  builder choose; the solution comes from the book).
- **S3 · 3 书 (王府井 · 前门)** — 王府井 north–south: the 银行 (exists),
  百货大楼 (a gift for 王阿姨, a proper outfit for 京剧 night → 瑞蚨祥 on
  大栅栏; lend if poor), 书店 (the 成语 book + 《门神》 + 《脸谱》),
  小吃街 (老牛, U2), 药店 (兔儿爷 caught a cold from the 景山 wind — you
  describe his symptoms: 发烧, 咳嗽 — funny and very useful), 前门 by the
  铛铛车, the 京剧 show cutscene, the 门神 repainted facing each other.
- **S4 · 4 回声 (天坛 · 国子监 · 孔庙)** — 天坛 by the axis: 祈年殿 (book
  8; the blue roof), 丹陛桥, 回音壁 (exists), 圜丘 centre stone echo
  (a new listening beat: say a word, hear it back); 小明's school trip;
  国子监街 牌楼 → 孔庙 (book 9: find a name on the 进士 stones —
  reading), the 麒麟 at dusk (exists).
- **S5 · 5 香火 · Incense (new; 雍和宫 · 白云观 · 东岳庙)** — the
  culture chapter about belief in everyday Beijing, told with respect and
  warmth: 雍和宫 (incense etiquette — three sticks, bow; the prayer
  wheels; the Maitreya of 万福阁), 白云观 (the stone monkeys: a spirit
  hides as a fourth monkey — the chapter's spirit is **石猴** or another
  from the lantern; decide in Z0 and keep the 图鉴 consistent), 东岳庙
  (the funny "departments" — a 胡半仙 episode, U1). Book 10 《三教》.
  Nothing mocks belief; the jokes are about people, not faith.
- **S6 · 6 新北京 (三里屯 · 国贸 · 奥林匹克)** — keep the 貔貅 line;
  add 国贸 plaza (office lunch: order by phone QR), a 快递 pickup (you
  sign for a parcel from 小军! — the throughline), 甜甜's stream at
  三里屯 (U3), 鸟巢 at night cutscene; book 11 《数字》.
- **S7 · 7 故事 (颐和园 · 潘家园)** — 长廊 paintings come alive (a
  cutscene per painting you "enter": 3 short ones from 西游记, 三国,
  红楼梦 — homages, own lines), 十七孔桥 at sunset, 潘家园 bargaining for
  the 年兽 (exists); books 12, 13.
- **S8 · 8 龙 (故宫)** — the full axis (T4), the ticket in your name
  (exists), the colours of power (book 14 — a step where you choose the
  door by its 门钉 count, *(check)* 东华门 has 8 rows), 画龙点睛 as the
  game's biggest cutscene (book 15). After it: **王阿姨 says 小军 is
  coming home for 春节**.
- **S9 · 9 过年 (new; the whole city)** — 腊月 → 春节 → the week after.
  小年: 灶王爷 and 糖瓜 (book 16); buying 年货 at 前门 and 王府井
  (a list to read), writing 春联 with 老刘 (the 地书 brush mechanic), 大扫除
  the courtyard, 小军 arrives (a cutscene at the station: 王阿姨 and her
  son, and the lantern with every panel lit but one), 包饺子 (exists as
  side-jiaozi — fold it in), 年夜饭 cutscene with the whole cast, 守岁,
  fireworks, 初一 拜年 round the 胡同 (「新年好」「恭喜发财」 — 红包), the
  **地坛 or 白云观 庙会** (U2's 煎饼 contest, U1's finale). Book 17.
  If the player reaches chapter 9 away from 春节, Q2's 睡到… takes them
  to 腊月; if they're past it this year, to next year's (the calendar
  loops every 52 days).
- **S10 · 尾声 (长城 · 元宵)** — the train to 长城 (exists) with 小军
  and 兔儿爷; the spirits' farewell on the Wall (exists; add the last
  panel); book 18; then **元宵 night in the courtyard**: the mended 走马灯
  lit, the panels turning with every spirit in it, lanterns rising over
  the 胡同 (the 天官赐福 lanterns if that line is done — its finale is
  also 元宵: make them one night, both endings shown), 兔儿爷 on the
  windowsill. Credits roll over the city by day (a slow pan through every
  district you visited, with its real sounds). After the credits: free
  play continues (Keep playing, exists), and the substories that aren't
  done yet stay on.

---

### U — substories: four characters the learner will remember

**Why:** comedy makes lines stick. Each character has a clear comic
engine, a catchphrase the learner will end up saying, a warm ending, and
teaches one slice of real culture. Episodes sit **on main routes** (they
appear where the story sends you, marked with their own tag in Q1's
style — a small portrait badge) so they can't be missed; each episode is
3–6 minutes; each has at least one cutscene; each ending has a longer
one with the character's **own musical motif** (music.ts, a 4–6 note
phrase on their instrument — keep it bright, the music rule). Each has
a book (B1) and a stamp. Kind humour: laugh with people, never at a
culture, a belief or an accent.

#### U1 — 胡半仙 Hú Bànxiān, the fortune teller who is always a bit wrong
- **Who:** a sixty-ish man with a folding stool, a cloth sign 「算命」,
  round glasses and enormous confidence. Catchphrase:
  「天机不可泄露……不过，可以告诉你一点点。」 (the 成语 天机不可泄露 goes in
  the 成语 book — a hard line, §7 key-line rules). His predictions are
  hilariously safe: 「你今天……会吃饭！」
- **Episodes:** (1) 雍和宫 street — reads your face and 兔儿爷's ("你属兔！"
  — to a rabbit); book 《属相》: the 12 animals, find your own. (2)
  三里屯 phone shop — sells "lucky" numbers full of 8s; you notice his
  own number is full of 4s (the 8/4 culture of book 11). (3) your room —
  风水 advice that moves your furniture somewhere silly; the cat
  disagrees (a cutscene: the cat pushes it back). (4) 东岳庙 — he visits
  the "department of luck" to complain about his luck. (5) 春节 庙会 —
  his one real prediction comes true (「你会和朋友们一起过年」); he
  admits he's a retired maths teacher who just likes talking to people.
- **Language:** zodiac animals, numbers, 今天/明天, 会 (will), 好运.

#### U2 — 老马 and 老牛, the 煎饼 rivals
- **Who:** two 煎饼果子 sellers: **老马** (南锣鼓巷, mornings, tiny,
  fast, says 「正宗！」 about everything) and **老牛** (王府井 小吃街, huge,
  slow, says 「牛！」). Each insists his is the *real* one — the real
  debate: 天津's 馃篦儿 vs 北京's 薄脆 *(check)*.
- **Episodes:** (1) order from 老马 (the order is the lesson: 加个鸡蛋,
  不要葱, 要辣的); (2) 老牛's stall — same order, different words; (3) the
  message relay: each sends a rude message to the other; **you choose how
  to pass it on** (exactly, or kinder — the kind version starts peace,
  the exact one a comic escalation; both lead on); (4) they find out
  they were classmates in 天津 (a flashback cutscene in sepia: two boys
  sharing one 煎饼); (5) the 春节 庙会 煎饼 contest, you are the judge
  (taste, then say which you liked and why — any answer is right; they
  open a joint stall 「马牛煎饼」 in the ending cutscene). Book
  《煎饼果子》.
- **Language:** food orders, likes/dislikes, 比 comparisons (他的比他的
  好吃), 马马虎虎 finally makes sense.

#### U3 — 甜甜 Tiántian, the livestreamer
- **Who:** a cheerful 直播 streamer with a phone on a stick, who greets
  her audience with 「家人们！」 and says 「打卡！」 at every landmark.
  Gets history cheerfully wrong.
- **Episodes** on the routes of ch 2, 4, 6, 8, 10: 景山 sunset stream
  (she says 故宫 was built by 秦始皇 — you correct her with what your
  book said, by saying or choosing the simple sentence 「不对，是明朝。」 —
  if the learner can't, 兔儿爷 helps, as always); 回音壁 (her stream
  hears your whisper through the wall — comic); 三里屯 网红 café queue
  (you order for her; she's live); 角楼 (she needs you to film — the
  photo mode X6 with her in it); 长城 finale stream. **Her comments fly
  across the screen as 弹幕** (the `danmaku` fx): short real internet
  lines — 哈哈哈, 好美！, 666 (= awesome), 打卡, 主播加油 — a genuinely
  modern reading moment; the ending cutscene is all 弹幕 thanking you.
- **Language:** internet Chinese in small doses (家人们, 点赞, 关注,
  666), correcting someone politely (不对，是……), directions for a
  camera (左边一点).

#### U4 — 米沙 Mǐshā, the other learner (tones!)
- **Who:** a Russian exchange student, three months ahead of you and
  sure he speaks perfectly. He doesn't: his tones go wrong in the famous
  ways. He's kind, brave, always ready to try again — a mirror for the
  learner.
- **Episodes:** (1) 早点铺: he orders 「两个豹子」 (bàozi, leopards)
  instead of 包子 (bāozi); the seller's face; you help. (2) he wants
  水饺 (shuǐjiǎo) and asks where to 睡觉 (shuìjiào). (3) he wants to
  *ask* (问 wèn) a girl something and says *kiss* (吻 wěn) — the classic;
  cutscene of mortal embarrassment. (4) 买 mǎi / 卖 mài at 潘家园: he
  tries to buy and accidentally sells his watch. (5) 春节: he gives a
  toast at 年夜饭 with perfect tones — the ending cutscene, 王阿姨 claps.
  Every mistake is a **real minimal pair** (verify each pair's pinyin
  and tones); every episode ends with 兔儿爷 saying the two words so
  the learner *hears* the difference (🔊 on both). Book 《声调》 — tones
  with his mistakes as examples.
- **Language:** tones, the thing learners fear most, made funny.

#### U5 — checks
Every episode played by the solver with its hints; `world:check`: each
substory has ≥ 4 episodes, each on some chapter's route, each with a
cutscene; the four motifs render (offline audio check, as for music).

---

### L — your own bike (and the shop that sells it)

**Why:** a bike is *the* Beijing way to get around (and a culture of its
own — 自行车王国), it removes friction between nearby places, and every
part of owning one is a real conversation: buying, choosing, locking,
pumping a tyre, asking where to park.

#### L1 — the bike shop and the 修车摊
- **自行车行** on 鼓楼东大街 (T1) *(check: 鼓楼东大街 is known for
  shops; a bike shop is plausible — say "a bike shop", don't claim a
  real one)*: a shop talk on Y1's engine + the rack sheet style from W5:
  bikes as cards (your hero on each), price, colours.
- **Stock** (real brands, names only, own pixel art, add to
  `brands.md`): 永久 and 凤凰 (Shanghai classics) and 飞鸽 (Tianjin)
  *(check each)* — the old 28-inch black roadster (「二八大杠」) and a
  lighter city bike; colours; accessories: 车筐 basket, 车铃 bell (three
  sounds), 车锁 lock, 后座 rack (兔儿爷 rides it or the basket). A
  **second-hand** bike from the recycler (收破烂, X8) or 潘家园 at half
  price, bargained (Y6).
- **Prices** in economy.md: new ~400–600 元, second-hand ~150; reachable
  by chapter 3 with the daily jobs (check with the solver's economy).
  The talk: 「我想买自行车」「这辆多少钱？」「有红色的吗？」「我可以试试吗？」
  (a **test ride** up and down the street, a cutscene-lite: you ride,
  the owner shouts 「怎么样？」), pay by 支付宝 (Y2). Measure word 辆.
- **修车摊** (a street repair stand with an old master, 老师傅): 打气
  (pump, free), 补胎 (5 元), 换铃 — and he explains the bike's parts.
  L3's flat tyre sends you here.
- A side quest leads to it: 赵爷爷 remembers the 1980s when all Beijing
  rode 永久 (book 19 《自行车王国》) and says you should have one.

#### L2 — riding
- **Get on / off**: a 🚲 button in the top bar when you own a bike and
  stand outdoors (or tap your parked bike). Speed ×2 (shared bikes stay
  ×1.6 — yours is better); the pedalling frames (V3) and the bike under
  the composed hero (W1 composer + a bike layer by model and colour);
  兔儿爷 sits in the basket if you have one (cozy — the learner's rabbit
  on your bike).
- **Bell:** a tap on the bell button rings it (the synthesized bell,
  G1); people in front step aside with a line now and then
  (「慢点儿！」). Pure fun, one tap.
- **Where you can't ride** (real rules, taught by signs you read): you
  get off automatically at doors (the bike stays outside, drawn where
  you left it — the existing shared-bike parking logic, generalised); at
  park and palace gates with a sign 「禁止骑车」 / 「请推行」 *(check which
  parks forbid riding: 故宫, 天坛, 颐和园 at least)* you walk it or park
  it; **you can't take a bike on the subway** (real rule; the station
  gate says 「自行车不能进站」 *(check wording)*) — it stays at the
  station exit.
- **Riding between districts** — the big quality-of-life gain: on the
  metro map, districts within ~6 km of where you stand *(use real
  distances between stations; list them in a table)* get a 🚲 "骑车去"
  option. Riding is a short **ride cutscene** (6–15 s, skippable): you
  pedal past the landmarks between them — 长安街's wide bike lanes by
  天安门 when you ride from 王府井 west, the lake when you ride to 后海 —
  with the real sounds (N1). Game time = distance ÷ 15 km/h. You arrive
  on the district's main street with your bike. Far places (颐和园,
  奥林匹克 from the centre, 长城) are not offered — the train and metro
  stay the way there.
- **The parked bike** is on the minimap and the map (🚲 at 南锣鼓巷站 B
  口). When you come home by metro and the bike is elsewhere, 兔儿爷
  mentions it once. **Fetching it**: walk back, or phone the 修车摊
  master: 「我的车在王府井站A口，可以帮我送回来吗？」 — 10 元, it's home next
  morning (a speaking task instead of a chore; the phone UI from Y2).
- **Save** (v+1): `bike: { model, colour, parts[], at: {map, tile} |
  'riding' | 'home', flat?: day }`; merge: owned bike from either save
  (the later wins on colour/parts), position from the later save.

#### L3 — small life with the bike
- **Flat tyre** — at most once a week (seven game days), never during a
  cutscene or a timed step: 「车胎没气了！」, you can still walk it; the
  nearest 修车摊 is on the map; 打气 or 补胎. Never a penalty, only a
  conversation.
- **Lock it** — getting off outside a place shows the 车锁 once as a
  one-tap habit (「锁车」); an unlocked bike is *never* stolen (no
  penalties) — 王阿姨 just tells you off with a smile once.
- **Photos** with your bike (X6), diary lines 「我骑自行车去了后海。」,
  friends notice a new bike once (W6 notice).
- Side quest `side-bike` (shared bikes) stays; its ending now points to
  the shop.

#### L4 — checks
Solver: buy a bike in chapter 3 with jobs' money and ride every
"骑车去" pair; the gate rules; the parked-bike-on-metro case; save
upgrade + merge; review renders of every model/colour in 4 directions
(`review/l/`); the shop at 375 / 768 / 1024 light/dark (rack-probe).

---

### N — real Beijing sounds

**Why:** listening is the skill that needs the most hours; real city
sounds with real words teach it for free. Today there are pigeon
whistles, bike bells, a crowd murmur and a station chime (G1).

#### N1 — voices of the city (pre-rendered with the voice worker, G2; system voice fallback)
- **Metro:** the real announcement pattern *(check today's wording on
  Beijing lines)*: 「下一站：王府井。」 + English 「Next station:
  Wangfujing.」, 「换乘1号线的乘客，请在本站下车。」, 「请站稳扶好」,
  「开左侧门」 — on every ride; the station names are the words the
  learner needs anyway.
- **吆喝 street cries**, by place and hour: 「冰糖葫芦——」, the knife
  grinder 「磨剪子嘞——戗菜刀——」 in the 胡同 (a real old Beijing cry), the
  recycler's loudspeaker 「高价回收旧冰箱、旧彩电、旧手机……」 (very
  real, very funny), 「热乎的烤红薯！」 in winter, the 早点铺's 「包子，
  热乎的！」 in the morning.
- **Life:** the 鼓楼 drums at the show hours *(check)*, the 钟楼 bell,
  temple chanting murmur + 木鱼 at 雍和宫, a 京剧 radio from a courtyard
  window, 麻将 clatter from a 胡同 door in the evening, 广场舞 music at
  18–21 (the dance crowd moves to it, V3), cicadas (知了) in summer,
  crows at dusk in winter, firecrackers at 春节 (not all night — a few
  bursts), the 外卖 rider's 「您的外卖到了！」, the electric scooter's
  「请注意，倒车」.
- Each sound is placed in `audio/mix.ts` by map, hour, season and
  festival (pure, tested, as G1). The ones with words are **tappable**:
  the last heard street line appears for 4 s as a small caption at the
  screen edge (Chinese, tap → English and the word drawer). ⚙ "City
  voices: on / off".
- **CC0 recordings:** under the learner's CC0-only approval you may use
  CC0 ambience recordings (credited) for non-speech sounds (crowd, rain,
  temple bell) if they sound clearly better than synthesis. Speech is
  always our own voices.

#### N2 — checks
`mix.test.ts` for every new rule; an offline render of each new sound
(node-web-audio-api in the scratchpad, as the music check); loudness
matched to the music (ducks in talks, as music does).

---

### Z9 — the end-of-§13 check and the morning notes
- Solver plays the whole game start → 元宵 credits with only its hints,
  including every substory; golden saves at each chapter start (new
  ones for ch 5, 9); every old golden save upgrades and finishes.
- Coverage strict (`WORLD_COVERAGE=strict world:check` passes): every
  map on a main route except the listed exceptions.
- WebKit + Chromium probes: cutscene (letterbox, skip, a line tap), the
  reader (a page, English toggle, 拼), the bike shop, Journal → Side at
  375 / 768 / 1024 light/dark.
- `review/`: `k/` (cutscene strips), `t/` (maps before/after), `v/` (kit,
  animations as strips), `l/` (bikes), `b/` (a page of each book).
- Morning notes in STATUS.md (Russian, as before): what to play first
  (chapter 1 from a new game to see the new opening and route; then a
  golden save at chapter 5 for the temples), what's unchecked, the facts
  you could not confirm.
