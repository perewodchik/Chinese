# 走走 — build status

The builder reads `prompt.md` §0, then this file, and continues at the
first unchecked box. Tick a box in the same commit as the work.

## For the learner (morning notes)
**2026-09-28, сессия остановлена после A3 (по просьбе).** Готово: A1 (Phaser 4.2.1, каркас `src/world/`, `shared/world.ts`, `content/world/README.md`), A2 (типы и zod-схемы контента — ошибки называют файл и путь, напр. `scenes[0].nodes[0].expect[0].go`), A3 (игровые часы: 1 мин = 1 час, пауза по причинам, сон до 7:00). Смотреть первым: `src/world/core/types.ts` — модель сохранения и контента, на ней строится всё остальное. Графики и скриншотов пока нет (`review/` пуст). Ничего не запушено. Следующая задача — A4.

## Current task
D7

## Tasks
### A — core logic
- [x] A1 Setup (phaser, skeleton, shared/world.ts, content README)
- [x] A2 Types + content schemas
- [x] A3 Clock
- [x] A4 Save reducer + migrate
- [x] A5 Merge
- [x] A6 Grid + A*
- [x] A7 Conditions, quests, schedule
- [x] A8 Dialogue (source, scripted, match, universal, normalize)
- [x] A9 Word budget + content check
- [x] A10 Travel (subway, bus, train)
- [x] A11 Pinyin IME

### B — saves in the database
- [x] B1 Server: world_saves (SQLite + Postgres), service, /api/world, tests
- [x] B2 Client sync: local copy, scheduler, merge on conflict, offline

### C — art
- [x] C1 Palette + pixel builder + recolour
- [x] C2 Free packs (CC0/CC-BY only) + CREDITS
- [x] C3 Beijing modules, hero, 兔儿爷, NPC bases
- [x] C4 Prototype: 胡同 street + 天安门 gate, screenshots in review/

### D — engine
- [x] D1 WorldPage /play/world + Phaser boot, full screen on phones
- [x] D2 Maps + camera
- [x] D3 Movement (tap, hold, double tap, pinch, keyboard)
- [x] D4 Doors and transitions
- [x] D5 Life (NPC idle/routines, crowd, pigeons)
- [x] D6 Light and time of day
- [ ] D7 Performance

### E — overlay UI
- [ ] E1 Top bar
- [ ] E2 Dialogue bubble
- [ ] E3 Input bar (voice / keyboard / IME)
- [ ] E4 Companion 兔儿爷
- [ ] E5 Panels (tasks, bag, map, 图鉴, 成语 book, stamps)
- [ ] E6 Game settings
- [ ] E7 The /play card

### F — MVP content
- [ ] F1 District 鼓楼 · 南锣鼓巷 maps + interiors
- [ ] F2 NPC cards
- [ ] F3 Chapter 1 scenes
- [ ] F4 Subway ride to 天安门
- [ ] F5 MVP check + notes for the learner

### G — audio
- [ ] G1 Ambient sounds
- [ ] G2 NPC voices (if the local voice worker runs)

### H — the rest of Beijing
- [ ] H1 Ch. 2 后海 · 景山 · 北海
- [ ] H2 Ch. 3 王府井 · 前门
- [ ] H3 Ch. 4 天坛 · 雍和宫 · 国子监
- [ ] H4 Ch. 5 三里屯 · 国贸 · 奥林匹克公园 (+ 点单 doors)
- [ ] H5 Ch. 6 颐和园 · 潘家园
- [ ] H6 Ch. 7 故宫
- [ ] H7 Epilogue 长城
- [ ] H8 Side quests + 共享单车

### I — finishing
- [ ] I1 LiveDialogue hook (disabled)
- [ ] I2 iPad pass
- [ ] I3 Final summary

### X — Beijing+ (prompt §9½, before other cities)
- [ ] X0 QA harness: quest solver, golden saves, map probe, crash guard, stress; fix A–I
- [ ] X1 Usable items + gifts
- [ ] X2 Friendship hearts, NPC memory, personal stories
- [ ] X3 Diary 日记
- [ ] X4 Calendar, festivals, weather
- [ ] X5 Room decoration + the 胡同 cat
- [ ] X6 Photos, postcards, stickers
- [ ] X7 兔儿爷 alive
- [ ] X8 Beijing life activities
- [ ] X9 Book side quests (骆驼祥子, 茶馆, 城南旧事, 红楼梦, 孔乙己, 西游记, 三国演义)
- [ ] X10 Tales and festival stories
- [ ] X11 《天官赐福》 homage line
- [ ] X12 Final bug hunt over everything

### J — 上海 (only if A–I and X are done before 10:00, see prompt §10)
- [ ] J0 The world knows about cities (types, save v+1, map switcher)
- [ ] J1 Design concept-shanghai.md
- [ ] J2 Home, 外滩, 南京路, 人民广场 maps
- [ ] J3 NPCs + chapters 1–2
- [ ] J4 豫园 · 城隍庙, 田子坊, 新天地
- [ ] J5 武康路, 静安寺, 陆家嘴
- [ ] J6 Day trips 朱家角, 杭州 西湖
- [ ] J7 Finale on the Bund, side quests
- [ ] J8 Train from Beijing, flight out to Chengdu
- [ ] J9 Play-through check + notes

