// Style studies for 西游记 illustrations: one scene (the stone monkey poles
// his raft west, leaving the Mountain of Flowers and Fruit) in three styles.
//
// Nothing floats. Every object is placed from what holds it:
//   - the raft sits in the water: the sea is drawn again over its lower half;
//   - the monkey's feet are on the deck surface, both hands on the pole;
//   - the pole is cut at the water line, with a ring where it goes in;
//   - the pine grows from a ledge, its root hidden behind the rock in front,
//     and each tuft of needles sits at the end of a branch drawn to it;
//   - mountains stand on a shore line, mist lies between the layers.

export const W = 1200, H = 800;
const FONT = `@font-face{font-family:WK;src:url('file:///home/user/Chinese/public/fonts/wenkai.woff2')}`;

// ----------------------------------------------------------------- geometry
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Points along a range of rounded karst peaks: summits [x, y, halfWidth].
 *  Each summit gets two lower shoulders, so a range reads as stacked rock,
 *  not as a row of triangles. */
function peaks(x0, x1, base, summits, rough, step, s) {
  seed = s;
  const all = [];
  for (const [sx, sy, sw] of summits) {
    const h = base - sy;
    all.push([sx, h, sw]);
    all.push([sx - sw * (0.45 + rnd() * 0.15), h * (0.5 + rnd() * 0.15), sw * 0.5]);
    all.push([sx + sw * (0.45 + rnd() * 0.15), h * (0.45 + rnd() * 0.15), sw * 0.5]);
  }
  const pts = [];
  for (let x = x0; x <= x1 + 0.1; x += step) {
    let y = base;
    for (const [sx, h, sw] of all) {
      const k = Math.abs(x - sx) / sw;
      // summits have steep karst sides; shoulders slope down to the water
            if (k < 1) y = Math.min(y, base - h * Math.pow(1 - Math.pow(k, 2.1), 0.6) * (1 - Math.pow(k, 6) * 0.35));
    }
    pts.push([x, y + (rnd() - 0.5) * rough * (y < base - 4 ? 1 : 0)]);
  }
  return pts;
}
/** Height of a point list at x, by straight lines between points. */
function yAt(pts, x) {
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const [a, b] = [pts[i - 1], pts[i]], t = (x - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * t;
  }
  return pts[pts.length - 1][1];
}
/** Smooth path through points (Catmull-Rom to cubic). */
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
const closed = (pts, base) => `${smooth(pts)} L${pts[pts.length - 1][0]} ${base} L${pts[0][0]} ${base} Z`;

/** A title written top to bottom, one character under the other. */
const column = (text, x, y, size, fill, gap = 1.12) => [...text].map((c, i) => `<text x="${x}" y="${y + i * size * gap}" font-family="WK" font-size="${size}" fill="${fill}" text-anchor="middle">${c}</text>`).join('');
const seal = (x, y, size, fill, ink) => `<g transform="translate(${x} ${y})"><rect x="${-size / 2}" width="${size}" height="${size * 1.9}" rx="${size * 0.1}" fill="${fill}"/>${column('西游', 0, size * 0.82, size * 0.72, ink, 1.18)}</g>`;

