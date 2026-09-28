# 走走 Zǒuzou — the game

A Pokémon-style walk through Beijing on `/play/world`. Design:
`docs/world-game/concept.md`; build brief and task list:
`docs/world-game/prompt.md` and `STATUS.md`.

```
core/     pure TypeScript — no Phaser, no React, no DOM. All game rules.
          Tested with node --test (npm test).
engine/   Phaser: draws the world and reports input. No rules.
ui/       React over the canvas: top bar, dialogue, input, companion, panels.
sync/     the save's local copy, the save scheduler, merge on conflict.
```

- The whole game state is one `WorldSave`, changed only by the actions in
  `core/save.ts`. Engine and UI read it; nothing else writes it.
- Phaser loads only on `/play/world` (lazy route + dynamic import).
- Anything with text is React DOM over the canvas: crisp hanzi, the word
  drawer, the system keyboard and speech recognition all work there.
- Source content is in `content/world/`, built output in `public/world/`.