### K — 成都
- [ ] K1 Design concept-chengdu.md
- [ ] K2 Home, 宽窄巷子, 人民公园 maps
- [ ] K3 NPCs + chapters 1–2
- [ ] K4 锦里 · 武侯祠, 春熙路 · 太古里
- [ ] K5 熊猫基地, 文殊院, 杜甫草堂
- [ ] K6 金沙, 玉林路 at night
- [ ] K7 Day trips 都江堰 · 青城山, 三星堆; finale
- [ ] K8 Side quests, ways back between cities
- [ ] K9 Play-through check + notes

## Decisions made without the learner
_(date — decision — why)_
- 2026-09-28 — Phaser 4.2.1 (latest stable on npm), not 3.x — the brief says latest stable; the API we use (scenes, tilemaps, cameras, tweens) is the same.
- 2026-09-28 — A8: polite words (你好/谢谢/再见/对不起) are checked *after* the scene's intents, not before — otherwise 「你好，请问地铁在哪里？」 would get only 「你好！」. Requests (再说一遍, 慢一点, X是什么意思, 听不懂) are checked first, as §4.4 says.
- 2026-09-28 — A8: a match "by sound only" (卖 for 买) is accepted from the keyboard too, not only from voice, with the same "I heard …" note — a homophone picked by mistake in the IME is the same slip, and help is free.
- 2026-09-28 — A8: dictionary access goes through a small `Lexicon` interface (words / syllables / gloss) built from the app's library, so `core/` stays free of fetch and DOM. Erhua is dropped on both sides (哪儿 = 哪 = `nar`).
- 2026-09-28 — A8: `DialogueSource` got a third method, `proceed(state)`, for "tap to go on" at nodes that expect nothing; `Turn` carries the next `state` and a `companion` cue (hint step, heard-as, not Chinese, unknown word).
- 2026-09-28 — The learner's uncommitted additions to prompt.md (§10 Shanghai/Chengdu), concept.md (rule 5) and STATUS.md (phases J, K) were committed together with A8, since STATUS.md has to be committed with every task.
- 2026-09-28 — A9: the "≤ 15 % HSK 2 per scene" rule is only applied to scenes of 20 words or more — in a five-word scene one HSK 2 word is already 20 %, and §5 allows one per line. Fewer than 3 situation words is a warning, not an error (a ticket window may honestly need only 交通卡); more than 8 is an error. The simpler line and the hint's full sentence are checked like normal lines. Unknown words (no band anywhere) count as above HSK 2.
- 2026-09-28 — A9: `npm run world` currently runs only the check (`world:check`); art → maps → content are added to it as C1/F1 bring those scripts.
- 2026-09-28 — A10: Line 10 is modelled only as its eastern arc 北土城 → 十里河 (a line with two ends, "往十里河方向"), not the whole loop — its loop direction names I could not verify offline. Line 2 is the full loop, forward = clockwise = 外环. Fares: Beijing's distance bands with 1.3 km per stop; bus 2 元; 京张高铁 to 八达岭长城 20 元. Bus numbers: 332 (西直门 → 动物园 → 颐和园) is the real old line; **34路 天坛东门 → 潘家园 is a stand-in number** — check before relying on it. 北京北站 is a walk from 西直门.
- 2026-09-28 — A11: IME candidates also include words that only the characters' own entries know (你好 is not on the 2026 word lists but is in 你's entry), ranked after list words of the same band. `toneless()` now keeps ü apart from u (nǚ → nv) — it used to fold it into u.
- 2026-09-28 — B1: the ETag of a world save is `"w<rev>"` (the workspace's is `"r<rev>"`), so the two can never be confused in a cache. A conflict has its own error class (`WorldConflictError`) whose 409 body carries `current: WorldSaveDto`.
- 2026-09-28 — B2: on open, a device copy with unsent changes is merged with the server save (not just "newer wins"), so a session played offline on the iPad and one on the Mac both survive. After three conflicts in a row the sync shows `failing` and retries in 15 s. A save on the server from a newer app build puts sync in `outdated`: the game plays on from the device copy but never writes.
- 2026-09-28 — C1: no image library is installed, so the art pipeline has its own small PNG writer/reader on `node:zlib` (RGBA out; RGBA/RGB/grey/palette in, non-interlaced). One palette of 45 lettered colours (`scripts/world/art/palette.ts`); `.px` supports `= mirror <frame>`, copies and `variant: name r>n …` palette swaps for NPC bases. Recolour maps to the nearest palette colour in Lab space and can emit an editable `.px`.
- 2026-09-28 — C2: **no packs downloaded.** Fetching files from the internet needs the learner's own OK, and nobody was awake to give it; the brief allows drawing everything with the C1 pipeline, so the game uses only its own art. Candidates for the learner to approve later (all listed as CC0 by their authors — re-check the license page before downloading): Kenney "RPG Urban Pack" (16×16, modern streets — good for 三里屯/国贸), Kenney "Roguelike City/Indoor" packs, Ninja Adventure by Pixel-boy & AAA (16×16, has East-Asian roofs). `content/world/art/vendor/README.md` says how to add one, `recolour.ts` fits it to the palette.
- 2026-09-28 — C3: the art is drawn *in code* (`scripts/world/art/gen/`) and written out as editable `.px` sources: 31 Beijing tiles, 8 character bases × 12 frames (hero, auntie, grandpa with stick, kid, young woman, delivery rider, tourist, working man) with 12 palette-swap variants, 兔儿爷 (8 floating frames), 6 props (lantern unlit/lit, 槐树, bicycle, 三轮车, subway sign, bird cage). A test keeps the committed `.px` equal to the generator; a file edited by hand (first line no longer "# generated") is left alone. Review sheets: `docs/world-game/review/c3-*.png`. The subway sign shows a generic train, not the real Beijing Subway logo.
- 2026-09-28 — C4: the map format of §6.1 was built now rather than in F1 (`src/world/core/maptext.ts`, `scripts/world/build-maps.ts` → Tiled JSON in `public/world/maps/`), so the prototype is two real map files (`content/world/maps/hutong-proto`, `tiananmen-proto`). New map object `prop` (tree, lantern, bike… from the props atlas, with a footprint and an optional light). The art build also writes `tiles-set.png/json`, a plain 8-column tileset for Tiled maps.
- 2026-09-28 — C4: **screenshots are from an offline renderer** (`scripts/world/render-map.ts`), not from the browser: this unattended session is not allowed to start a dev server. The renderer follows the engine scene's rules (layers, depth by feet, integer zoom, multiply tint, additive glow). The engine itself (`src/world/engine/`, route `/play/world?map=…&time=…`) builds and type-checks but has **not been seen running** yet — first thing to check in the morning.
- 2026-09-28 — C4, what looks weak: roofs are flat stripes (no curved hip ends, no ridge beasts); the arch tiles show a seam above each arch; plaza slabs read as bricks; people are all the same height and pose (fine for NPCs, but the hero needs more character); the night glow of lit windows is a plain disc. Not below "B/W-ish indie" enough to redo before D, so I carried on (brief: one more task only if clearly below).
- 2026-09-28 — The learner added prompt §9½ (phase X) and its STATUS section during the night; both were committed with C4 unchanged.
- 2026-09-28 — D1: `/play/world` is a fixed box under the site bar; below 690px it is the whole screen (site bar hidden via `html[data-world-full]`, like 点单) with a small ‹ to leave. Phaser (1.7 MB, 380 KB gzip) is its own chunk, loaded only there. Zoom is an integer: min(width/320, height/200), clamped 2–4 (iPad landscape ×3, phones ×2).
- 2026-09-28 — D3: pinch zoom only picks whole-number zooms between 0.75× and 1.5× of the page's zoom (iPad ×3 → 3 or 4), so pixels stay square — the brief's "0.75–1.5" as a range, rule §9's "integer scaling only" as the step. Hold starts after 320 ms and then steps toward the finger; a second tap within 300 ms near the first runs. The on-screen joystick (off by default) is not built yet — left for E6 with the setting.
- 2026-09-28 — D4: the page now plays on the real save (`useWorldSave` → WorldSync from B2): every step is a `move` (synced at most every 30 s), every arrival an `enter` (synced soon). A saved place on a map this build does not have (the new game's `siheyuan-room` until F1) falls back to the prototype lane. `?map=` / `?time=` stay as development switches. The two prototype maps are joined by edge exits (east end of the lane ↔ west side of the square) to exercise transitions.
- 2026-09-28 — D5: how busy a map is lives in its header (`crowd:`, `pigeons:`, `bikes:`). Passers-by and cyclists are ambient only — they cross from one border tile to another, do not block the hero and cannot be talked to. People standing about blink (new `down-blink` frame for every character) and turn. NPC *routines* need NPC cards, which arrive with F2: the scene will then place people from `schedule.npcsOnMap` via the page.
- 2026-09-28 — D6: lights are additive glow sprites plus one full-map multiply rectangle for the tint (not Phaser's Light2D) — cheaper on iPad Safari and the same on every GPU. The part of the day changes softly (3 s) without reloading the map. The game clock runs on the page: 1 real s = 1 game min while free in the world and the tab is visible; stopped in lines/panels; the save gets a `tick` every 10 game minutes. Weather: `setWeather('rain'|'snow')` exists, nothing calls it.

## Problems / notes
_(anything blocked, skipped, or failing in someone else's code)_
- Dev servers cannot be started from this unattended session (preview_start refuses), so nothing is checked in a browser yet: C4 screenshots are offline renders, D-phase checks will be code-level plus offline renders until a session with a person present runs the preview (`hanzi-workshop-mac-world`, port 5179, `.data/world-test.db`, added to `.claude/launch.json`).
- **B1 adds migration step 3 (`world_saves`) to both SQLite and Postgres.** It runs on the production Postgres at the first deploy after the learner pushes — an additive `CREATE TABLE`, nothing existing is touched.