// -------------------------------------------------------------- the scene
// Shared placement, the same in every style.
const SEA = 512;                 // the far shore line
const RAFT = { x: 560, y: 600, L: 250 };   // deck surface front edge at y
const MONK = { x: 548, s: 1.32 };          // feet on the deck, 5 above its front edge
const CLIFF_PTS = peaks(880, 1230, 830, [[1040, 470, 150], [1170, 420, 140]], 3, 6, 41);
const CLIFF = [...CLIFF_PTS, [1230, 830], [880, 830]];
const LEDGE = [930, yAt(CLIFF_PTS, 930) + 4]; // the pine's root, on the cliff's edge
// ---------------------------------------------------------------- monkey
// Local units: feet on y = 0, facing left, ~140 tall. Both hands are on the
// pole, which runs from top-left behind the head down to the water in front.
const POLE = { a: [-58, -176], b: [40, 92] };
const onPole = (y) => [POLE.a[0] + (POLE.b[0] - POLE.a[0]) * (y - POLE.a[1]) / (POLE.b[1] - POLE.a[1]), y];
const HAND_HI = onPole(-112), HAND_LO = onPole(-80);
const M = {
  tail: 'M12 -58 C46 -56 56 -98 38 -114 C28 -122 18 -110 26 -103',
  legs: ['M-6 -58 Q-18 -34 -16 -4', 'M7 -58 Q18 -32 12 -4'],
  feet: [[-21, -3, 10, 4.5], [8, -3, 10, 4.5]],
  body: [-2, -80, 18, 27, -14],
  armHi: `M-8 -100 Q-26 -112 ${HAND_HI[0]} ${HAND_HI[1]}`,
  armLo: `M6 -98 Q10 -80 ${HAND_LO[0]} ${HAND_LO[1]}`,
  head: [-9, -126, 17], ear: [5, -128, 6],
  muzzle: [-21, -121, 10, 8.5], brow: [-15, -132, 9, 6],
  tuft: 'M-13 -141 C-15 -154 -5 -156 -7 -148 C-1 -156 5 -150 -1 -142 Z',
};
function monkey({ x, y, s, fur, line = null, lw = 0, face, detail, belly = null, wood, waterY, flat = false }) {
  const e = line ? lw * 2 : 0;
  const part = (k, col) => `
    <path d="${M.tail}" stroke="${col}" stroke-width="${5.5 + k}" fill="none" stroke-linecap="round"/>
    ${M.legs.map((d) => `<path d="${d}" stroke="${col}" stroke-width="${10 + k}" fill="none" stroke-linecap="round"/>`).join('')}
    ${M.feet.map(([fx, fy, rx, ry]) => `<ellipse cx="${fx}" cy="${fy}" rx="${rx + k / 2}" ry="${ry + k / 2}" fill="${col}"/>`).join('')}
    <path d="${M.armLo}" stroke="${col}" stroke-width="${8 + k}" fill="none" stroke-linecap="round"/>
    <ellipse cx="${M.body[0]}" cy="${M.body[1]}" rx="${M.body[2] + k / 2}" ry="${M.body[3] + k / 2}" transform="rotate(${M.body[4]} ${M.body[0]} ${M.body[1]})" fill="${col}"/>
    <circle cx="${M.ear[0]}" cy="${M.ear[1]}" r="${M.ear[2] + k / 2}" fill="${col}"/>
    <circle cx="${M.head[0]}" cy="${M.head[1]}" r="${M.head[2] + k / 2}" fill="${col}"/>
    <path d="${M.tuft}" fill="${col}" stroke="${col}" stroke-width="${k}" stroke-linejoin="round"/>`;
  const armHi = (k, col) => `<path d="${M.armHi}" stroke="${col}" stroke-width="${8 + k}" fill="none" stroke-linecap="round"/>`;
  const hand = ([hx, hy], k, col) => `<circle cx="${hx}" cy="${hy}" r="${5.5 + k / 2}" fill="${col}"/>`;
  const wl = (waterY - y) / s; // the water line in local units
  const pole = `<clipPath id="above${x}"><rect x="-200" y="-300" width="400" height="${300 + wl}"/></clipPath>
    <g clip-path="url(#above${x})">
      ${line ? `<path d="M${POLE.a[0]} ${POLE.a[1]} L${POLE.b[0]} ${POLE.b[1]}" stroke="${line}" stroke-width="${6 + e}" stroke-linecap="round"/>` : ''}
      <path d="M${POLE.a[0]} ${POLE.a[1]} L${POLE.b[0]} ${POLE.b[1]}" stroke="${wood}" stroke-width="6" stroke-linecap="round"/>
    </g>`;
  const faceParts = flat ? '' : `
    ${belly ? `<ellipse cx="-7" cy="-76" rx="9" ry="16" transform="rotate(-14 -7 -76)" fill="${belly}"/>` : ''}
    <ellipse cx="${M.muzzle[0]}" cy="${M.muzzle[1]}" rx="${M.muzzle[2]}" ry="${M.muzzle[3]}" fill="${face}"/>
    <ellipse cx="${M.brow[0]}" cy="${M.brow[1]}" rx="${M.brow[2]}" ry="${M.brow[3]}" fill="${face}"/>
    <circle cx="${M.ear[0]}" cy="${M.ear[1]}" r="${M.ear[2] - 2.6}" fill="${face}"/>
    <circle cx="-19" cy="-131" r="2.1" fill="${detail}"/>
    <path d="M-28 -122 q2 1 4 0" stroke="${detail}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M-27 -116 q4 3 9 1" stroke="${detail}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${line ? part(e, line) : ''}${part(0, fur)}
    ${faceParts}
    ${pole}
    ${line ? hand(HAND_LO, e, line) + armHi(e, line) + hand(HAND_HI, e, line) : ''}
    ${hand(HAND_LO, 0, fur)}${armHi(0, fur)}${hand(HAND_HI, 0, fur)}
  </g>`;
}
/** Where the pole meets the water, in the picture's coordinates. */
function poleEntry(x, y, s, waterY) {
  const ly = (waterY - y) / s;
  const [lx] = onPole(ly);
  return [x + lx * s, waterY];
}

