/**
 * Your own bike (§13 L): each model in each of its colours, from the side
 * (both ways), from behind (riding up the screen) and from the front (riding
 * down), 16×16 — and the basket and the rear rack as overlays drawn over it.
 *
 * The 永久 is the tall 二八大杠 with a crossbar and big wheels; the 凤凰 and
 * the 飞鸽 are lower city bikes you step through; the old one from the
 * recycler is the 永久 with rust on it. Frames: `bike/<model>-<colour>-<dir>`
 * (dir: side = facing right, side-r, up, down) and `bike/<part>-<dir>`.
 */

import { BIKES, BIKE_COLOURS } from '../../../../src/world/core/bike';
import { Grid } from './grid';

type Paint = readonly [string, string];

/** Facing right: the front wheel on the right. */
function side(kind: 'roadster' | 'city', [c, d]: Paint, rust = false): Grid {
  const g = new Grid(16, 16);
  g.oval(1, 14, 14, 2, '_');
  const f = new Grid(16, 16);
  const big = kind === 'roadster';
  const wy = big ? 8 : 9;
  const ws = big ? 7 : 6;
  for (const cx of big ? [0, 9] : [1, 9]) f.oval(cx, wy, ws, ws, 'a');
  const hub = (cx: number) => [cx + Math.floor(ws / 2), wy + Math.floor(ws / 2)] as const;
  const [rx, ry] = hub(big ? 0 : 1);
  const [fx] = hub(9);
  // seat post and saddle, head post and handlebar
  f.vline(5, 6, 6, c).hline(3, 5, 4, 'k').set(4, 5, 'm').set(5, 5, 'm');
  f.vline(12, 5, 6, c).hline(11, 4, 3, 'd').set(14, 4, 'k');
  if (big) {
    // the crossbar and the down tube
    f.hline(5, 7, 8, c).hline(6, 8, 6, d);
    for (let i = 0; i < 5; i++) f.set(6 + i, 11 - Math.floor(i / 2), c);
  } else {
    // stepped through: a low curved tube from the head down to the pedals
    for (let i = 0; i < 6; i++) f.set(11 - i, 7 + Math.floor(i * 0.8), c);
    f.hline(6, 11, 2, c).set(7, 12, d);
  }
  // chain stay to the back hub, fork to the front hub, the pedal
  f.hline(rx, ry, 7 - rx, d).vline(fx, wy + 1, ry - wy - 1, d).set(7, 13, 'k').set(8, 13, 'b');
  if (rust) f.set(8, 7, 'o').set(10, 7, 'o').set(12, 7, 'o').set(6, 11, 'o');
  f.outline('k');
  // hollow wheels with spokes and a hub, cut after the outline so they stay open
  for (const cx of big ? [0, 9] : [1, 9]) {
    f.oval(cx + 1, wy + 1, ws - 2, ws - 2, '.');
    const [hx, hy] = hub(cx);
    f.set(hx, hy, 'd').set(hx - 1, hy, 'c').set(hx + 1, hy, 'c').set(hx, hy - 1, 'c').set(hx, hy + 1, 'c');
  }
  return g.stamp(f, 0, 0);
}

/** From behind (`back`) or the front: one wheel end-on, the handlebar across, the saddle or the lamp. */
function endOn(kind: 'roadster' | 'city', [c, d]: Paint, back: boolean, rust = false): Grid {
  const g = new Grid(16, 16);
  g.oval(4, 14, 8, 2, '_');
  const f = new Grid(16, 16);
  const top = kind === 'roadster' ? 8 : 9;
  // the wheel, end-on: a dark bar with a grey tyre edge
  f.rect(7, top, 2, 15 - top, 'a').vline(8, top + 1, 13 - top, 'b');
  // fork / stays in the frame's paint
  f.vline(6, top - 1, 4, c).vline(9, top - 1, 4, d);
  // the handlebar across, grips at the ends
  f.hline(3, 6, 10, 'd').set(3, 6, 'k').set(12, 6, 'k').vline(7, 6, 3, c).vline(8, 6, 3, c);
  if (back) {
    // the saddle and a red reflector
    f.rect(6, 4, 4, 2, 'k').hline(7, 4, 2, 'm').set(7, top + 2, 'r').set(8, top + 2, 'R');
  } else {
    // the lamp and the pedals either side
    f.rect(7, 7, 2, 2, 'j').set(4, 12, 'b').set(11, 12, 'b');
  }
  if (rust) f.set(6, top, 'o').set(9, top + 1, 'o');
  f.outline('k');
  return g.stamp(f, 0, 0);
}

/** A wicker basket on the handlebar. */
function basket(dir: 'side' | 'down'): Grid {
  const f = new Grid(16, 16);
  if (dir === 'side') f.rect(12, 4, 4, 4, 'z').hline(12, 4, 4, 'M').vline(13, 5, 3, 'M').set(15, 7, 'M');
  else f.rect(5, 7, 6, 4, 'z').hline(5, 7, 6, 'M').vline(7, 8, 3, 'M').vline(9, 8, 3, 'M');
  f.outline('k');
  return f;
}

/** A rear rack over the back wheel. */
function rack(dir: 'side' | 'up'): Grid {
  const f = new Grid(16, 16);
  if (dir === 'side') f.hline(0, 7, 6, 'c').set(1, 8, 'b').set(4, 8, 'b');
  else f.rect(5, 6, 6, 2, 'c').hline(5, 7, 6, 'b');
  f.outline('k');
  return f;
}

/** A U-lock, for the shop's card. */
function lock(): Grid {
  const f = new Grid(16, 16);
  f.rect(4, 3, 8, 8, 'c').rect(6, 5, 4, 6, '.').rect(3, 9, 10, 5, 'y').hline(3, 13, 10, 'Y').set(8, 11, 'k').set(8, 12, 'k');
  f.outline('k');
  return f;
}

export function bikeFrames(): Array<[string, Grid]> {
  const out: Array<[string, Grid]> = [];
  for (const m of BIKES) {
    const rust = m.id === 'jiuche';
    for (const colour of m.colours) {
      const paint = BIKE_COLOURS[colour].paint;
      const s = side(m.kind, paint, rust);
      out.push([`${m.id}-${colour}-side`, s], [`${m.id}-${colour}-side-r`, s.mirror()]);
      out.push([`${m.id}-${colour}-up`, endOn(m.kind, paint, true, rust)], [`${m.id}-${colour}-down`, endOn(m.kind, paint, false, rust)]);
    }
  }
  const b = basket('side');
  const r = rack('side');
  out.push(['basket-side', b], ['basket-side-r', b.mirror()], ['basket-down', basket('down')]);
  out.push(['rack-side', r], ['rack-side-r', r.mirror()], ['rack-up', rack('up')]);
  // the shop's cards for the parts
  out.push(['basket-icon', basket('down')], ['rack-icon', rack('up').shift(0, 3)], ['lock-icon', lock()]);
  return out;
}
