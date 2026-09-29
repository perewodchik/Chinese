# Imported art packs

One folder per pack: the original files as downloaded, with the pack's own
license file beside them, and a line in `public/world/CREDITS.md`.

Only **CC0, CC-BY or public domain**. A pack whose license is unclear is not
used. Nothing from Nintendo/Pokémon or any other commercial game, ripped or
"fan", ever.

To use a pack's tile in the game's style, recolour it onto the palette and
turn it into an editable `.px`:

```bash
npx tsx scripts/world/art/recolour.ts vendor/<pack>/tile.png /tmp/tile.png --px content/world/art/sprites/<atlas>/<name>.px
```

## Packs

| Folder | Pack | License (checked) | Used for |
|---|---|---|---|
| `kenney-rpg-urban/` | Kenney, RPG Urban Pack 1.0 — https://kenney.nl/assets/rpg-urban-pack | CC0 1.0 — the page and `License.txt`, 2026-09-30 | street lamps, bus-stop sign, traffic lights, bins, bench, hydrant, hedges, crates, barrier, trees (`scripts/world/art/import-urban.ts`) |

Looked at and **not used** (§13 V1, 2026-09-30):
- Kenney **Tiny Town** (CC0): thick dark outlines on its ground tiles — a
  style that fights ours.
- Pixel-boy & AAA **Ninja Adventure**: the itch.io page could not be read
  (403), so the license could not be checked — unclear means not used.
- Kenney **Roguelike Indoors / Roguelike Modern City** (CC0 on their pages):
  not downloaded this time — interiors and city blocks are drawn our own way
  in V2; worth a look again if V5 finds rooms too bare.
- The Urban Pack's **cars**: drawn straight from above, which fights our 3/4
  view — left out.