// ------------------------------------------------------------------ raft
// The deck surface seen a little from above, and the near log along its
// front. Lashings wrap the near log and run over the deck.
function raft({ x, y, L, top, log, dark, rope, line = null, lw = 0 }) {
  const o = line ? `stroke="${line}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  const d = 14; // depth of the deck seen from above
  return `<g transform="translate(${x} ${y})">
    <path d="M${-L / 2 + 12} ${-d} L${L / 2 - 6} ${-d} L${L / 2} 0 L${-L / 2} 0 Z" fill="${top}" ${o}/>
    ${[-d * 0.66, -d * 0.33].map((ly) => `<path d="M${-L / 2 + 10 - ly * 0.6} ${ly} H${L / 2 - 4 + ly * 0.3}" stroke="${dark}" stroke-width="1.4" opacity=".7"/>`).join('')}
    <rect x="${-L / 2 - 6}" y="-2" width="${L + 12}" height="16" rx="8" fill="${log}" ${o}/>
    <path d="M${-L / 2} 4 H${L / 2}" stroke="${dark}" stroke-width="1.3" opacity=".6"/>
    ${[-L * 0.34, 0, L * 0.34].map((rx) => `<path d="M${rx - 3} ${-d} L${rx} 14 M${rx + 3} ${-d} L${rx + 6} 14" stroke="${rope}" stroke-width="2.6"/>`).join('')}
    <ellipse cx="${-L / 2 - 6}" cy="6" rx="4" ry="8" fill="${dark}"/>
  </g>`;
}

// ------------------------------------------------------------------- pine
// Root at LEDGE, trunk curving out over the water; branches drawn from points
// on the trunk to each tuft, so every tuft is held.
function pine({ trunk, bark, tuft, needles, line = null, lw = 0, inkStyle = false }) {
  const [rx, ry] = LEDGE;
  const T = [[rx + 6, ry + 46], [rx, ry], [rx - 4, ry - 60], [rx - 46, ry - 104], [rx - 120, ry - 128], [rx - 168, ry - 126]];
  const at = (i) => T[i + 1];
  const branches = [
    { from: at(2), to: [rx - 70, ry - 150], r: 34 },
    { from: at(3), to: [rx - 150, ry - 156], r: 40 },
    { from: at(4), to: [rx - 204, ry - 132], r: 30 },
    { from: at(1), to: [rx + 14, ry - 104], r: 28 },
    { from: at(3), to: [rx - 112, ry - 108], r: 24 },
  ];
  const trunkD = smooth(T);
  const o = line ? `<path d="${trunkD}" stroke="${line}" stroke-width="${16 + lw * 2}" fill="none" stroke-linecap="round"/>` : '';
  const br = branches.map((b) => {
    const d = `M${b.from[0]} ${b.from[1]} Q${(b.from[0] + b.to[0]) / 2} ${Math.min(b.from[1], b.to[1]) - 8} ${b.to[0]} ${b.to[1]}`;
    return (line ? `<path d="${d}" stroke="${line}" stroke-width="${6 + lw * 2}" fill="none" stroke-linecap="round"/>` : '') +
      `<path d="${d}" stroke="${trunk}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }).join('');
  const tufts = branches.map((b) => {
    const [cx, cy] = b.to, r = b.r;
    if (inkStyle) {
      seed = Math.round(cx * 7 + cy);
      return Array.from({ length: 26 }, () => {
        const a = Math.PI * (1.05 + rnd() * 0.9), l = r * (0.55 + rnd() * 0.5);
        return `<path d="M${cx} ${cy + 4} l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l * 0.55).toFixed(1)}" stroke="${tuft}" stroke-width="${1.6 + rnd() * 1.6}" stroke-linecap="round" opacity="${0.55 + rnd() * 0.4}"/>`;
      }).join('') + `<ellipse cx="${cx}" cy="${cy - 2}" rx="${r * 0.9}" ry="${r * 0.32}" fill="${tuft}" opacity=".25"/>`;
    }
    return `<path d="M${cx - r} ${cy + 6} C${cx - r} ${cy - r * 0.55} ${cx + r} ${cy - r * 0.55} ${cx + r} ${cy + 6} Q${cx} ${cy + 12} ${cx - r} ${cy + 6} Z" fill="${tuft}" ${line ? `stroke="${line}" stroke-width="${lw}"` : ''}/>
      ${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.12 + i * 0.095); return `<path d="M${cx} ${cy + 6} l${(Math.cos(a) * r * 0.86).toFixed(1)} ${(Math.sin(a) * r * 0.62).toFixed(1)}" stroke="${needles}" stroke-width="1.3" opacity=".9"/>`; }).join('')}`;
  }).join('');
  return `<g>${o}<path d="${trunkD}" stroke="${trunk}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="${smooth(T.map(([a, b]) => [a + 3, b - 2]))}" stroke="${bark}" stroke-width="3" fill="none" stroke-dasharray="6 9" stroke-linecap="round"/>
    ${br}${tufts}</g>`;
}
const poly = (pts) => `${smooth(pts.slice(0, -2))} L${pts[pts.length - 2].join(' ')} L${pts[pts.length - 1].join(' ')} Z`;

