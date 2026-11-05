/**
 * 西游记, chapter 1 — 美猴王横空出世: six pictures, one a paragraph, for the
 * easier version and the book's text alike, drawn by hand with the kit (see
 * ../BRIEF.md). The kit has no monkeys, so they are built here the kit's way:
 * a skeleton, limbs from joints inside the body drawn before it, one ink
 * outline, no filter on a figure.
 *
 *   node scripts/texts/art/render.mjs scripts/texts/art/stories/xyj-ch1.mjs <out dir>
 */
import { flowers, grassTufts, H, hills, INK, marks, pine, svg, tree, W } from '../kit.mjs';

const ink = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const limb = (pts, width, colour) => {
  const d = pts.length === 3 ? `M${pts[0][0]} ${pts[0][1]} Q${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}` : `M${pts.map((p) => p.join(' ')).join(' L')}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + 6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const dir = (a) => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
const step = ([x0, y0], a, len) => { const [dx, dy] = dir(a); return [x0 + dx * len, y0 + dy * len]; };
const place = (x, y, s, flip, body) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${body}</g>`;
const shadow = (rx) => `<ellipse cx="0" cy="2" rx="${rx}" ry="${rx / 5}" fill="#2b3a2a" opacity="0.16"/>`;

/* ---------------------------------------------------------------- monkeys */

const FACE = '#f3d9b1';
const PALM = '#e7bf92';
const BONE = { upper: 30, fore: 28, thigh: 26, shin: 26 };

/** Arm poses, [left, right] of [upper, forearm], degrees from straight down; and their layer. */
const M_ARMS = {
  rest: { a: [[-14, -6], [14, 6]], layer: 'back' },
  wide: { a: [[-110, -130], [110, 130]], layer: 'back' },
  raise: { a: [[-14, -6], [124, 146]], layer: 'back' },
  point: { a: [[-14, -6], [100, 106]], layer: 'back' },
  wave: { a: [[-14, -6], [150, -160]], layer: 'back' },
  clasp: { a: [[-30, 100], [30, -100]], layer: 'front' },
  cheer: { a: [[-150, -170], [150, 170]], layer: 'back' },
  lap: { a: [[-20, 40], [20, -40]], layer: 'front' },
  shade: { a: [[-14, -6], [150, -112]], layer: 'over' },
  stick: { a: [[-14, -6], [34, 20]], layer: 'back' },
  pole: { a: [[60, 120], [40, 150]], layer: 'back' },
};
/** Leg poses, [left, right] of [thigh, shin]; kneel and sit are their own shapes. */
const M_LEGS = {
  stand: [[-10, -2], [10, 2]],
  jump: [[-60, -10], [60, 10]],
  walk: [[-20, -6], [16, 10]],
  kneel: 'kneel',
  sit: 'sit',
};

/**
 * A monkey. fur: its colour; hero: the stone monkey (a tuft on the head, a
 * golden coat); old: white brows and beard. face: smile | happy | shock |
 * determined | shut | worried. look: front | left | right | up. lean: the
 * body from the hips, degrees.
 */
export function monkey({ x, y, s = 1, flip = false, fur = '#8a5a38', hero = false, old = false, legs = 'stand', arms = 'rest', lean = 0, face = 'smile', look = 'front', tailSide = 1, shadowless = false, glow = false }) {
  const A = M_ARMS[arms];
  const L = M_LEGS[legs];
  const dark = shade(fur, -0.18);
  let hipY;
  let legSvg = '';
  if (L === 'kneel') {
    hipY = -34;
    legSvg = [-1, 1].map((sx) => limb([[12 * sx, hipY], [20 * sx, -8]], 15, fur) + `<ellipse cx="${20 * sx}" cy="-6" rx="13" ry="8" fill="${dark}" ${ink()}/>`).join('');
  } else if (L === 'sit') {
    // Cross-legged: thighs out, shins crossed in front, feet showing.
    hipY = -24;
    legSvg = [-1, 1].map((sx) => limb([[12 * sx, hipY], [44 * sx, hipY + 14], [-6 * sx, hipY + 22]], 15, fur) + `<ellipse cx="${-10 * sx}" cy="${hipY + 22}" rx="12" ry="7" fill="${PALM}" ${ink(2.5)}/>`).join('');
  } else {
    const pts = L.map(([t, sh], i) => { const hip = [i ? 11 : -11, 0]; const knee = step(hip, t, BONE.thigh); return [hip, knee, step(knee, sh, BONE.shin)]; });
    const lowest = Math.max(...pts.map((p) => p[2][1]));
    hipY = -8 - lowest;
    legSvg = pts.map(([h, k, f]) => {
      const P = (p) => [p[0], p[1] + hipY];
      const toe = f[0] < 0 ? -1 : 1;
      const [fx, fy] = P(f);
      return limb([P(h), P(k), P(f)], 15, fur) + `<path d="M${fx - 6 * toe} ${fy + 6} q${4 * toe} -14 ${16 * toe} -10 q${8 * toe} 4 ${6 * toe} 10 Z" fill="${PALM}" ${ink(2.5)}/>`;
    }).join('');
  }
  const top = hipY - 66; // shoulders
  const shoulders = [[-20, top + 6], [20, top + 6]];
  const armPts = A.a.map(([u, f], i) => { const el = step(shoulders[i], u, BONE.upper); return [shoulders[i], el, step(el, f, BONE.fore)]; });
  const arm = ([sh, el, h]) => limb([sh, el], 13, fur) + limb([el, h], 11, fur) + `<circle cx="${h[0]}" cy="${h[1]}" r="8" fill="${PALM}" ${ink(2.5)}/>`;
  const layerOf = () => A.layer;
  const armsIn = (layer) => (layerOf() === layer ? armPts.map(arm).join('') : '');
  // The tail roots at the lower back, behind everything, and curls up beside the body.
  const ts = tailSide;
  const tail = `<path d="M${6 * ts} ${hipY - 6} C${46 * ts} ${hipY + 4} ${70 * ts} ${hipY - 30} ${58 * ts} ${hipY - 64} C${52 * ts} ${hipY - 82} ${34 * ts} ${hipY - 80} ${36 * ts} ${hipY - 66}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
    <path d="M${6 * ts} ${hipY - 6} C${46 * ts} ${hipY + 4} ${70 * ts} ${hipY - 30} ${58 * ts} ${hipY - 64} C${52 * ts} ${hipY - 82} ${34 * ts} ${hipY - 80} ${36 * ts} ${hipY - 66}" fill="none" stroke="${fur}" stroke-width="9" stroke-linecap="round"/>`;
  const torso = `<path d="M-22 ${top} C-36 ${top + 24} -36 ${hipY + 2} -14 ${hipY + 6} L14 ${hipY + 6} C36 ${hipY + 2} 36 ${top + 24} 22 ${top} Q0 ${top - 8} -22 ${top} Z" fill="${fur}" ${ink()}/>
    <ellipse cx="0" cy="${(top + hipY) / 2 + 6}" rx="16" ry="22" fill="${FACE}" ${ink(2)}/>`;
  const hy = top - 30; // head centre
  const ox = look === 'left' ? -3 : look === 'right' ? 3 : 0;
  const oy = look === 'up' ? -4 : 0;
  const eye = (ex) => {
    if (face === 'shut' || face === 'happy') return `<path d="M${ex - 6} ${hy - 2} q6 ${face === 'shut' ? 6 : -7} 12 0" ${ink(3)} fill="none"/>`;
    if (face === 'shock') return `<circle cx="${ex}" cy="${hy - 3}" r="7" fill="#fff" ${ink(2.5)}/><circle cx="${ex + ox}" cy="${hy - 3 + oy}" r="3" fill="${INK}"/>`;
    return `<ellipse cx="${ex + ox}" cy="${hy - 3 + oy}" rx="4.6" ry="6.2" fill="${INK}"/><circle cx="${ex + ox + 1.6}" cy="${hy - 5.5 + oy}" r="1.8" fill="#fff"/>`;
  };
  const beams = glow ? `<path d="M-12 ${hy - 4} L-150 ${hy - 420} L-92 ${hy - 430} Z M12 ${hy - 4} L-40 ${hy - 440} L18 ${hy - 436} Z" fill="#ffe27a" opacity="0.8"/>` : '';
  const brows = {
    determined: `<path d="M-19 ${hy - 15} l10 4 M19 ${hy - 15} l-10 4" ${ink(3.5)}/>`,
    worried: `<path d="M-19 ${hy - 12} l10 -4 M19 ${hy - 12} l-10 -4" ${ink(3)}/>`,
    shock: `<path d="M-19 ${hy - 16} q5 -5 10 0 M9 ${hy - 16} q5 -5 10 0" ${ink(3)} fill="none"/>`,
  }[face] ?? '';
  const mouth = {
    smile: `<path d="M-7 ${hy + 13} q7 6 14 0" ${ink(2.5)} fill="none"/>`,
    happy: `<path d="M-9 ${hy + 11} q9 13 18 0 Z" fill="#a8423a" ${ink(2.5)}/>`,
    shock: `<ellipse cx="0" cy="${hy + 15}" rx="6" ry="7" fill="#a8423a" ${ink(2.5)}/>`,
    determined: `<path d="M-9 ${hy + 12} q9 8 18 0 Z" fill="#fff" ${ink(2.5)}/>`,
    shut: `<path d="M-6 ${hy + 13} q6 4 12 0" ${ink(2.5)} fill="none"/>`,
    worried: `<path d="M-6 ${hy + 15} q6 -5 12 0" ${ink(2.5)} fill="none"/>`,
  }[face];
  const ear = (sx) => `<circle cx="${36 * sx}" cy="${hy - 2}" r="12" fill="${fur}" ${ink()}/><circle cx="${36 * sx}" cy="${hy - 2}" r="6.5" fill="${PALM}"/>`;
  const tuft = hero ? `<path d="M-10 ${hy - 31} q-4 -16 6 -20 q0 10 6 12 q2 -14 12 -12 q-6 8 -2 20 Z" fill="${fur}" ${ink(2.5)}/>` : '';
  const oldness = old
    ? `<path d="M-24 ${hy - 13} q8 -9 16 -3 M24 ${hy - 13} q-8 -9 -16 -3" stroke="#fffaf0" stroke-width="6" fill="none" stroke-linecap="round"/>
       <path d="M-14 ${hy + 18} q14 30 28 0 q-2 8 -14 24 q-12 -16 -14 -24 Z" fill="#fffaf0" ${ink(2.5)}/>`
    : '';
  const head = `${ear(-1)}${ear(1)}
    <circle cx="0" cy="${hy}" r="34" fill="${fur}" ${ink()}/>
    ${tuft}
    <path d="M0 ${hy - 14} C-8 ${hy - 26} -30 ${hy - 22} -28 ${hy - 2} C-28 ${hy + 18} -16 ${hy + 28} 0 ${hy + 28} C16 ${hy + 28} 28 ${hy + 18} 28 ${hy - 2} C30 ${hy - 22} 8 ${hy - 26} 0 ${hy - 14} Z" fill="${FACE}" ${ink(2.5)}/>
    ${eye(-12)}${eye(12)}${brows}
    <ellipse cx="0" cy="${hy + 9}" rx="13" ry="9" fill="${shade(FACE, 0.05)}"/>
    <path d="M-3 ${hy + 6} h0.1 M3 ${hy + 6} h0.1" ${ink(3.5)}/>
    ${mouth}
    <circle cx="-20" cy="${hy + 8}" r="5" fill="#e89a86" opacity="0.6"/><circle cx="20" cy="${hy + 8}" r="5" fill="#e89a86" opacity="0.6"/>
    ${oldness}`;
  const upper = `${armsIn('back')}${torso}${armsIn('front')}${head}${armsIn('over')}`;
  const body = `${shadowless ? '' : shadow(L === 'sit' ? 56 : 40)}${beams}${tail}${legSvg}<g transform="rotate(${lean} 0 ${hipY})">${upper}</g>`;
  return place(x, y, s, flip, body);
}

/** Where a monkey's hand is (0 left, 1 right) in the picture. */
export function monkeyHand({ x, y, s = 1, flip = false, legs = 'stand', arms = 'rest' }, i = 1) {
  const L = M_LEGS[legs];
  let hipY;
  if (L === 'kneel') hipY = -34;
  else if (L === 'sit') hipY = -24;
  else {
    const pts = L.map(([t, sh], k) => { const hip = [k ? 11 : -11, 0]; const knee = step(hip, t, BONE.thigh); return step(knee, sh, BONE.shin); });
    hipY = -8 - Math.max(...pts.map((p) => p[1]));
  }
  const top = hipY - 66;
  const sh = [[-20, top + 6], [20, top + 6]][i];
  const [u, f] = M_ARMS[arms].a[i];
  const h = step(step(sh, u, BONE.upper), f, BONE.fore);
  return [x + (flip ? -h[0] : h[0]) * s, y + h[1] * s];
}

/** A colour lighter (+) or darker (-) by a share. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const HERO = '#c98a47';
const TROOP = ['#8a5a38', '#9b6a44', '#7d5136'];

/* ------------------------------------------------------------- scenery */

const sky = (top, bottom, sun = [860, 100]) => `<defs><linearGradient id="skyx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#skyx)"/>
  <circle cx="${sun[0]}" cy="${sun[1]}" r="170" fill="#fff4d2" opacity="0.7" filter="url(#blur18)"/>`;
const cloud = (x, y, k = 1, colour = '#ffffff') => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-90 0 q-10 -34 26 -38 q10 -30 48 -22 q22 -26 56 -4 q36 -6 40 26 q30 6 16 38 Z" fill="${colour}" ${ink(2.5)}/><path d="M-60 -10 q20 -12 40 -4 M10 -22 q18 -8 34 2" stroke="#e4e9f2" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
const sea = (y, colour = '#8fc3dc') => `<path d="M0 ${y} C200 ${y - 8} 420 ${y + 8} 620 ${y - 2} C800 ${y - 10} 920 ${y + 4} ${W} ${y - 4} L${W} ${H} L0 ${H} Z" fill="${colour}" filter="url(#wash)"/>
  ${[[60, 30, 70], [300, 60, 90], [560, 26, 60], [760, 74, 80], [900, 40, 60], [180, 110, 70], [640, 130, 90]].map(([x, dy, w]) => `<path d="M${x} ${y + dy} q${w / 4} -8 ${w / 2} 0 t${w / 2} 0" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>`).join('')}`;
/** A peach tree, small, with pink fruit. */
const peachTree = (x, y, h) => tree(x, y, h, { colour: '#7fae64', dark: '#5f8f4a', light: '#a3cc84' }) + [[-0.35, 0.1], [0.3, -0.25], [0.1, 0.35], [-0.1, -0.5]].map(([ax, ay]) => peach(x + ax * h * 0.32, y - h + h * 0.32 + ay * h * 0.32, h * 0.04)).join('');
const peach = (x, y, r = 12) => `<g transform="translate(${x} ${y})"><path d="M0 ${-r} C${r * 1.2} ${-r} ${r * 1.1} ${r} 0 ${r} C${-r * 1.1} ${r} ${-r * 1.2} ${-r} 0 ${-r} Z" fill="#f4a38f" ${ink(2.2)}/><path d="M0 ${-r} q${-r * 0.2} ${r * 0.9} 0 ${r * 1.9}" stroke="#e2806e" stroke-width="2" fill="none"/><path d="M0 ${-r} q${r * 0.7} ${-r * 0.7} ${r * 1.2} ${-r * 0.2} q${-r * 0.6} ${r * 0.4} ${-r * 1.2} ${r * 0.2} Z" fill="#7fae64" ${ink(1.8)}/></g>`;
/** The mountain of flowers and fruit: a green peak with a flat top at (x, top). */
const mountain = (x, top, w, base) => `<path d="M${x - w / 2} ${base} C${x - w * 0.36} ${top + 140} ${x - w * 0.2} ${top + 20} ${x - 60} ${top} L${x + 60} ${top} C${x + w * 0.2} ${top + 30} ${x + w * 0.34} ${top + 150} ${x + w / 2} ${base} Z" fill="#8fbf74" ${ink(2.5)}/>
  <path d="M${x - w * 0.3} ${base - 40} C${x - w * 0.2} ${top + 160} ${x - 40} ${top + 90} ${x - 10} ${top + 60}" stroke="#76a85f" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M${x + w * 0.28} ${base - 30} C${x + w * 0.2} ${top + 170} ${x + 50} ${top + 100} ${x + 20} ${top + 70}" stroke="#a6d08a" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.6"/>`;
/** A boulder, smooth and grey, its base at (x, y). */
const boulder = (x, y, w, h, colour = '#b9b4a8') => `<path d="M${x - w / 2} ${y} C${x - w / 2} ${y - h * 0.9} ${x - w * 0.2} ${y - h} ${x} ${y - h} C${x + w * 0.3} ${y - h} ${x + w / 2} ${y - h * 0.7} ${x + w / 2} ${y} Z" fill="${colour}" ${ink(3)}/>
  <path d="M${x - w * 0.28} ${y - h * 0.62} q${w * 0.12} ${-h * 0.18} ${w * 0.3} ${-h * 0.14}" stroke="#d8d4ca" stroke-width="8" fill="none" stroke-linecap="round"/>`;
/** A heavenly hall on a cloud: red pillars, golden roofs. */
const palace = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  ${cloud(0, 40, 1.5)}
  <rect x="-80" y="-60" width="160" height="70" fill="#f6e7cf" ${ink(2.5)}/>
  ${[-64, -22, 22, 64].map((px) => `<rect x="${px - 6}" y="-60" width="12" height="70" fill="#c9443a" ${ink(2)}/>`).join('')}
  <path d="M-110 -60 Q0 -78 110 -60 L90 -86 Q0 -100 -90 -86 Z" fill="#e8b13a" ${ink(2.5)}/>
  <rect x="-50" y="-112" width="100" height="28" fill="#f6e7cf" ${ink(2)}/>
  <path d="M-76 -110 Q0 -124 76 -110 L58 -134 Q0 -144 -58 -134 Z" fill="#e8b13a" ${ink(2.5)}/>
  <circle cx="0" cy="-146" r="7" fill="#f4c430" ${ink(2)}/></g>`;
/** The Jade Emperor, a little figure at a palace door, startled: robe, beard, crown. */
const emperor = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M-26 0 C-30 -30 -22 -54 0 -56 C22 -54 30 -30 26 0 Z" fill="#f2c64a" ${ink(2.5)}/>
  <path d="M0 -54 V0" stroke="#d99a2a" stroke-width="4"/>
  <circle cx="0" cy="-72" r="17" fill="#f6cfa8" ${ink(2.5)}/>
  <path d="M-9 -64 q9 22 18 0 q-2 14 -9 22 q-7 -8 -9 -22 Z" fill="#3a3330" ${ink(1.5)}/>
  <circle cx="-6" cy="-75" r="3.5" fill="#fff" ${ink(1.5)}/><circle cx="6" cy="-75" r="3.5" fill="#fff" ${ink(1.5)}/>
  <rect x="-24" y="-96" width="48" height="8" fill="#3a3330" ${ink(1.5)}/><rect x="-8" y="-104" width="16" height="10" fill="#f2c64a" ${ink(1.5)}/>
  ${[-20, -12, 12, 20].map((bx) => `<path d="M${bx} -88 v8" stroke="#c9443a" stroke-width="3"/>`).join('')}</g>`;
const waterfall = (x, top, w, bottom) => `<path d="M${x - w / 2} ${top} L${x + w / 2} ${top} L${x + w / 2 + 20} ${bottom} L${x - w / 2 - 20} ${bottom} Z" fill="#cfe9f4" filter="url(#wash)"/>
  ${Array.from({ length: 7 }, (_, i) => `<path d="M${x - w / 2 + 12 + i * (w - 24) / 6} ${top + 10} q-4 ${(bottom - top) / 2} ${-6 + i * 2} ${bottom - top - 20}" stroke="#ffffff" stroke-width="${i % 2 ? 5 : 8}" fill="none" stroke-linecap="round" opacity="0.85"/>`).join('')}
  <path d="M${x - w / 2 - 40} ${bottom} q30 -26 60 -6 q24 -24 50 -4 q26 -22 54 0 q24 -18 50 4 q30 -16 46 6" fill="#ffffff" ${ink(2)} opacity="0.95"/>`;
const cliff = (x1, x2, top, bottom, colour = '#9aa08a') => `<path d="M${x1} ${bottom} L${x1} ${top + 30} C${x1 + 20} ${top} ${x2 - 20} ${top} ${x2} ${top + 30} L${x2} ${bottom} Z" fill="${colour}" ${ink(2.5)}/>`;
const rockSeat = (x, y, w, h) => `<path d="M${x - w / 2} ${y} C${x - w / 2} ${y - h} ${x + w / 2} ${y - h} ${x + w / 2} ${y} Z" fill="#a8a294" ${ink(2.5)}/><path d="M${x - w / 2 + 10} ${y - h * 0.7} h${w - 20}" stroke="#c6c0b2" stroke-width="5" stroke-linecap="round"/>`;

/* ---------------------------------------------------------------- scenes */

/** ¶1 The sea, the mountain of flowers and fruit, the great stone on its peak. */
const s1 = svg(`${sky('#bfe0ee', '#f4efdc')}
  ${cloud(180, 130, 0.9)}${cloud(620, 90, 0.7)}
  ${hills(470, '#c9dccf', 14, 2)}
  ${sea(500)}
  ${mountain(520, 250, 700, 640)}
  ${peachTree(330, 520, 140)}${peachTree(720, 510, 130)}${pine(420, 420, 110, '#6f9f68')}${pine(640, 410, 100, '#6f9f68')}
  ${flowers([[400, 470, '#f2a6b4'], [470, 440, '#f6f0e8'], [580, 430, '#f2a6b4'], [610, 470, '#f6d24a'], [360, 560, '#f6f0e8'], [690, 560, '#f2a6b4']])}
  <ellipse cx="520" cy="250" rx="140" ry="80" fill="#fff2b8" opacity="0.6" filter="url(#blur18)"/>
  ${boulder(520, 256, 150, 130)}
  ${marks.star(430, 170, 10, '#fff2a8')}${marks.star(610, 160, 12, '#fff2a8')}${marks.star(640, 230, 8, '#fff2a8')}
  <path d="M0 768 L0 640 C60 610 120 630 160 660 C200 640 250 650 280 680 L300 768 Z" fill="#6f9f5c" ${ink(2.5)}/>
  <path d="M1024 768 L1024 630 C960 600 900 620 860 650 C820 640 780 660 760 690 L740 768 Z" fill="#6f9f5c" ${ink(2.5)}/>
  ${flowers([[60, 680, '#f2a6b4'], [140, 700, '#f6f0e8'], [220, 720, '#f2a6b4'], [880, 690, '#f6d24a'], [960, 670, '#f2a6b4'], [820, 720, '#f6f0e8']])}
  ${grassTufts([[100, 720], [240, 740], [900, 730], [980, 712]])}`);

/** ¶2 The stone bursts; the stone monkey stands in it, golden light from his eyes up to heaven, where the Jade Emperor starts. */
const s2 = svg(`${sky('#c8def0', '#f7eccf', [200, 120])}
  ${palace(810, 200, 1.05)}${emperor(810, 180, 1.0)}${marks.shout(810, 60)}
  ${cloud(560, 120, 0.6)}
  ${hills(560, '#b9d39f', 22, 1)}
  <path d="M120 768 C200 600 360 520 500 510 C640 520 820 600 900 768 Z" fill="#8fbf74" ${ink(2.5)}/>
  <ellipse cx="500" cy="520" rx="230" ry="120" fill="#fff0a8" opacity="0.7" filter="url(#blur18)"/>
  ${Array.from({ length: 10 }, (_, i) => { const a = -170 + i * 18; const [dx, dy] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]; return `<path d="M${500 + dx * 120} ${540 + dy * 100} L${500 + dx * 200} ${540 + dy * 170}" ${ink(3)}/>`; }).join('')}
  <path d="M370 600 C360 520 400 470 440 462 L470 520 L430 600 Z" fill="#b9b4a8" ${ink(3)}/>
  <path d="M630 600 C640 520 600 470 560 462 L530 520 L570 600 Z" fill="#b9b4a8" ${ink(3)}/>
  <path d="M440 462 l12 -18 l14 26 M560 462 l-12 -18 l-14 26" ${ink(3)} fill="none"/>
  ${rockSeat(500, 610, 300, 40)}
  <path d="M484 400 L742 168 L760 186 L488 408 Z" fill="#ffe27a" opacity="0.9"/>
  <path d="M514 400 L772 180 L786 200 L518 408 Z" fill="#ffe27a" opacity="0.9"/>
  <path d="M484 400 L742 168 M514 400 L772 180" stroke="#f4c430" stroke-width="2" opacity="0.8"/>
  ${monkey({ x: 500, y: 594, s: 1.25, fur: HERO, hero: true, arms: 'wide', face: 'happy', look: 'up' })}
  ${marks.star(380, 440, 14, '#fff2a8')}${marks.star(640, 420, 12, '#fff2a8')}${marks.star(330, 520, 9, '#fff2a8')}
  ${grassTufts([[200, 720], [300, 700], [700, 700], [820, 730]])}`);

/** ¶3 The monkeys climb to a great waterfall; the stone monkey jumps forward to go in. */
const s3 = svg(`${sky('#cfe6e6', '#f2f2df')}
  ${hills(380, '#c9dcc0', 30, 3)}
  <path d="M240 640 C250 520 230 420 270 330 C290 250 280 170 330 120 C360 90 400 96 430 80 L640 80 C680 96 720 90 750 130 C790 180 780 260 800 340 C830 430 810 520 830 640 Z" fill="#a9ab92" ${ink(2.5)}/>
  <path d="M300 300 q30 -20 60 6 M700 260 q30 -18 50 10 M280 480 q40 -16 70 8 M720 470 q30 -14 60 8" stroke="#c4c6ae" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M330 120 C360 90 400 96 430 80 L640 80 C680 96 720 90 750 130" stroke="#7fae64" stroke-width="16" fill="none" stroke-linecap="round"/>
  ${pine(250, 380, 200, '#7fae7a')}${pine(820, 360, 220, '#7fae7a')}
  ${waterfall(530, 90, 190, 590)}
  <path d="M0 768 L0 600 C200 580 400 620 520 606 C680 590 860 590 1024 606 L1024 768 Z" fill="#9cc27f" ${ink(2.5)}/>
  <path d="M300 640 C420 620 640 620 760 640" stroke="#cfe9f4" stroke-width="20" fill="none" stroke-linecap="round" filter="url(#wash)"/>
  ${monkey({ x: 210, y: 690, s: 0.95, fur: TROOP[0], arms: 'point', face: 'shock', look: 'right', tailSide: -1 })}
  ${monkey({ x: 320, y: 716, s: 0.9, fur: TROOP[1], arms: 'shade', face: 'worried', look: 'right', tailSide: -1 })}
  ${monkey({ x: 840, y: 706, s: 0.95, fur: TROOP[2], flip: true, arms: 'lap', legs: 'sit', face: 'worried', look: 'left' })}
  ${monkey({ x: 560, y: 690, s: 1.15, fur: HERO, hero: true, arms: 'raise', legs: 'jump', face: 'determined', look: 'up' })}
  ${marks.speed(500, 560, 3, 40)}
  ${flowers([[90, 740, '#f2a6b4'], [430, 750, '#f6f0e8'], [960, 740, '#f2a6b4']])}${grassTufts([[60, 700], [420, 712], [700, 730], [980, 700]])}`);

/** ¶4 Behind the water: an iron bridge with flowers and trees, a stone house and its tablet. */
const cave = (dark, mid) => `<rect width="${W}" height="${H}" fill="${mid}"/>
  <path d="M0 0 H${W} V180 C820 130 640 110 512 114 C380 118 200 140 0 190 Z" fill="${dark}" filter="url(#wash)"/>
  ${[[220, 150, 60], [330, 128, 90], [470, 116, 50], [600, 118, 80], [760, 132, 64], [880, 150, 44]].map(([x, y, h]) => `<path d="M${x - 18} ${y} L${x} ${y + h} L${x + 18} ${y} Z" fill="${dark}" ${ink(2)}/>`).join('')}`;
const s4 = svg(`${cave('#8a7660', '#b39c80')}
  <rect x="0" y="0" width="150" height="${H}" fill="#d7edf6" opacity="0.85" filter="url(#wash)"/>
  ${Array.from({ length: 6 }, (_, i) => `<path d="M${16 + i * 24} 0 q-4 380 6 768" stroke="#ffffff" stroke-width="${i % 2 ? 4 : 7}" fill="none" opacity="0.8"/>`).join('')}
  <ellipse cx="560" cy="380" rx="420" ry="260" fill="#fff3d0" opacity="0.5" filter="url(#blur18)"/>
  <path d="M640 520 L640 330 L880 330 L880 520 Z" fill="#b5ae9f" ${ink(2.5)}/>
  <path d="M610 336 L760 250 L910 336 Z" fill="#9a9385" ${ink(2.5)}/>
  <path d="M730 520 V420 Q760 394 790 420 V520 Z" fill="#4a4440" ${ink(2.5)}/>
  <rect x="660" y="360" width="50" height="74" rx="4" fill="#d2ccbf" ${ink(2)}/><path d="M670 376 h30 M670 392 h30 M670 408 h30" stroke="#9a9385" stroke-width="3"/>
  <path d="M0 768 L0 560 C260 540 520 560 1024 540 L1024 768 Z" fill="#9db37e" ${ink(2.5)}/>
  <path d="M60 768 C110 700 160 640 186 596 C260 586 350 586 416 596 C452 650 500 710 560 768 Z" fill="#8fc3dc" ${ink(2)} filter="url(#wash)"/>
  <path d="M230 630 q40 -8 80 0 M200 690 q40 -8 80 0 M330 720 q40 -8 80 0 M150 740 q30 -6 60 0" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>
  ${tree(560, 560, 200, { colour: '#79a865' })}${tree(950, 560, 170, { colour: '#79a865' })}
  ${peach(540, 420, 10)}${peach(590, 450, 10)}
  <path d="M150 600 Q300 470 450 600" stroke="${INK}" stroke-width="18" fill="none"/><path d="M150 600 Q300 470 450 600" stroke="#5d6b78" stroke-width="12" fill="none"/>
  <path d="M150 570 Q300 440 450 570" stroke="${INK}" stroke-width="8" fill="none"/><path d="M150 570 Q300 440 450 570" stroke="#7d8b98" stroke-width="4" fill="none"/>
  ${[170, 200, 236, 270, 300, 330, 364, 400, 430].map((px) => { const t = (px - 150) / 300; const yb = 600 - 260 * t * (1 - t); return `<path d="M${px} ${yb - 4} V${yb - 30}" ${ink(4)}/>`; }).join('')}
  ${monkey({ x: 300, y: 538, s: 0.95, fur: HERO, hero: true, arms: 'wide', face: 'happy', look: 'right' })}
  ${flowers([[480, 590, '#f2a6b4'], [520, 610, '#f6f0e8'], [620, 600, '#f6d24a'], [900, 600, '#f2a6b4'], [980, 620, '#f6f0e8'], [120, 620, '#f2a6b4']])}
  ${grassTufts([[470, 620], [640, 640], [900, 650], [1000, 630]], '#a3c48a')}
  ${marks.star(380, 420, 10, '#fff2a8')}${marks.star(240, 430, 8, '#fff2a8')}`);

/** ¶5 In the cave the monkeys hail the stone monkey as their king; the old monkey with his stick. */
const s5 = svg(`${cave('#8a7660', '#b39c80')}
  <rect x="${W - 130}" y="0" width="130" height="${H}" fill="#d7edf6" opacity="0.8" filter="url(#wash)"/>
  ${Array.from({ length: 5 }, (_, i) => `<path d="M${W - 112 + i * 24} 0 q4 380 -6 768" stroke="#ffffff" stroke-width="${i % 2 ? 4 : 7}" fill="none" opacity="0.8"/>`).join('')}
  <ellipse cx="500" cy="360" rx="300" ry="220" fill="#fff0b8" opacity="0.45" filter="url(#blur18)"/>
  <path d="M0 768 L0 560 C300 540 700 540 1024 560 L1024 768 Z" fill="#c8b48e" ${ink(2.5)}/>
  ${flowers([[90, 620, '#f2a6b4'], [140, 660, '#f6f0e8'], [930, 640, '#f2a6b4'], [880, 690, '#f6d24a']])}
  ${rockSeat(500, 470, 230, 120)}
  ${monkey({ x: 500, y: 444, s: 1.05, fur: HERO, hero: true, legs: 'sit', arms: 'lap', face: 'happy' })}
  ${peach(400, 470, 14)}${peach(610, 474, 12)}
  ${monkey({ x: 210, y: 650, s: 0.95, fur: TROOP[0], legs: 'kneel', arms: 'clasp', lean: 14, face: 'happy', look: 'right', tailSide: -1 })}
  ${monkey({ x: 350, y: 690, s: 0.9, fur: TROOP[1], legs: 'kneel', arms: 'cheer', face: 'happy', look: 'up', tailSide: -1 })}
  ${monkey({ x: 650, y: 690, s: 0.9, fur: TROOP[2], legs: 'kneel', arms: 'cheer', face: 'happy', look: 'up' })}
  ${monkey({ x: 800, y: 660, s: 0.98, fur: '#9b8f84', old: true, legs: 'kneel', arms: 'clasp', lean: -14, face: 'smile', look: 'left' })}
  ${marks.star(500, 270, 12, '#fff2a8')}${marks.star(400, 300, 8, '#fff2a8')}${marks.star(610, 300, 9, '#fff2a8')}`);

/** ¶6 Sunrise: the monkeys see him off; the Monkey King poles a pine raft out to sea, peaches aboard. */
const raftAt = [620, 560];
const s6 = svg(`${sky('#f6d6b8', '#fdf1dc', [840, 330])}
  <circle cx="840" cy="360" r="60" fill="#f7b267" opacity="0.9"/>
  ${cloud(240, 140, 0.8, '#fff7ee')}${cloud(620, 110, 0.6, '#fff7ee')}
  ${sea(380, '#9cc8da')}
  <path d="M0 768 L0 520 C120 500 240 520 330 560 C380 600 400 660 420 768 Z" fill="#e8d6ac" ${ink(2.5)}/>
  ${peachTree(90, 560, 180)}
  <g>
    <path d="M${raftAt[0] - 120} ${raftAt[1]} h240 l-10 26 h-220 Z" fill="#a07a52" ${ink(2.5)}/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M${raftAt[0] - 110 + i * 30} ${raftAt[1] + 2} v22" stroke="#7f5e3e" stroke-width="3"/>`).join('')}
    <path d="M${raftAt[0] - 126} ${raftAt[1] + 4} q-10 -12 4 -16 M${raftAt[0] + 126} ${raftAt[1] + 4} q10 -12 -4 -16" stroke="#4f7d4a" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  ${peach(raftAt[0] + 70, raftAt[1] - 10, 13)}${peach(raftAt[0] + 92, raftAt[1] - 8, 12)}${peach(raftAt[0] + 80, raftAt[1] - 28, 12)}
  ${monkey({ x: raftAt[0] - 20, y: raftAt[1], s: 1.0, fur: HERO, hero: true, arms: 'wave', face: 'happy', look: 'left', shadowless: true, flip: true })}
  <path d="M${raftAt[0] - 150} ${raftAt[1] + 30} q40 -10 80 0 t80 0 t80 0 t80 0" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${monkey({ x: 170, y: 640, s: 0.85, fur: TROOP[0], arms: 'wave', face: 'happy', look: 'right', tailSide: -1 })}
  ${monkey({ x: 270, y: 690, s: 0.8, fur: TROOP[1], arms: 'cheer', face: 'happy', look: 'right', tailSide: -1 })}
  ${grassTufts([[40, 700], [330, 740]], '#a3a46a')}`);

export const pictures = [
  { name: 'p1', svg: s1 },
  { name: 'p2', svg: s2 },
  { name: 'p3', svg: s3 },
  { name: 'p4', svg: s4 },
  { name: 'p5', svg: s5 },
  { name: 'p6', svg: s6 },
];
