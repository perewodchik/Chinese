/**
 * (Lives in src/ so the game can draw the hero's layers at run time, W1;
 * scripts/world/art/palette.ts re-exports it with the colour matching.)
 *
 * The one palette every tile and sprite is drawn in — Pokémon Black/White in
 * spirit (prompt §9): bright but soft, two or three shades per surface, a
 * dark blue-black outline for characters and props, and Beijing's colours
 * (grey brick and tile, red walls, yellow glazed roofs, green-blue eaves,
 * red lanterns).
 *
 * One letter per colour, so a sprite can be written as text (`.px`). `.` is
 * always transparent. `_` is the shared shadow: blue-black at a third.
 */

export type Rgba = readonly [number, number, number, number];

const hex = (h: string): Rgba => {
  const n = h.replace('#', '');
  return [0, 2, 4, 6].map((i) => (i < n.length ? parseInt(n.slice(i, i + 2), 16) : 255)) as unknown as Rgba;
};

/** letter → [name, colour] */
export const PALETTE_SPEC: Record<string, readonly [string, string]> = {
  k: ['outline', '#23202e'],
  w: ['white', '#f8f5ec'],
  // greys: brick, tile, stone — darkest to lightest
  a: ['grey 1', '#3d4051'],
  b: ['grey 2', '#5b5f72'],
  c: ['grey 3', '#7d8297'],
  d: ['grey 4', '#a4a9b9'],
  e: ['grey 5', '#cbced8'],
  // skin
  s: ['skin', '#f4cda6'],
  S: ['skin shade', '#dca27c'],
  t: ['skin deep', '#b3785b'],
  // more skin tones for the character creator (W1): fair, tan shade, deep
  A: ['skin fair', '#fde6d0'],
  C: ['skin fair shade', '#eab999'],
  T: ['skin tan shade', '#8f5b40'],
  D: ['skin deep brown', '#7a4b33'],
  E: ['skin deep brown shade', '#57331f'],
  // reds: palace wall, doors, lanterns
  p: ['red light', '#f27d6b'],
  r: ['red', '#d8443b'],
  R: ['red shade', '#a92d2e'],
  q: ['red deep', '#761d25'],
  // yellows: glazed roof tiles, gold
  j: ['yellow light', '#fbe38a'],
  y: ['yellow', '#f4c542'],
  Y: ['yellow shade', '#d7982b'],
  o: ['ochre', '#a96d1f'],
  // greens: trees, grass, painted beams
  i: ['green light', '#a8dc72'],
  h: ['green', '#5fae55'],
  G: ['green shade', '#357d49'],
  g: ['green deep', '#22533a'],
  // green-blue of painted eaves
  x: ['teal light', '#9fdad3'],
  v: ['teal', '#4ea7b0'],
  u: ['teal shade', '#2e6f89'],
  // blues: clothes, signs, water
  l: ['blue light', '#a9c6f2'],
  n: ['blue', '#5a82d4'],
  B: ['blue shade', '#35508f'],
  W: ['water', '#4a8fd6'],
  X: ['water light', '#86c3f0'],
  // browns: wood, hair, earth
  z: ['wood light', '#c49460'],
  M: ['wood', '#8c5c3b'],
  m: ['wood deep', '#5b3a29'],
  H: ['hair', '#2d2632'],
  // ground: hutong paving and dust
  f: ['path light', '#e6d7b6'],
  F: ['path', '#cbb88f'],
  P: ['path shade', '#a99870'],
  // lights
  Q: ['window glow', '#fff1b3'],
  L: ['lantern glow', '#ffb44c'],
  O: ['lantern core', '#ff8a3a'],
  // extra
  V: ['purple', '#6b4b8c'],
  N: ['pink', '#f2a7c3'],
  _: ['shadow', '#1c1a3055'],
};

export const PALETTE: ReadonlyMap<string, Rgba> = new Map(Object.entries(PALETTE_SPEC).map(([k, [, h]]) => [k, hex(h)]));

export const TRANSPARENT = '.';

export function colourOf(letter: string): Rgba | null {
  if (letter === TRANSPARENT) return null;
  const c = PALETTE.get(letter);
  if (!c) throw new Error(`"${letter}" is not a palette letter`);
  return c;
}