// =============================================================== A. 水墨
function ink() {
  const far = peaks(-30, 900, SEA + 8, [[110, 200, 150], [300, 150, 150], [470, 240, 140], [640, 300, 120]], 18, 14, 3);
  const mid = peaks(-30, 520, SEA + 22, [[50, 290, 110], [210, 236, 120], [380, 330, 110]], 26, 10, 11);
  const PAPER = '#efe7d6', INK = '#1f2321';
  const wl = RAFT.y + 9;
  const [px, py] = poleEntry(MONK.x, RAFT.y - 5, MONK.s, wl);
  const moss = (pts) => pts.filter((_, i) => i % 3 === 0 && pts[i][1] < SEA - 40).map(([x, y]) => `<circle cx="${x + 3}" cy="${y + 8}" r="${2 + (x % 3)}" fill="${INK}" opacity=".75"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><style>${FONT}</style>
    <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .4  0 0 0 0 .34  0 0 0 0 .25  0 0 0 .08 0"/></filter>
    <filter id="fibre" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.3" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .28  0 0 0 .06 0"/></filter>
    <filter id="wash" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16" result="d"/><feGaussianBlur in="d" stdDeviation="3"/></filter>
    <filter id="bleed" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d"/><feGaussianBlur in="d" stdDeviation=".6"/></filter>
    <filter id="pool" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="13" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -0.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    <filter id="blur6"><feGaussianBlur stdDeviation="5"/></filter>
    <linearGradient id="farG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f7b7c" stop-opacity=".5"/><stop offset=".6" stop-color="#9aa3a1" stop-opacity=".18"/><stop offset="1" stop-color="${PAPER}" stop-opacity="0"/></linearGradient>
    <linearGradient id="midG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a302e" stop-opacity=".8"/><stop offset=".55" stop-color="#5a6260" stop-opacity=".35"/><stop offset=".95" stop-color="${PAPER}" stop-opacity="0"/></linearGradient>
    <linearGradient id="cliffG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e2c" stop-opacity=".9"/><stop offset=".55" stop-color="#4a504d" stop-opacity=".55"/><stop offset="1" stop-color="#6c716d" stop-opacity=".35"/></linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAPER}" stop-opacity="0"/><stop offset=".55" stop-color="${PAPER}" stop-opacity=".96"/><stop offset="1" stop-color="${PAPER}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <circle cx="830" cy="190" r="44" fill="#c9482f" opacity=".82" filter="url(#bleed)"/>
  <path d="${closed(far, SEA + 20)}" fill="url(#farG)" filter="url(#wash)"/>
  <rect x="0" y="${SEA - 150}" width="${W}" height="190" fill="url(#mist)"/>
  <path d="${closed(mid, SEA + 30)}" fill="url(#midG)" filter="url(#wash)"/>
  <path d="${closed(mid, SEA + 30)}" fill="#2a302e" opacity=".5" filter="url(#pool)"/>
  <path d="${smooth(mid)}" stroke="${INK}" stroke-width="2.6" fill="none" opacity=".75" filter="url(#bleed)"/>
  <g filter="url(#bleed)">${moss(mid)}</g>
  <rect x="0" y="${SEA - 60}" width="700" height="100" fill="url(#mist)"/>
  ${[[150, 548, 120], [330, 640, 170], [760, 700, 150], [210, 728, 190], [640, 748, 120]].map(([x, y, w]) => `<path d="M${x} ${y} q${w / 4} -5 ${w / 2} 0 t${w / 2} 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".4" filter="url(#bleed)"/>`).join('')}
  <g opacity=".07" filter="url(#blur6)" transform="translate(0 ${2 * wl}) scale(1 -1)">
    ${raft({ ...RAFT, top: INK, log: INK, dark: INK, rope: INK })}
    ${monkey({ x: MONK.x, y: RAFT.y - 5, s: MONK.s, fur: INK, wood: INK, waterY: wl, flat: true })}
  </g>
  ${`<clipPath id="aw"><rect width="${W}" height="${wl}"/></clipPath>`}<g filter="url(#bleed)" clip-path="url(#aw)">
    ${raft({ ...RAFT, top: '#5b5e58', log: '#363935', dark: INK, rope: '#9a3a28' })}
    ${monkey({ x: MONK.x, y: RAFT.y - 5, s: MONK.s, fur: '#b08a5c', line: INK, lw: 1.3, face: '#eadcc0', detail: INK, belly: '#d2b48a', wood: '#3a3530', waterY: wl })}
  </g>
  <path d="M${RAFT.x - RAFT.L / 2 - 40} ${wl + 2} q30 -5 60 0 t60 0 t60 0 t60 0 t60 0" stroke="${INK}" stroke-width="1.8" fill="none" opacity=".55" filter="url(#bleed)"/>
  <ellipse cx="${px}" cy="${py + 3}" rx="16" ry="3.5" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".6"/>
  <g filter="url(#bleed)">${pine({ trunk: '#262a28', bark: '#4b4f4b', tuft: '#1f2a24', needles: '#1f2a24', inkStyle: true })}</g>
  <path d="${poly(CLIFF)}" fill="${PAPER}"/>
  <path d="${poly(CLIFF)}" fill="url(#cliffG)" filter="url(#wash)"/>
  <path d="${poly(CLIFF)}" fill="#202422" opacity=".25" filter="url(#pool)"/>
  ${CLIFF_PTS.filter((_, i) => i % 5 === 2).map(([x, y]) => `<path d="M${x - 4} ${y + 18} q12 40 0 90 M${x + 12} ${y + 40} q8 30 -2 60" stroke="${INK}" stroke-width="2" fill="none" opacity=".5" filter="url(#bleed)"/>`).join('')}
  <path d="${smooth(CLIFF_PTS)}" stroke="${INK}" stroke-width="3" fill="none" filter="url(#bleed)"/>
  <g filter="url(#bleed)">${moss(CLIFF_PTS.filter((_, i) => i % 2 === 0))}</g>
  ${column('乘筏西去', 1120, 120, 44, '#262624')}
  ${seal(1060, 92, 30, '#b3392a', PAPER)}
  <rect width="${W}" height="${H}" filter="url(#paper)"/><rect width="${W}" height="${H}" filter="url(#fibre)"/>
</svg>`;
}

// =========================================================== B. 青绿山水
function blueGreen() {
  const LINE = '#3a3227', SILK = '#ead9b6';
  const back = peaks(-30, 560, SEA + 20, [[40, 160, 140], [200, 110, 140], [360, 200, 140], [490, 290, 110]], 10, 12, 21);
  const front = peaks(120, 900, SEA + 26, [[290, 280, 150], [470, 226, 150], [650, 330, 130]], 10, 12, 22);
  const wl = RAFT.y + 9;
  const [px, py] = poleEntry(MONK.x, RAFT.y - 5, MONK.s, wl);
  const waves = (y0, y1) => {
    const out = [];
    for (let y = y0; y < y1; y += 15) {
      const amp = 2.5 + (y - SEA) / 70, len = 30 + (y - SEA) / 8;
      let d = '';
      for (let x = -40 + ((y / 15) % 2) * len / 2; x < W + 40; x += len) d += `M${x.toFixed(1)} ${y} q${len / 4} ${-amp} ${len / 2} 0 `;
      out.push(`<path d="${d}" stroke="#46777e" stroke-width="1.3" fill="none" opacity="${(0.3 + (y - SEA) / 800).toFixed(2)}" stroke-linecap="round"/>`);
    }
    return out.join('');
  };
  const cun = (pts) => pts.filter((_, i) => i % 4 === 2).map(([x, y]) => `<path d="M${x - 4} ${y + 16} q10 30 0 64 M${x + 10} ${y + 30} q6 20 -2 40" stroke="${LINE}" stroke-width="1.1" fill="none" opacity=".45"/>`).join('');
  const mist = (x, y, w) => `<path d="M${x} ${y} C${x + 20} ${y - 26} ${x + 60} ${y - 26} ${x + 70} ${y - 10} C${x + 86} ${y - 32} ${x + 130} ${y - 30} ${x + 138} ${y - 8} L${x + w - 40} ${y - 8} C${x + w - 30} ${y - 22} ${x + w} ${y - 20} ${x + w} ${y - 4} C${x + w} ${y + 4} ${x + w - 8} ${y + 8} ${x + w - 16} ${y + 8} L${x + 8} ${y + 8} C${x} ${y + 8} ${x - 4} ${y + 4} ${x} ${y} Z" fill="#f7efdf" stroke="${LINE}" stroke-width="1.4"/>
    <path d="M${x + 30} ${y - 6} q10 -12 22 -2 M${x + 92} ${y - 10} q10 -12 22 -2" stroke="${LINE}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><style>${FONT}</style>
    <filter id="silk" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.55 0.95" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .42  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .1 0"/></filter>
    <filter id="age" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .2  0 0 0 .12 0"/></filter>
    <filter id="fog" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="pig" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3cfa6"/><stop offset="1" stop-color="${SILK}"/></linearGradient>
    <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd6bf"/><stop offset="1" stop-color="#93b2a8"/></linearGradient>
    <linearGradient id="g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c5f84"/><stop offset=".4" stop-color="#3c8a76"/><stop offset=".85" stop-color="#b9a067"/><stop offset="1" stop-color="#c9a76a"/></linearGradient>
    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6f86"/><stop offset=".45" stop-color="#4f9a7e"/><stop offset=".9" stop-color="#ccad70"/></linearGradient>
    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28597a"/><stop offset=".35" stop-color="#3a8468"/><stop offset=".8" stop-color="#b48c50"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="860" cy="190" r="40" fill="#c13d2b"/>
  <rect y="${SEA + 14}" width="${W}" height="${H}" fill="url(#seaG)"/>
  ${waves(SEA + 26, H + 10)}
  <g filter="url(#pig)">
    <path d="${closed(back, SEA + 22)}" fill="url(#g0)" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>${cun(back)}
    <ellipse cx="160" cy="400" rx="300" ry="34" fill="#f7efdf" opacity=".6" filter="url(#fog)"/>
    <path d="${closed(front, SEA + 28)}" fill="url(#g1)" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>${cun(front)}
    <ellipse cx="300" cy="${SEA + 14}" rx="460" ry="26" fill="#f7efdf" opacity=".8" filter="url(#fog)"/>
  </g>
  <g transform="translate(0 ${2 * wl}) scale(1 -1)" opacity=".2">${raft({ ...RAFT, top: '#5f4a32', log: '#5f4a32', dark: '#5f4a32', rope: '#5f4a32' })}</g>
  <clipPath id="aw"><rect width="${W}" height="${wl}"/></clipPath><g clip-path="url(#aw)">
  ${raft({ ...RAFT, top: '#c49a62', log: '#a5754a', dark: '#6b4a2c', rope: '#b23a28', line: LINE, lw: 1.6 })}
  ${monkey({ x: MONK.x, y: RAFT.y - 5, s: MONK.s, fur: '#b67b3a', line: LINE, lw: 1.5, face: '#f0d5ab', detail: LINE, belly: '#ddb075', wood: '#7a5634', waterY: wl })}</g>
  <path d="M${RAFT.x - RAFT.L / 2 - 40} ${wl} q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="#f6eedd" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M${RAFT.x - RAFT.L / 2 - 36} ${wl + 14} q15 -4 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="#46777e" stroke-width="1.3" fill="none" opacity=".5"/>
  <ellipse cx="${px}" cy="${py + 2}" rx="14" ry="3.2" fill="none" stroke="#f6eedd" stroke-width="2"/>
  <g filter="url(#pig)">
    ${pine({ trunk: '#7d5636', bark: '#4c3320', tuft: '#2d6a54', needles: '#a6d2b6', line: LINE, lw: 1.5 })}
    <path d="${poly(CLIFF)}" fill="url(#gc)" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>
    ${cun(CLIFF_PTS.filter((_, i) => i % 2 === 0))}
  </g>
  ${column('乘筏西去', 1120, 116, 40, LINE)}
  ${seal(1064, 90, 28, '#b3392a', SILK)}
  <rect width="${W}" height="${H}" filter="url(#silk)"/><rect width="${W}" height="${H}" filter="url(#age)"/>
</svg>`;
}

// ============================================================= C. 木版年画
function woodblock() {
  const INK = '#2a2420', CREAM = '#f3e4c4';
  const back = peaks(-30, 900, SEA + 10, [[90, 200, 150], [270, 150, 150], [440, 230, 140], [610, 300, 130]], 0, 30, 31);
  const front = peaks(-30, 560, SEA + 30, [[40, 300, 120], [220, 262, 130], [420, 350, 110]], 0, 30, 32);
  const wl = RAFT.y + 9;
  const [px, py] = poleEntry(MONK.x, RAFT.y - 5, MONK.s, wl);
  const crest = (y, phase, col) => {
    let d = '';
    for (let x = -80 + phase; x < W + 80; x += 80) d += `M${x} ${y} q20 -18 40 -6 q-12 -2 -14 6 `;
    return `<path d="${d}" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><style>${FONT}</style>
    <filter id="press" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.2" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .08 0"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <circle cx="830" cy="186" r="60" fill="#e5a73a"/><circle cx="830" cy="186" r="44" fill="#d1482c"/>
  <g filter="url(#press)">
    <path d="${closed(back, SEA + 20)}" fill="#8fb3a6"/>
    <path d="${closed(front, SEA + 40)}" fill="#2e6c70"/>
    ${front.filter((_, k) => k % 3 === 1 && front[k][1] < SEA - 30).map(([x, y]) => `<path d="M${x - 12} ${y + 34} l12 -12 l12 12" stroke="${CREAM}" stroke-width="3" fill="none" stroke-linejoin="round"/>`).join('')}
    <rect y="${SEA + 26}" width="${W}" height="${H}" fill="#2d4f7a"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => crest(SEA + 64 + i * 38, (i % 2) * 40, CREAM)).join('')}
  </g>
  <clipPath id="aw"><rect width="${W}" height="${wl}"/></clipPath><g clip-path="url(#aw)">
  ${raft({ ...RAFT, top: '#d79a55', log: '#b8682f', dark: '#6e3a18', rope: '#d1482c', line: INK, lw: 3 })}
  ${monkey({ x: MONK.x, y: RAFT.y - 5, s: MONK.s, fur: '#d9873a', line: INK, lw: 2.6, face: '#f7ddb2', detail: INK, belly: '#f0bd74', wood: '#8a4f24', waterY: wl })}</g>
  ${[0].map(() => crest(wl + 6, 10, CREAM)).join('')}
  <ellipse cx="${px}" cy="${py + 3}" rx="15" ry="4" fill="none" stroke="${CREAM}" stroke-width="3"/>
  ${pine({ trunk: '#8a4f24', bark: '#5a3014', tuft: '#1f4a32', needles: '#7fbf8c', line: INK, lw: 2.6 })}
  <path d="${poly(CLIFF)}" fill="#3c7c50" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  ${CLIFF_PTS.filter((_, i) => i % 9 === 4).map(([x, y]) => `<path d="M${x - 14} ${y + 40} l14 -14 l14 14" stroke="#f3e4c4" stroke-width="3" fill="none" stroke-linejoin="round" opacity=".8"/>`).join('')}
  ${column('乘筏西去', 1120, 120, 44, INK)}
  ${seal(1060, 92, 30, '#d1482c', CREAM)}
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

export const studies = [
  { name: 'ink', svg: ink() },
  { name: 'bluegreen', svg: blueGreen() },
  { name: 'woodblock', svg: woodblock() },
];
