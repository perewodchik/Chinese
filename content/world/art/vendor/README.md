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

Empty for now — see STATUS.md, C2.
