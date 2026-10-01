# 走走 content — source formats

Everything the game shows is authored here as text and compiled by
`npm run world` (art → maps → content → check) into `public/world/`.
The built files are committed, so Vercel needs none of the tools.

The content rules (word budget, dialogue, formats) are
`docs/world-game/spec.md`; the story is `docs/world-game/story.md`. Types and zod schemas for every format below
live in `src/world/core/types.ts` and `src/world/core/content.ts` — when this
file and the schema disagree, the schema wins.

## Maps — `maps/<id>.map.txt` + `maps/<id>.objects.json`

A map is a header, then one character grid per layer:

```
id: nanluo-main
size: 40x24
tilesets: hutong, common
district: gulou

[ground]
....................
[below]
...
[collide]
...
[above]
...
```

- `maps/legend.json` maps each character to a tile (`tileset:index`) per
  layer; `.` is always empty. In `collide`, `#` blocks and `.` is free.
- `ground` is under everything, `below` under the hero, `above` is drawn
  over the hero (eaves, tree tops), `collide` is not drawn.
- `<id>.objects.json` lists the objects: `door` (to map + tile + facing),
  `edge` exits, `sign` (hanzi text), `npc` spawns, `light`, `zone` (trigger
  a scene), `spirit` spot, `bike` stand. Tiles are `[x, y]`.

`scripts/world/build-maps.ts` writes `public/world/maps/<id>.json` in
**Tiled's JSON map format**, so a map can be opened in Tiled later, and
checks sizes, unknown characters, doors that point nowhere and spawns on
walls.

## People, scenes and collections — `<district>/*.json`

One folder per district (`gulou/`, `tiananmen/` …), each file an array:

| file | what |
|---|---|
| `npcs.json` | NPC cards: who, role, look, voice, character, what they know and want, allowed actions, routine, `explains` (words they explain in HSK 1 words) |
| `scenes.json` | scenes: where, when (condition), NPC, dialogue graph, situation words, stamp |
| `quests.json` | quests: English title, steps with conditions and "What now?" text |
| `spirits.json` | spirits: hanzi, pinyin, English, source, legend, how to befriend |
| `idioms.json` | 成语: parts with glosses, meaning, story, tier |
| `stamps.json` | stamps: place and design |
| `district.json` | the district itself: names, maps, stations, place names that do not count against the word budget |

A dialogue node:

```json
{
  "id": "ask-way",
  "say": "你好！买水果吗？",
  "simpler": "你要买水果吗？",
  "expect": [
    { "intent": "ask_subway", "match": [["地铁", "地铁站"], ["在哪儿", "在哪里", "怎么走"]], "go": "directions" }
  ],
  "hint": { "word": "地铁", "frame": "请问，___在哪儿？", "full": "请问，地铁站在哪儿？" },
  "translate": "Hi! Buying fruit?",
  "why": "吗 turns a sentence into a yes/no question."
}
```

`key: true` marks a 📌 line (one per scene at most). Pinyin is added at
build time; for a polyphone the checker asks for a `pinyin` override.

## Word budget

`scripts/world/check-content.ts` (also run by `npm test`) checks every line
against the HSK 2026 lists in `public/data/words.json`: HSK 1 free, at most
one HSK 2 word per normal line and ≤ 15 % of a scene, nothing above HSK 2
except in a 📌 key line (up to three words or one 成语) or among the scene's
situation words. Names and the district's place names do not count.

## Art — `art/`

Sprites are `.px` text files — a grid of palette letters per frame — built
by `scripts/world/art/build.ts` into atlases in `public/world/art/`.
Imported packs live in `art/vendor/<pack>/` with their license, credited in
`public/world/CREDITS.md`. Only CC0, CC-BY or public domain.

## Added while building chapter 1 (F1–F3)

- **Props** (`kind: "prop"`) may have `night` (a frame shown at evening and
  night — the stone lion's glowing eyes) and `when` (a condition: the prop is
  only there while it holds — the lantern whole, then broken).
- **Look scenes** (`trigger: "look"`) belong to the map object named by
  `object` (default: the scene's own id) on the scene's `map`. Several scenes
  may share one object with different `when`s; the lowest `priority` wins.
- **Auto scenes** (`trigger: "auto"`) start by themselves on arriving on
  their `map` (the first morning, the first visit to 鼓楼).
- A line's `speaker` may be `hero`, `companion` (兔儿爷), a spirit id, or an
  NPC id. Signs without a scene open in the bubble with their words tappable.
- Action `{ "do": "wait", "until": 19 }` lets time pass to the next 19:00
  (resting in the teahouse till dark).
- `npm run world:content` compiles the district folders to
  `public/world/content/`; `scripts/world/chapter1.test.ts` plays chapter 1
  through the core with each node's hint sentence.
