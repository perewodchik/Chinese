# 走走 — working on the game

The code layout and its rules are in `README.md` beside this file. The game's
docs are in `docs/world-game/`. Read only the row your task needs:

| Task | Read |
|---|---|
| Anything | `docs/world-game/STATUS.md` (open tasks, loose ends, latest notes; ~12 KB) |
| Writing or changing content (scenes, quests, NPC lines, books) | `docs/world-game/spec.md` §3–§6 (content model, dialogue rules, word budget, formats), `content/world/README.md` |
| A chapter or substory (§13 S/U) | `docs/world-game/s13-plan.md` (13.0 + your task), `S-howto.md`, `story.md` |
| A real-world claim (a place, a custom, a date) | `docs/world-game/facts.md` — every claim needs an entry with a source |
| A place card, a landmark's content (RW) | `docs/world-game/places.md` (readable facts per place; still check each in `facts.md`) |
| Prices, shops, money | `docs/world-game/economy.md`; real brand names: `brands.md` (`world:check` reads it) |
| Running parallel §13 sessions | `docs/world-game/parallel-sessions.md` |
| "Why does it work like this?" | grep `docs/world-game/decisions.md` for the feature — never read it whole (125 KB) |
| The original design or a built feature's first spec | `docs/world-game/history/` — only when asked |

## Rules of the game's build

- All game rules live in `core/` (pure, tested with `node --test`); a scene
  that plays wrong must be reproducible as a core test.
- The save changes only through `core/save.ts` actions. A new save field that
  an older build would drop needs a version bump in `core/migrate.ts`
  (`WORLD_SAVE_VERSION`) with an upgrade, a merge rule and a test.
- Never rename or delete a quest step id (saves find their place by it).
- Content checks: `npm run world:check`; whole-game proof: the solver and the
  golden saves in `npm test`. After changing lines, run
  `npx tsx scripts/world/build-voices.ts` on the Mac (voices are pre-rendered).
- Built files in `public/world/` load by content hash (`ui/stamps.gen.ts`):
  rebuild with the matching `npm run world:*` script, never hand-edit them.
- Art is our own code-drawn pixel art plus CC0 packs only (credited in
  `public/world/CREDITS.md`); never another game's assets.
- Learning beats playtime: a feature that doesn't make the learner hear, read
  or say more Chinese, or understand Beijing better, is cut.
- Log each judgment call you make without the learner at the end of
  `docs/world-game/decisions.md`; tick STATUS boxes in the same commit.
