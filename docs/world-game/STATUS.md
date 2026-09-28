# 走走 — build status

The builder reads `prompt.md` §0, then this file, and continues at the
first unchecked box. Tick a box in the same commit as the work.

## For the learner (morning notes)
**2026-09-28, сессия остановлена после A3 (по просьбе).** Готово: A1 (Phaser 4.2.1, каркас `src/world/`, `shared/world.ts`, `content/world/README.md`), A2 (типы и zod-схемы контента — ошибки называют файл и путь, напр. `scenes[0].nodes[0].expect[0].go`), A3 (игровые часы: 1 мин = 1 час, пауза по причинам, сон до 7:00). Смотреть первым: `src/world/core/types.ts` — модель сохранения и контента, на ней строится всё остальное. Графики и скриншотов пока нет (`review/` пуст). Ничего не запушено. Следующая задача — A4.

## Current task
A4

## Tasks
### A — core logic
- [x] A1 Setup (phaser, skeleton, shared/world.ts, content README)
- [x] A2 Types + content schemas
- [x] A3 Clock
- [ ] A4 Save reducer + migrate
- [ ] A5 Merge
- [ ] A6 Grid + A*
- [ ] A7 Conditions, quests, schedule
- [ ] A8 Dialogue (source, scripted, match, universal, normalize)
- [ ] A9 Word budget + content check
- [ ] A10 Travel (subway, bus, train)
- [ ] A11 Pinyin IME

### B — saves in the database
- [ ] B1 Server: world_saves (SQLite + Postgres), service, /api/world, tests
- [ ] B2 Client sync: local copy, scheduler, merge on conflict, offline

### C — art
- [ ] C1 Palette + pixel builder + recolour
- [ ] C2 Free packs (CC0/CC-BY only) + CREDITS
- [ ] C3 Beijing modules, hero, 兔儿爷, NPC bases
- [ ] C4 Prototype: 胡同 street + 天安门 gate, screenshots in review/

### D — engine
- [ ] D1 WorldPage /play/world + Phaser boot, full screen on phones
- [ ] D2 Maps + camera
- [ ] D3 Movement (tap, hold, double tap, pinch, keyboard)
- [ ] D4 Doors and transitions
- [ ] D5 Life (NPC idle/routines, crowd, pigeons)
- [ ] D6 Light and time of day
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

## Decisions made without the learner
_(date — decision — why)_
- 2026-09-28 — Phaser 4.2.1 (latest stable on npm), not 3.x — the brief says latest stable; the API we use (scenes, tilemaps, cameras, tweens) is the same.

## Problems / notes
_(anything blocked, skipped, or failing in someone else's code)_
