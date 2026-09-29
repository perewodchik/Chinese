# 走走 Zǒuzou — credits

## Art

All pixel art in `public/world/art/` is original, drawn for this game as
`.px` text files in `content/world/art/sprites/` and built by
`scripts/world/art/build.ts` — except the generic street things listed
below, taken from free packs (CC0 only, as the learner asked) and
recoloured to the game's palette.

- **Kenney — RPG Urban Pack 1.0** (2019), by Kenney (www.kenney.nl).
  License: Creative Commons Zero (CC0),
  http://creativecommons.org/publicdomain/zero/1.0/ — checked on
  https://kenney.nl/assets/rpg-urban-pack and in the pack's `License.txt`
  on 2026-09-30. Used: street lamps, a bus-stop sign, traffic lights, bins,
  a bench, a hydrant, hedges, crates, a road barrier and four trees (two
  recoloured as gold ginkgo), cut and recoloured by
  `scripts/world/art/import-urban.ts` into
  `content/world/art/sprites/props/urban*.px`. Original sheet and license:
  `content/world/art/vendor/kenney-rpg-urban/`. Thank you, Kenney.

When a free pack is added (CC0, CC-BY or public domain only), its original
files and license go to `content/world/art/vendor/<pack>/`, and it is
listed here with author, license and link.

## Sounds

No recordings. The street's sounds — pigeon whistles (鸽哨), bicycle bells,
the murmur of people, the station chime — are synthesized in the browser
by `src/world/audio/ambient.ts` (original, nothing to license). The
station chime is three plain notes, not any real subway's jingle.

## Pictures of spirits

None yet. They will come from public-domain woodcuts on Wikimedia Commons,
each credited here.
