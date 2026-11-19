// Style studies for 西游记 illustrations: four scenes, each drawn in three
// styles (ink wash, blue-green landscape, woodblock print).
//
//   node docs/immersive-reading/style/render.mjs <out dir>
//
// A scene is written once, out of primitives (a range of peaks, rock, water,
// a waterfall, a figure); a style says how each primitive is painted.
//
// Nothing floats. Every object is placed from what holds it:
//   - figures stand with their feet on a surface whose y the scene knows, or
//     sit with the base of their lap on it;
//   - the raft is cut at the water line; the pole is cut there too;
//   - a tree's root goes behind the rock it grows from; every tuft of needles
//     is at the end of a branch, every branch starts on the trunk;
//   - the waterfall starts behind the lip of the cliff and ends in foam in
//     the pool; the cloud he rides covers his feet;
//   - mountains stand in mist or water; clouds are in the sky.

export const W = 1200, H = 800;
const FONT = `@font-face{font-family:WK;src:url('file:///home/user/Chinese/public/fonts/wenkai.woff2')}`;

// ================================================================ geometry
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** A range of rounded karst peaks: summits [x, y, halfWidth], each with two lower shoulders. */
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
      if (k < 1) y = Math.min(y, base - h * Math.pow(1 - Math.pow(k, 2.1), 0.6) * (1 - Math.pow(k, 6) * 0.35));
    }
    pts.push([x, y + (rnd() - 0.5) * rough * (y < base - 4 ? 1 : 0)]);
  }
  return pts;
}
function yAt(pts, x) {
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const a = pts[i - 1], b = pts[i], t = (x - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * t;
  }
  return pts[pts.length - 1][1];
}
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
/** A shape whose top edge is `pts`, closed straight down to `base`. */
const closed = (pts, base) => `${smooth(pts)} L${pts[pts.length - 1][0]} ${base} L${pts[0][0]} ${base} Z`;
const column = (text, x, y, size, fill, gap = 1.12) => [...text].map((c, i) => `<text x="${x}" y="${y + i * size * gap}" font-family="WK" font-size="${size}" fill="${fill}" text-anchor="middle">${c}</text>`).join('');
const seal = (x, y, size, fill, ink) => `<g transform="translate(${x} ${y})"><rect x="${-size / 2}" width="${size}" height="${size * 1.9}" rx="${size * 0.1}" fill="${fill}"/>${column('西游', 0, size * 0.82, size * 0.72, ink, 1.18)}</g>`;
const wave = (x0, x1, y, len, amp) => { let d = ''; for (let x = x0; x < x1; x += len) d += `M${x.toFixed(1)} ${y} q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0 `; return d; };

// ================================================================= figures
// A figure is drawn in layers; each layer is drawn twice, its outline first
// (wider, in the line colour) and its colour on top, so the parts of a layer
// share one outer contour and join without seams.
function layer(shapes, line, lw) {
  const one = (sh, k, col) => {
    if (sh.s) return `<path d="${sh.s}" stroke="${col}" stroke-width="${sh.w + k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (sh.e) { const [cx, cy, rx, ry, rot = 0] = sh.e; return `<ellipse cx="${cx}" cy="${cy}" rx="${rx + k / 2}" ry="${ry + k / 2}" transform="rotate(${rot} ${cx} ${cy})" fill="${col}"/>`; }
    if (sh.c) { const [cx, cy, r] = sh.c; return `<circle cx="${cx}" cy="${cy}" r="${r + k / 2}" fill="${col}"/>`; }
    if (sh.f) return `<path d="${sh.f}" fill="${col}" stroke="${col}" stroke-width="${k}" stroke-linejoin="round"/>`;
    return '';
  };
  const k = line ? lw * 2 : 0;
  return (line ? shapes.map((sh) => one(sh, k, line)).join('') : '') + shapes.map((sh) => one(sh, 0, sh.col)).join('');
}

// The monkey, in local units: standing, feet on y = 0, facing left, ~145
// tall; sitting cross-legged, the lap on y = 0. Hand positions per pose are
// fixed, so the scene can put a pole exactly through them.
const SH_F = [-8, -100], SH_B = [6, -98];
const ARMS = {
  pole: { f: [[-30, -112], [-37.1, -120.6]], b: [[10, -80], [-25.6, -88.7]] },
  point: { f: [[-30, -104], [-52, -106]], b: [[12, -80], [10, -62]] },
  shade: { f: [[-38, -112], [-30, -137]], b: [[24, -86], [12, -70]] },
  rest: { f: [[-14, -80], [-12, -62]], b: [[12, -80], [10, -62]] },
  cheer: { f: [[-26, -122], [-24, -150]], b: [[18, -122], [16, -150]] },
  lap: { f: [[-18, -78], [-6, -66]], b: [[14, -78], [4, -66]] },
};
export const POLE = { a: [-58, -176], b: [40, 92] };
function monkey({ x, y, s = 1, flip = false, pose = 'rest', sit = false, robe = null, c }) {
  const dy = sit ? 48 : 0; // the upper body sits lower when the legs fold
  const U = (px, py) => `${px} ${py + dy}`;
  const arm = (sh, [[qx, qy], [hx, hy]]) => ({ s: `M${U(...sh)} Q${U(qx, qy)} ${U(hx, hy)}`, w: 8, col: c.fur });
  const A = ARMS[sit && pose === 'rest' ? 'lap' : pose];
  const handF = { c: [A.f[1][0], A.f[1][1] + dy, 5.5], col: c.fur };
  const handB = { c: [A.b[1][0], A.b[1][1] + dy, 5.5], col: c.fur };
  const legs = sit
    ? [{ s: 'M14 -30 C40 -26 48 -8 30 -2 C20 2 14 -4 20 -8', w: 5.5, col: c.fur },
       { e: [0, -9, 30, 10], col: robe || c.fur }, { e: [-28, -6, 9, 5], col: c.fur }, { e: [27, -6, 9, 5], col: c.fur }]
    : [{ s: 'M12 -58 C46 -56 56 -98 38 -114 C28 -122 18 -110 26 -103', w: 5.5, col: c.fur },
       { s: 'M-6 -58 Q-18 -34 -16 -4', w: 10, col: c.fur }, { s: 'M7 -58 Q18 -32 12 -4', w: 10, col: c.fur },
       { e: [-21, -3, 10, 4.5], col: c.fur }, { e: [8, -3, 10, 4.5], col: c.fur }];
  const back = [...legs, arm(SH_B, A.b), handB];
  const body = [
    { e: [-2, -80 + dy, 18, 27, sit ? -4 : -14], col: robe || c.fur },
    { c: [5, -128 + dy, 6], col: c.fur }, { c: [-9, -126 + dy, 17], col: c.fur },
    { f: `M-13 ${-141 + dy} C-15 ${-154 + dy} -5 ${-156 + dy} -7 ${-148 + dy} C-1 ${-156 + dy} 5 ${-150 + dy} -1 ${-142 + dy} Z`, col: c.fur },
  ];
  const front = [arm(SH_F, A.f), handF];
  const D = c.detail;
  const face = `
    ${robe ? `<path d="M-14 ${-104 + dy} L-2 ${-84 + dy} L10 ${-104 + dy}" stroke="${c.trim || D}" stroke-width="2.4" fill="none"/><path d="M-19 ${-70 + dy} Q-2 ${-62 + dy} 15 ${-72 + dy}" stroke="${c.trim || D}" stroke-width="4" fill="none"/>` : `<ellipse cx="-7" cy="${-76 + dy}" rx="9" ry="16" transform="rotate(-14 -7 ${-76 + dy})" fill="${c.belly}"/>`}
    <ellipse cx="-21" cy="${-121 + dy}" rx="10" ry="8.5" fill="${c.face}"/>
    <ellipse cx="-15" cy="${-132 + dy}" rx="9" ry="6" fill="${c.face}"/>
    <circle cx="5" cy="${-128 + dy}" r="3.4" fill="${c.face}"/>
    <circle cx="-19" cy="${-131 + dy}" r="2.1" fill="${D}"/>
    <path d="M-28 ${-122 + dy} q2 1 4 0" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M-27 ${-116 + dy} q4 3 9 1" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    ${layer(back, c.line, c.lw)}${layer(body, c.line, c.lw)}${face}${layer(front, c.line, c.lw)}</g>`;
}
/** Where a pose's hands are, in the picture, for a pole or a held thing. */
const handAt = (x, y, s, pose, which) => { const h = ARMS[pose][which][1]; return [x + h[0] * s, y + h[1] * s]; };

/** Master Bodhi, sitting cross-legged facing us, the base of his robe on y = 0. */
function bodhi({ x, y, s = 1, c }) {
  const robe = [
    { f: 'M-66 0 C-66 -30 -44 -70 -24 -90 L24 -90 C44 -70 66 -30 66 0 Z', col: c.robe },
    { c: [0, -110, 21], col: c.skin },
  ];
  const D = c.detail;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${layer(robe, c.line, c.lw)}
    <path d="M-20 -90 L0 -56 L20 -90" stroke="${c.trim}" stroke-width="5" fill="none" stroke-linejoin="round"/>
    <path d="M-60 -8 C-30 -2 30 -2 60 -8" stroke="${c.trim}" stroke-width="5" fill="none"/>
    ${layer([{ e: [-14, -38, 18, 11, 12], col: c.robe2 }, { e: [14, -38, 18, 11, -12], col: c.robe2 }], c.line, c.lw * 0.8)}
    ${layer([{ c: [0, -40, 7], col: c.skin }], c.line, c.lw * 0.7)}
    <path d="M-20 -116 q-6 -12 2 -20 M20 -116 q6 -12 -2 -20" stroke="${c.white}" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${layer([{ c: [0, -136, 6], col: c.white }], c.line, c.lw * 0.7)}
    <path d="M-12 -116 h7 M5 -116 h7" stroke="${c.white}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-11 -110 q3 2 6 0 M5 -110 q3 2 6 0" stroke="${D}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${layer([{ f: 'M-13 -102 C-12 -72 -4 -58 0 -54 C4 -58 12 -72 13 -102 C6 -96 -6 -96 -13 -102 Z', col: c.white }], c.line, c.lw * 0.7)}
  </g>`;
}

/** A raft: deck surface seen a little from above, the near log along its front; front edge at y. */
function raft({ x, y, L, c }) {
  const o = c.line ? `stroke="${c.line}" stroke-width="${c.lw}" stroke-linejoin="round"` : '';
  const d = 14;
  return `<g transform="translate(${x} ${y})">
    <path d="M${-L / 2 + 12} ${-d} L${L / 2 - 6} ${-d} L${L / 2} 0 L${-L / 2} 0 Z" fill="${c.deck}" ${o}/>
    ${[-d * 0.66, -d * 0.33].map((ly) => `<path d="M${-L / 2 + 10 - ly * 0.6} ${ly} H${L / 2 - 4 + ly * 0.3}" stroke="${c.grain}" stroke-width="1.4" opacity=".7"/>`).join('')}
    <rect x="${-L / 2 - 6}" y="-2" width="${L + 12}" height="16" rx="8" fill="${c.log}" ${o}/>
    ${[-L * 0.34, 0, L * 0.34].map((rx) => `<path d="M${rx - 3} ${-d} L${rx} 14 M${rx + 3} ${-d} L${rx + 6} 14" stroke="${c.rope}" stroke-width="2.6"/>`).join('')}
  </g>`;
}

/** A pine rooted at (rx, ry), leaning to `dir` (-1 left); returns the tree. Draw the rock it grows from after it. */
function pine({ rx, ry, dir = -1, k = 1, c }) {
  const P = (dx, dy) => [rx + dx * dir * -1 * k, ry + dy * k];
  const T = [P(6, 46), P(0, 0), P(-4, -60), P(-46, -104), P(-120, -128), P(-168, -126)];
  const B = [[T[3], P(-70, -150), 34], [T[4], P(-150, -156), 40], [T[5], P(-204, -132), 30], [T[2], P(14, -104), 28], [T[4], P(-112, -108), 24]];
  const br = B.map(([f, t]) => `M${f[0]} ${f[1]} Q${(f[0] + t[0]) / 2} ${Math.min(f[1], t[1]) - 8 * k} ${t[0]} ${t[1]}`);
  const lines = (w, col) => `<path d="${smooth(T)}" stroke="${col}" stroke-width="${16 * k + w}" fill="none" stroke-linecap="round"/>` + br.map((d) => `<path d="${d}" stroke="${col}" stroke-width="${6 * k + w}" fill="none" stroke-linecap="round"/>`).join('');
  const tufts = B.map(([, [cx, cy], r0]) => {
    const r = r0 * k;
    if (c.inkTufts) {
      seed = Math.round(cx * 7 + cy);
      return Array.from({ length: 30 }, () => { const a = Math.PI * (1.02 + rnd() * 0.96), l = r * (0.5 + rnd() * 0.55); return `<path d="M${cx} ${cy + 3} l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l * 0.5).toFixed(1)}" stroke="${c.tuft}" stroke-width="${1.5 + rnd() * 1.6}" stroke-linecap="round" opacity="${0.5 + rnd() * 0.45}"/>`; }).join('') + `<ellipse cx="${cx}" cy="${cy - 2}" rx="${r}" ry="${r * 0.3}" fill="${c.tuft}" opacity=".22"/>`;
    }
    // a flat fan of needles in two tiers, lying along the branch
    const fan = (yy, rr, col) => `<path d="M${cx - rr} ${yy} C${cx - rr * 0.7} ${yy - rr * 0.42} ${cx + rr * 0.7} ${yy - rr * 0.42} ${cx + rr} ${yy} C${cx + rr * 0.5} ${yy + rr * 0.16} ${cx - rr * 0.5} ${yy + rr * 0.16} ${cx - rr} ${yy} Z" fill="${col}" ${c.line ? `stroke="${c.line}" stroke-width="${c.lw}"` : ''}/>`;
    return fan(cy + 4, r, c.tuft) + fan(cy - r * 0.12, r * 0.7, c.tuft2) +
      Array.from({ length: 11 }, (_, i) => { const t = -0.8 + i * 0.16; return `<path d="M${cx + t * r * 0.2} ${cy + 2} L${cx + t * r * 0.95} ${cy - Math.cos(t) * r * 0.26 + 2}" stroke="${c.needle}" stroke-width="1.1" opacity=".85"/>`; }).join('');
  }).join('');
  return `<g>${c.line ? lines(c.lw * 2, c.line) : ''}${lines(0, c.trunk)}
    <path d="${smooth(T.slice(1).map(([a, b]) => [a + 3, b - 2]))}" stroke="${c.bark}" stroke-width="2.5" fill="none" stroke-dasharray="6 9" stroke-linecap="round"/>${tufts}</g>`;
}

/** A peach tree rooted at (x, y): trunk, two limbs, a round crown that the limbs reach, peaches on it. */
function peachTree({ x, y, h, c }) {
  const crown = [x, y - h * 0.72], r = h * 0.34;
  const trunk = `M${x} ${y + 6} C${x - 4} ${y - h * 0.3} ${x + 6} ${y - h * 0.45} ${crown[0]} ${crown[1]}`;
  const limbs = [`M${x + 2} ${y - h * 0.4} Q${x - r * 0.6} ${y - h * 0.55} ${crown[0] - r * 0.6} ${crown[1] - r * 0.1}`, `M${x + 2} ${y - h * 0.45} Q${x + r * 0.6} ${y - h * 0.58} ${crown[0] + r * 0.55} ${crown[1] - r * 0.2}`];
  seed = Math.round(x + h);
  const peachesAt = Array.from({ length: 5 }, () => [crown[0] + (rnd() - 0.5) * r * 1.3, crown[1] + (rnd() - 0.3) * r * 0.9]);
  const lineW = (w) => c.line ? `<path d="${trunk}" stroke="${c.line}" stroke-width="${10 + w}" fill="none" stroke-linecap="round"/>${limbs.map((d) => `<path d="${d}" stroke="${c.line}" stroke-width="${5 + w}" fill="none" stroke-linecap="round"/>`).join('')}` : '';
  const blob = (k) => `M${crown[0] - r} ${crown[1] + r * 0.2} C${crown[0] - r * 1.1} ${crown[1] - r * 0.7} ${crown[0] - r * 0.2} ${crown[1] - r * 1.1} ${crown[0] + r * 0.2} ${crown[1] - r * 0.9} C${crown[0] + r * 1.1} ${crown[1] - r * 0.9} ${crown[0] + r * 1.2} ${crown[1] + r * 0.1} ${crown[0] + r * 0.8} ${crown[1] + r * 0.5} C${crown[0] + r * 0.3} ${crown[1] + r * 0.8} ${crown[0] - r * 0.6} ${crown[1] + r * 0.7} ${crown[0] - r} ${crown[1] + r * 0.2} Z`;
  return `<g>${lineW(c.lw * 2)}<path d="${trunk}" stroke="${c.trunk}" stroke-width="10" fill="none" stroke-linecap="round"/>${limbs.map((d) => `<path d="${d}" stroke="${c.trunk}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
    <path d="${blob()}" fill="${c.leaf}" ${c.line ? `stroke="${c.line}" stroke-width="${c.lw}"` : ''} ${c.leafFilter || ''}/>
    ${peachesAt.map(([px, py]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(h * 0.035).toFixed(1)}" fill="${c.peach}" ${c.line ? `stroke="${c.line}" stroke-width="${c.lw * 0.8}"` : ''}/>`).join('')}</g>`;
}

/** An incense burner on three legs standing on the floor at (x, y), smoke rising from its mouth. */
function burner({ x, y, c }) {
  const o = c.line ? `stroke="${c.line}" stroke-width="${c.lw}" stroke-linejoin="round"` : '';
  return `<g>
    <path d="M${x - 16} ${y - 18} L${x - 20} ${y} M${x + 16} ${y - 18} L${x + 20} ${y} M${x} ${y - 16} L${x} ${y - 2}" stroke="${c.line || c.metal}" stroke-width="${5 + (c.line ? c.lw : 0)}" stroke-linecap="round"/>
    <path d="M${x - 16} ${y - 18} L${x - 20} ${y} M${x + 16} ${y - 18} L${x + 20} ${y}" stroke="${c.metal}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${x - 30} ${y - 44} H${x + 30} C${x + 30} ${y - 20} ${x + 16} ${y - 14} ${x} ${y - 14} C${x - 16} ${y - 14} ${x - 30} ${y - 20} ${x - 30} ${y - 44} Z" fill="${c.metal}" ${o}/>
    <path d="M${x - 34} ${y - 50} H${x + 34} V${y - 42} H${x - 34} Z" fill="${c.metal}" ${o}/>
    <path d="M${x - 4} ${y - 52} c-14 -20 14 -30 0 -52 c-12 -18 10 -26 2 -46 M${x + 8} ${y - 52} c10 -16 -8 -26 4 -42" stroke="${c.smoke}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".8"/>
  </g>`;
}

/** The somersault cloud; its top surface (where feet go) runs along y at x. Returns [back, front] so the rider goes between. */
function nimbus({ x, y, c }) {
  const o = c.line ? `stroke="${c.line}" stroke-width="${c.lw}" stroke-linejoin="round"` : '';
  const back = `<path d="M${x + 60} ${y + 4} C${x + 130} ${y - 4} ${x + 170} ${y + 30} ${x + 250} ${y + 6} C${x + 280} ${y - 4} ${x + 300} ${y + 14} ${x + 320} ${y + 12} C${x + 300} ${y + 40} ${x + 270} ${y + 44} ${x + 210} ${y + 40} C${x + 160} ${y + 38} ${x + 110} ${y + 40} ${x + 60} ${y + 34} Z" fill="${c.cloud2}" ${o}/>
    <path d="M${x - 90} ${y + 6} C${x - 96} ${y - 22} ${x - 60} ${y - 30} ${x - 40} ${y - 14} C${x - 30} ${y - 34} ${x + 10} ${y - 36} ${x + 24} ${y - 14} C${x + 40} ${y - 30} ${x + 80} ${y - 24} ${x + 84} ${y} C${x + 110} ${y + 2} ${x + 112} ${y + 30} ${x + 84} ${y + 36} H${x - 80} C${x - 108} ${y + 34} ${x - 108} ${y + 10} ${x - 90} ${y + 6} Z" fill="${c.cloud}" ${o}/>`;
  const front = `<path d="M${x - 70} ${y + 36} C${x - 80} ${y + 10} ${x - 40} ${y - 4} ${x - 20} ${y + 8} C${x - 6} ${y - 6} ${x + 30} ${y - 6} ${x + 40} ${y + 10} C${x + 60} ${y + 2} ${x + 80} ${y + 20} ${x + 70} ${y + 36} Z" fill="${c.cloud}" ${o}/>
    <path d="M${x - 50} ${y + 22} q12 -12 26 -2 M${x + 6} ${y + 16} q14 -12 28 0" stroke="${c.curl}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return [back, front];
}

// ================================================================== styles
// Each style paints the primitives. Depth runs 0 (far) to 3 (near).
const STYLES = {};

STYLES.ink = (() => {
  const PAPER = '#efe7d6', INK = '#1f2321';
  const range = [['#7d8888', .42], ['#566060', .55], ['#3a4241', .72], ['#262b29', .86]];
  return {
    name: 'ink', PAPER, INK,
    defs: (scene) => `
      <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .4  0 0 0 0 .34  0 0 0 0 .25  0 0 0 .08 0"/></filter>
      <filter id="fibre" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.3" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .28  0 0 0 .06 0"/></filter>
      <filter id="wash" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16" result="d"/><feGaussianBlur in="d" stdDeviation="3"/></filter>
      <filter id="bleed" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" result="d"/><feGaussianBlur in="d" stdDeviation=".5"/></filter>
      <filter id="pool" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="13" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -0.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="fog" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>
      <filter id="blur6"><feGaussianBlur stdDeviation="5"/></filter>
      ${range.map(([col, a], i) => `<linearGradient id="r${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${a}"/><stop offset=".6" stop-color="${col}" stop-opacity="${a * 0.4}"/><stop offset="1" stop-color="${PAPER}" stop-opacity="0"/></linearGradient>`).join('')}
      <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e2c" stop-opacity=".88"/><stop offset=".6" stop-color="#4a504d" stop-opacity=".5"/><stop offset="1" stop-color="#6c716d" stop-opacity=".3"/></linearGradient>
      <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAPER}"/><stop offset=".55" stop-color="#ecd3b8"/><stop offset="1" stop-color="#e7c2a2"/></linearGradient>`,
    ground: (kind) => kind === 'dusk' ? `<rect width="${W}" height="${H}" fill="url(#dusk)"/>` : `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,
    sun: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c9482f" opacity=".8" filter="url(#bleed)"/>`,
    range: (pts, base, depth) => `<path d="${closed(pts, base)}" fill="url(#r${depth})" filter="url(#wash)"/>` + (depth >= 1 ? `<path d="${closed(pts, base)}" fill="#2a302e" opacity="${0.12 * depth}" filter="url(#pool)"/><path d="${smooth(pts)}" stroke="${INK}" stroke-width="${1.2 + depth * 0.6}" fill="none" opacity="${0.3 + depth * 0.15}" filter="url(#bleed)"/>` : ''),
    mist: (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${PAPER}" opacity=".95" filter="url(#fog)"/>`,
    sea: (y) => [[150, y + 40, 120], [330, y + 130, 170], [760, y + 190, 150], [210, y + 220, 190], [940, y + 90, 120]].map(([x, yy, w]) => `<path d="M${x} ${yy} q${w / 4} -5 ${w / 2} 0 t${w / 2} 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".38" filter="url(#bleed)"/>`).join(''),
    waterline: (x0, x1, y) => `<path d="${wave(x0, x1, y, 60, 5)}" stroke="${INK}" stroke-width="1.8" fill="none" opacity=".55" filter="url(#bleed)"/>`,
    ring: (x, y) => `<ellipse cx="${x}" cy="${y + 3}" rx="16" ry="3.5" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".6"/>`,
    reflect: true,
    rock: (d, edge) => `<path d="${d}" fill="${PAPER}"/><path d="${d}" fill="url(#rock)" filter="url(#wash)"/><path d="${d}" fill="#202422" opacity=".25" filter="url(#pool)"/>${edge ? `<path d="${edge}" stroke="${INK}" stroke-width="3" fill="none" filter="url(#bleed)"/>` : ''}`,
    cun: (pts) => pts.map(([x, y]) => `<path d="M${x - 4} ${y + 18} q12 40 0 90 M${x + 12} ${y + 40} q8 30 -2 60" stroke="${INK}" stroke-width="2" fill="none" opacity=".45" filter="url(#bleed)"/>`).join(''),
    moss: (pts) => `<g filter="url(#bleed)">${pts.map(([x, y], i) => `<circle cx="${x + 3}" cy="${y + 7}" r="${2 + (i % 3)}" fill="${INK}" opacity=".75"/>`).join('')}</g>`,
    grass: (d, edge) => `<path d="${d}" fill="#d9d2bf" filter="url(#wash)"/><path d="${d}" fill="#7c8a6e" opacity=".25" filter="url(#pool)"/>${edge ? `<path d="${edge}" stroke="${INK}" stroke-width="2.2" fill="none" opacity=".7" filter="url(#bleed)"/>` : ''}`,
    tufts: (pts) => `<g filter="url(#bleed)">${pts.map(([x, y]) => `<path d="M${x - 8} ${y} q2 -14 6 -18 M${x} ${y} q0 -16 2 -22 M${x + 8} ${y} q-1 -12 4 -16" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`).join('')}</g>`,
    fall: (x0, x1, top, bottom) => `<path d="M${x0} ${top} L${x1} ${top} L${x1 + 10} ${bottom} L${x0 - 10} ${bottom} Z" fill="${PAPER}"/>${Array.from({ length: 6 }, (_, i) => { const x = x0 + 8 + i * (x1 - x0 - 16) / 5; return `<path d="M${x} ${top + 6} q-3 ${(bottom - top) / 2} ${-4 + i * 1.6} ${bottom - top - 14}" stroke="${INK}" stroke-width="1.4" fill="none" opacity=".35" filter="url(#bleed)"/>`; }).join('')}`,
    pool: (d) => `<path d="${d}" fill="${PAPER}"/>`,
    foam: (x0, x1, y) => `<path d="M${x0 - 30} ${y} q18 -22 40 -8 q16 -20 38 -4 q18 -18 40 0 q18 -16 40 2 q16 -12 30 10 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.6" opacity=".9" filter="url(#bleed)"/>`,
    cave: (arch) => `<rect width="${W}" height="${H}" fill="url(#rock)" filter="url(#wash)"/><rect width="${W}" height="${H}" fill="#202422" opacity=".3" filter="url(#pool)"/><path d="${arch}" fill="${PAPER}"/><path d="${arch}" fill="#a39a88" opacity=".22" filter="url(#wash)"/><path d="${arch}" stroke="${INK}" stroke-width="3" fill="none" filter="url(#bleed)"/>`,
    floor: (y) => `<path d="M0 ${y} H${W} V${H} H0 Z" fill="#cfc6b2" opacity=".55" filter="url(#wash)"/><path d="M0 ${y} C300 ${y - 6} 900 ${y + 6} ${W} ${y - 2}" stroke="${INK}" stroke-width="2" fill="none" opacity=".6" filter="url(#bleed)"/>`,
    stone: (d) => `<path d="${d}" fill="#8c877c" stroke="${INK}" stroke-width="2.4" filter="url(#bleed)"/>`,
    shadow: (x, y, rx) => `<ellipse cx="${x}" cy="${y + 2}" rx="${rx}" ry="${rx / 6}" fill="${INK}" opacity=".18" filter="url(#bleed)"/>`,
    fx: (inner) => `<g filter="url(#bleed)">${inner}</g>`,
    monkeyC: { fur: '#b08a5c', line: INK, lw: 1.3, face: '#eadcc0', detail: INK, belly: '#d2b48a', trim: '#5a5f5c' },
    robeC: '#a7aca8',
    bodhiC: { robe: '#ede5d2', robe2: '#e2d8c2', skin: '#e6cfb0', white: '#fbf7ee', trim: '#9a3a28', line: INK, lw: 1.3, detail: INK },
    raftC: { deck: '#6b6d66', log: '#3f423e', grain: INK, rope: '#9a3a28' },
    pineC: { trunk: '#262a28', bark: '#4b4f4b', tuft: '#1f2a24', inkTufts: true },
    peachC: { trunk: '#3a3d3a', leaf: '#56645a', peach: '#d27a6a', leafFilter: 'opacity=".75" filter="url(#wash)"' },
    burnerC: { metal: '#4a4d4a', smoke: '#7d8483', line: INK, lw: 1.2 },
    cloudC: { cloud: PAPER, cloud2: '#e6ddc9', curl: INK, line: INK, lw: 1.6 },
    title: (t) => column(t, 1120, 120, 44, '#262624') + seal(1060, 92, 30, '#b3392a', PAPER),
    finish: () => `<rect width="${W}" height="${H}" filter="url(#paper)"/><rect width="${W}" height="${H}" filter="url(#fibre)"/>`,
    poleWood: '#3a3530',
  };
})();

STYLES.bluegreen = (() => {
  const LINE = '#3a3227', SILK = '#ead9b6';
  const grads = [['#5b86a0', '#79a796', '#d6c08f'], ['#2c5f84', '#3c8a76', '#c9a76a'], ['#2f6f86', '#4f9a7e', '#ccad70'], ['#28597a', '#3a8468', '#b48c50']];
  return {
    name: 'bluegreen', LINE,
    defs: () => `
      <filter id="silk" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.55 0.95" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .42  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .1 0"/></filter>
      <filter id="age" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .2  0 0 0 .12 0"/></filter>
      <filter id="pig" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>
      <filter id="fog" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3cfa6"/><stop offset="1" stop-color="${SILK}"/></linearGradient>
      <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8cfa0"/><stop offset=".6" stop-color="#e9b98c"/><stop offset="1" stop-color="#dc9c78"/></linearGradient>
      <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd6bf"/><stop offset="1" stop-color="#93b2a8"/></linearGradient>
      ${grads.map(([a, b, c], i) => `<linearGradient id="r${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset=".95" stop-color="${c}"/></linearGradient>`).join('')}
      <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28597a"/><stop offset=".35" stop-color="#3a8468"/><stop offset=".85" stop-color="#b48c50"/></linearGradient>
      <linearGradient id="caveG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5d66"/><stop offset=".5" stop-color="#4b7d68"/><stop offset="1" stop-color="#8e7446"/></linearGradient>`,
    ground: (kind) => `<rect width="${W}" height="${H}" fill="url(#${kind === 'dusk' ? 'dusk' : 'sky'})"/>`,
    sun: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c13d2b"/>`,
    range: (pts, base, depth) => `<g filter="url(#pig)"><path d="${closed(pts, base)}" fill="url(#r${depth})" ${depth ? '' : 'opacity=".8"'}/><path d="${smooth(pts)}" fill="none" stroke="${LINE}" stroke-width="${depth ? 1.6 : 1.1}" stroke-linejoin="round" ${depth ? '' : 'opacity=".8"'}/>${depth ? pts.filter((_, i) => i % 4 === 2 && pts[i][1] < base - 40).map(([x, y]) => `<path d="M${x - 4} ${y + 16} q10 30 0 64 M${x + 10} ${y + 30} q6 20 -2 40" stroke="${LINE}" stroke-width="1.1" fill="none" opacity=".45"/>`).join('') : ''}</g>`,
    mist: (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f7efdf" opacity=".7" filter="url(#fog)"/>`,
    sea: (y) => { const out = [`<rect y="${y}" width="${W}" height="${H - y}" fill="url(#seaG)"/>`]; for (let yy = y + 12; yy < H + 10; yy += 15) { const amp = 2.5 + (yy - y) / 70, len = 30 + (yy - y) / 8; out.push(`<path d="${wave(-40 + ((yy / 15) % 2) * len / 2, W + 40, yy, len, amp)}" stroke="#46777e" stroke-width="1.3" fill="none" opacity="${(0.3 + (yy - y) / 800).toFixed(2)}"/>`); } return out.join(''); },
    waterline: (x0, x1, y) => `<path d="${wave(x0, x1, y, 30, 5)}" stroke="#f6eedd" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    ring: (x, y) => `<ellipse cx="${x}" cy="${y + 2}" rx="14" ry="3.2" fill="none" stroke="#f6eedd" stroke-width="2"/>`,
    reflect: true,
    rock: (d) => `<g filter="url(#pig)"><path d="${d}" fill="url(#rock)" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/></g>`,
    cun: (pts) => pts.map(([x, y]) => `<path d="M${x - 4} ${y + 16} q10 30 0 64 M${x + 10} ${y + 30} q6 20 -2 40" stroke="${LINE}" stroke-width="1.1" fill="none" opacity=".45"/>`).join(''),
    moss: (pts) => pts.map(([x, y], i) => `<circle cx="${x + 3}" cy="${y + 7}" r="${2 + (i % 2)}" fill="#2a5a46"/>`).join(''),
    grass: (d) => `<g filter="url(#pig)"><path d="${d}" fill="#7fae7f" stroke="${LINE}" stroke-width="1.6"/></g>`,
    tufts: (pts) => pts.map(([x, y]) => `<path d="M${x - 8} ${y} q2 -14 6 -18 M${x} ${y} q0 -16 2 -22 M${x + 8} ${y} q-1 -12 4 -16" stroke="#3d7a58" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join(''),
    fall: (x0, x1, top, bottom) => `<path d="M${x0} ${top} L${x1} ${top} L${x1 + 10} ${bottom} L${x0 - 10} ${bottom} Z" fill="#e9f0ea" stroke="${LINE}" stroke-width="1.6"/>${Array.from({ length: 7 }, (_, i) => { const x = x0 + 8 + i * (x1 - x0 - 16) / 6; return `<path d="M${x} ${top + 6} q-3 ${(bottom - top) / 2} ${-4 + i * 1.4} ${bottom - top - 14}" stroke="#7fa7b0" stroke-width="1.3" fill="none"/>`; }).join('')}`,
    pool: (d) => `<path d="${d}" fill="#a9c3bb" stroke="${LINE}" stroke-width="1.4"/>`,
    foam: (x0, x1, y) => `<path d="M${x0 - 30} ${y} q18 -22 40 -8 q16 -20 38 -4 q18 -18 40 0 q18 -16 40 2 q16 -12 30 10 Z" fill="#f7f3ea" stroke="${LINE}" stroke-width="1.4"/>`,
    cave: (arch) => `<rect width="${W}" height="${H}" fill="url(#caveG)"/><path d="${arch}" fill="#e2cfa6" stroke="${LINE}" stroke-width="2"/>`,
    floor: (y) => `<path d="M0 ${y} H${W} V${H} H0 Z" fill="#c9ad78" stroke="${LINE}" stroke-width="1.6"/>`,
    stone: (d) => `<path d="${d}" fill="#9fae9a" stroke="${LINE}" stroke-width="1.6"/>`,
    shadow: (x, y, rx) => `<ellipse cx="${x}" cy="${y + 2}" rx="${rx}" ry="${rx / 6}" fill="${LINE}" opacity=".14"/>`,
    fx: (inner) => inner,
    monkeyC: { fur: '#b67b3a', line: LINE, lw: 1.5, face: '#f0d5ab', detail: LINE, belly: '#ddb075', trim: '#f2ead8' },
    robeC: '#8fa0ad',
    bodhiC: { robe: '#f3ead6', robe2: '#e6dcc4', skin: '#efd2ae', white: '#fffaf0', trim: '#b23a28', line: LINE, lw: 1.5, detail: LINE },
    raftC: { deck: '#c49a62', log: '#a5754a', grain: '#6b4a2c', rope: '#b23a28', line: LINE, lw: 1.6 },
    pineC: { trunk: '#7d5636', bark: '#4c3320', tuft: '#2d6a54', tuft2: '#3f8466', needle: '#a6d2b6', line: LINE, lw: 1.5 },
    peachC: { trunk: '#7d5636', leaf: '#5e9a6e', peach: '#ef9a86', line: LINE, lw: 1.4 },
    burnerC: { metal: '#7a6a3e', smoke: '#f7f1e2', line: LINE, lw: 1.4 },
    cloudC: { cloud: '#fbf6ea', cloud2: '#efe3c8', curl: '#b9a888', line: LINE, lw: 1.6 },
    title: (t) => column(t, 1120, 116, 40, LINE) + seal(1064, 90, 28, '#b3392a', SILK),
    finish: () => `<rect width="${W}" height="${H}" filter="url(#silk)"/><rect width="${W}" height="${H}" filter="url(#age)"/>`,
    poleWood: '#7a5634',
  };
})();

STYLES.woodblock = (() => {
  const INK = '#2a2420', CREAM = '#f3e4c4';
  const fills = ['#a9c7bb', '#7fa9a0', '#2e6c70', '#3c7c50'];
  return {
    name: 'woodblock', INK,
    defs: () => `
      <filter id="press" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.4" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .08 0"/></filter>`,
    ground: (kind) => `<rect width="${W}" height="${H}" fill="${kind === 'dusk' ? '#f1cf9f' : CREAM}"/>${kind === 'dusk' ? `<rect y="${H * 0.3}" width="${W}" height="${H}" fill="#f0bd8a"/><rect y="${H * 0.5}" width="${W}" height="${H}" fill="#eaa070"/>` : ''}`,
    sun: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 1.36}" fill="#e5a73a"/><circle cx="${x}" cy="${y}" r="${r}" fill="#d1482c"/>`,
    range: (pts, base, depth) => `<g filter="url(#press)"><path d="${closed(pts, base)}" fill="${fills[depth]}"/></g>${depth >= 2 ? pts.filter((_, k) => k % 7 === 3 && pts[k][1] < base - 50).map(([x, y]) => `<path d="M${x - 12} ${y + 34} l12 -12 l12 12" stroke="${CREAM}" stroke-width="3" fill="none" stroke-linejoin="round" opacity=".8"/>`).join('') : ''}`,
    mist: (cx, cy, rx, ry) => `<path d="M${cx - rx} ${cy} C${cx - rx} ${cy - ry} ${cx - rx * 0.4} ${cy - ry} ${cx - rx * 0.3} ${cy - ry * 0.3} C${cx - rx * 0.1} ${cy - ry * 1.2} ${cx + rx * 0.4} ${cy - ry * 1.1} ${cx + rx * 0.45} ${cy - ry * 0.2} C${cx + rx * 0.8} ${cy - ry * 0.7} ${cx + rx} ${cy - ry * 0.2} ${cx + rx} ${cy} Z" fill="${CREAM}" opacity=".9"/>`,
    sea: (y) => `<g filter="url(#press)"><rect y="${y}" width="${W}" height="${H}" fill="#2d4f7a"/></g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { let d = ''; const yy = y + 30 + i * 38, ph = (i % 2) * 40; for (let x = -80 + ph; x < W + 80; x += 80) d += `M${x} ${yy} q20 -18 40 -6 q-12 -2 -14 6 `; return `<path d="${d}" stroke="${CREAM}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`; }).join('')}`,
    waterline: (x0, x1, y) => { let d = ''; for (let x = x0; x < x1; x += 50) d += `M${x} ${y + 4} q12 -12 25 -4 q-8 -1 -9 4 `; return `<path d="${d}" stroke="${CREAM}" stroke-width="3" fill="none" stroke-linecap="round"/>`; },
    ring: (x, y) => `<ellipse cx="${x}" cy="${y + 3}" rx="15" ry="4" fill="none" stroke="${CREAM}" stroke-width="3"/>`,
    reflect: false,
    rock: (d) => `<path d="${d}" fill="#3c7c50" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
    cun: (pts) => pts.map(([x, y]) => `<path d="M${x - 12} ${y + 40} l12 -12 l12 12" stroke="${CREAM}" stroke-width="3" fill="none" stroke-linejoin="round" opacity=".75"/>`).join(''),
    moss: () => '',
    grass: (d) => `<path d="${d}" fill="#6aa04f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
    tufts: (pts) => pts.map(([x, y]) => `<path d="M${x - 8} ${y} l4 -14 l4 14 l4 -16 l4 16" fill="#3f7a35" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`).join(''),
    fall: (x0, x1, top, bottom) => `<path d="M${x0} ${top} L${x1} ${top} L${x1 + 10} ${bottom} L${x0 - 10} ${bottom} Z" fill="#9fc6d8" stroke="${INK}" stroke-width="3"/>${Array.from({ length: 5 }, (_, i) => { const x = x0 + 12 + i * (x1 - x0 - 24) / 4; return `<path d="M${x} ${top + 8} L${x - 2 + i} ${bottom - 12}" stroke="${CREAM}" stroke-width="5" stroke-linecap="round"/>`; }).join('')}`,
    pool: (d) => `<path d="${d}" fill="#2d4f7a" stroke="${INK}" stroke-width="3"/>`,
    foam: (x0, x1, y) => `<path d="M${x0 - 30} ${y} q18 -22 40 -8 q16 -20 38 -4 q18 -18 40 0 q18 -16 40 2 q16 -12 30 10 Z" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`,
    cave: (arch) => `<g filter="url(#press)"><rect width="${W}" height="${H}" fill="#5a3b2a"/></g><path d="${arch}" fill="#e8c98e" stroke="${INK}" stroke-width="3"/>`,
    floor: (y) => `<path d="M0 ${y} H${W} V${H} H0 Z" fill="#c98f4f" stroke="${INK}" stroke-width="3"/>`,
    stone: (d) => `<path d="${d}" fill="#8b9a8a" stroke="${INK}" stroke-width="3"/>`,
    shadow: (x, y, rx) => `<ellipse cx="${x}" cy="${y + 2}" rx="${rx}" ry="${rx / 6}" fill="${INK}" opacity=".2"/>`,
    fx: (inner) => inner,
    monkeyC: { fur: '#d9873a', line: INK, lw: 2.6, face: '#f7ddb2', detail: INK, belly: '#f0bd74', trim: '#f3e4c4' },
    robeC: '#6f8fae',
    bodhiC: { robe: '#f6ead0', robe2: '#ead9b6', skin: '#f3cfa2', white: '#ffffff', trim: '#d1482c', line: INK, lw: 2.6, detail: INK },
    raftC: { deck: '#d79a55', log: '#b8682f', grain: '#6e3a18', rope: '#d1482c', line: INK, lw: 3 },
    pineC: { trunk: '#8a4f24', bark: '#5a3014', tuft: '#1f4a32', tuft2: '#2e6c4a', needle: '#7fbf8c', line: INK, lw: 2.4 },
    peachC: { trunk: '#8a4f24', leaf: '#4f9a4f', peach: '#f28a7a', line: INK, lw: 2.4 },
    burnerC: { metal: '#c9a03a', smoke: '#f3e4c4', line: INK, lw: 2.4 },
    cloudC: { cloud: '#fffaf0', cloud2: '#f3e0c0', curl: '#d1482c', line: INK, lw: 2.6 },
    title: (t) => column(t, 1120, 120, 44, INK) + seal(1060, 92, 30, '#d1482c', CREAM),
    finish: () => `<rect width="${W}" height="${H}" filter="url(#grain)"/>`,
    poleWood: '#8a4f24',
  };
})();

const svg = (S, kind, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><style>${FONT}</style>${S.defs()}</defs>${S.ground(kind)}${inner}${S.finish()}</svg>`;

// ================================================================== scenes
/** 1. 乘筏西去: he poles his raft west, leaving the pine cliff of his home. */
function sceneRaft(S) {
  const SEA = 512;
  const far = peaks(-30, 900, SEA + 8, [[110, 200, 150], [300, 150, 150], [470, 240, 140], [640, 300, 120]], 14, 12, 3);
  const mid = peaks(120, 900, SEA + 26, [[290, 280, 150], [470, 226, 150], [650, 330, 130]], 14, 12, 22);
  const R = { x: 560, y: 600, L: 250 }, M = { x: 548, y: 595, s: 1.32 }, wl = R.y + 9;
  const cliffPts = peaks(880, 1230, 830, [[1040, 470, 150], [1170, 420, 140]], 3, 6, 41);
  const root = [930, yAt(cliffPts, 930) + 4];
  const pole = (c) => { const ly = (wl - M.y) / M.s; const t = (ly - POLE.a[1]) / (POLE.b[1] - POLE.a[1]); return { d: `M${M.x + POLE.a[0] * M.s} ${M.y + POLE.a[1] * M.s} L${M.x + (POLE.a[0] + (POLE.b[0] - POLE.a[0]) * t) * M.s} ${wl}`, entry: [M.x + (POLE.a[0] + (POLE.b[0] - POLE.a[0]) * t) * M.s, wl] }; };
  const P = pole();
  const figure = (c, rc, flat) => `${raft({ ...R, c: rc })}
    ${monkey({ x: M.x, y: M.y, s: M.s, pose: 'pole', c })}
    ${c.line ? `<path d="${P.d}" stroke="${c.line}" stroke-width="${8 + c.lw * 2 * M.s}" stroke-linecap="round"/>` : ''}
    <path d="${P.d}" stroke="${S.poleWood}" stroke-width="8" stroke-linecap="round"/>
    ${['f', 'b'].map((w) => { const [hx, hy] = handAt(M.x, M.y, M.s, 'pole', w); return `<circle cx="${hx}" cy="${hy}" r="${5.5 * M.s + (c.line ? c.lw * M.s : 0)}" fill="${c.line || c.fur}"/><circle cx="${hx}" cy="${hy}" r="${5.5 * M.s}" fill="${c.fur}"/>`; }).join('')}`;
  return svg(S, 'day', `
    ${S.sun(860, 190, 42)}
    ${S.range(far, SEA + 20, 0)}
    ${S.mist(300, SEA - 80, 520, 60)}
    ${S.sea(SEA + 14)}
    ${S.range(mid, SEA + 30, 2)}
    ${S.mist(300, SEA + 18, 500, 26)}
    ${S.sea === STYLES.ink.sea ? '' : ''}
    ${S.reflect ? `<g opacity=".12" transform="translate(0 ${2 * wl}) scale(1 -1)"><g>${raft({ ...R, c: { deck: '#333', log: '#333', grain: '#333', rope: '#333' } })}</g></g>` : ''}
    <clipPath id="above"><rect width="${W}" height="${wl}"/></clipPath>
    <g clip-path="url(#above)">${S.fx(figure(S.monkeyC, S.raftC))}</g>
    ${S.waterline(R.x - R.L / 2 - 40, R.x + R.L / 2 + 40, wl)}
    ${S.ring(P.entry[0], wl)}
    ${S.fx(pine({ rx: root[0], ry: root[1], c: S.pineC }))}
    ${S.rock(`${closed(cliffPts, 830)}`, smooth(cliffPts))}
    ${S.cun(cliffPts.filter((_, i) => i % 9 === 4))}
    ${S.moss(cliffPts.filter((_, i) => i % 3 === 0 && cliffPts[i][1] < 600))}
    ${S.title('乘筏西去')}`);
}

/** 2. 水帘洞: the troop at the pool; the stone monkey on a rock points at the waterfall. */
function sceneFalls(S) {
  const BANK = 650;
  const far = peaks(-30, 1230, 720, [[120, 150, 160], [1080, 130, 170]], 10, 12, 51);
  // the cliff the water falls from: a wide rock wall
  const wall = peaks(200, 1040, 680, [[440, 180, 180], [622, 290, 150], [800, 200, 180]], 6, 8, 52);
  const lipY = yAt(wall, 622) + 26; // the water comes out just under the saddle's edge
  const fallX0 = 572, fallX1 = 672;
  const bank = [[-20, BANK + 8], [200, BANK - 6], [420, BANK + 4], [560, BANK], [700, BANK + 6], [900, BANK - 4], [1220, BANK + 6]];
  const poolD = `M440 ${BANK - 2} C470 ${BANK - 26} 780 ${BANK - 26} 820 ${BANK - 2} C780 ${BANK + 22} 480 ${BANK + 24} 440 ${BANK - 2} Z`;
  const rockTop = BANK - 70; // the stone monkey's rock
  const rockD = `M400 ${BANK + 10} C396 ${rockTop + 30} 410 ${rockTop} 452 ${rockTop} C496 ${rockTop} 512 ${rockTop + 26} 508 ${BANK + 10} Z`;
  const g = S.monkeyC;
  return svg(S, 'day', `
    ${S.sun(980, 120, 34)}
    ${S.range(far, 720, 0)}
    ${S.mist(600, 380, 760, 70)}
    ${S.rock(closed(wall, 700), smooth(wall))}
    ${S.cun(wall.filter((_, i) => i % 6 === 3))}
    ${S.moss(wall.filter((_, i) => i % 4 === 0 && wall[i][1] < 400))}
    ${S.fall(fallX0, fallX1, lipY - 4, BANK - 10)}
    
    ${S.grass(`${smooth(bank)} L1220 ${H} L-20 ${H} Z`, smooth(bank))}
    ${S.pool(poolD)}
    ${S.foam(fallX0, fallX1, BANK - 6)}
    ${S.fx(peachTree({ x: 150, y: BANK + 30, h: 230, c: S.peachC }))}
    ${S.fx(peachTree({ x: 1060, y: BANK + 24, h: 210, c: S.peachC }))}
    ${S.stone(rockD)}
    ${S.shadow(230, BANK + 70, 30)}${S.shadow(340, BANK + 84, 26)}${S.shadow(890, BANK + 70, 28)}${S.shadow(975, BANK + 86, 24)}
    ${S.fx(monkey({ x: 230, y: BANK + 70, s: 0.92, pose: 'rest', c: { ...g, fur: shadeOf(g.fur, -0.25) } }))}
    ${S.fx(monkey({ x: 340, y: BANK + 84, s: 0.86, pose: 'cheer', flip: true, c: { ...g, fur: shadeOf(g.fur, -0.15) } }))}
    ${S.fx(monkey({ x: 890, y: BANK + 70, s: 0.9, pose: 'rest', c: { ...g, fur: shadeOf(g.fur, -0.3) } }))}
    ${S.fx(monkey({ x: 975, y: BANK + 86, s: 0.84, pose: 'cheer', c: { ...g, fur: shadeOf(g.fur, -0.2) } }))}
    ${S.fx(monkey({ x: 456, y: rockTop + 4, s: 1.05, pose: 'point', flip: true, c: g }))}
    ${S.tufts([[60, BANK + 120], [520, BANK + 110], [760, BANK + 130], [1150, BANK + 100]])}
    ${S.title('水帘洞')}`);
}
/** Lighter or darker fur for the troop, so the hero stands out. */
function shadeOf(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + (k < 0 ? v * k : (255 - v) * k))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 3. 三星洞: the master teaches from his stone seat; Wukong, in a disciple's robe, listens. */
function sceneCave(S) {
  const FLOOR = 650;
  const arch = `M90 ${FLOOR + 4} L90 290 C90 110 340 50 600 50 C860 50 1110 110 1110 290 L1110 ${FLOOR + 4} Z`;
  const DAIS = { x: 700, top: 540, w: 330 };
  const dais = `M${DAIS.x - DAIS.w / 2} ${FLOOR + 6} L${DAIS.x - DAIS.w / 2 + 24} ${DAIS.top} L${DAIS.x + DAIS.w / 2 - 24} ${DAIS.top} L${DAIS.x + DAIS.w / 2} ${FLOOR + 6} Z`;
  const cushionY = DAIS.top + 2;
  const WIN = { x: 360, y: 270, r: 110 };
  const view = peaks(WIN.x - 130, WIN.x + 130, WIN.y + 120, [[WIN.x - 50, WIN.y - 20, 90], [WIN.x + 60, WIN.y + 10, 80]], 4, 8, 71);
  return svg(S, 'cave', `
    ${S.cave(arch)}
    <clipPath id="win"><circle cx="${WIN.x}" cy="${WIN.y}" r="${WIN.r}"/></clipPath>
    <g clip-path="url(#win)">${S.ground('day')}${S.range(view, WIN.y + 140, 1)}${S.mist(WIN.x, WIN.y + 70, 160, 30)}</g>
    <circle cx="${WIN.x}" cy="${WIN.y}" r="${WIN.r}" fill="none" stroke="${S.monkeyC.line}" stroke-width="${S.name === 'ink' ? 3 : S.monkeyC.lw + 1}"/>
    ${S.floor(FLOOR)}
    ${S.stone(dais)}
    ${S.stone(`M${DAIS.x - 82} ${cushionY} C${DAIS.x - 82} ${cushionY - 22} ${DAIS.x + 82} ${cushionY - 22} ${DAIS.x + 82} ${cushionY} Z`).replace(/fill="[^"]+"/, `fill="${S.bodhiC.trim}"`)}
    ${S.fx(bodhi({ x: DAIS.x, y: cushionY - 8, s: 1.6, c: S.bodhiC }))}
    ${S.shadow(990, FLOOR + 40, 34)}
    ${S.fx(burner({ x: 990, y: FLOOR + 40, c: S.burnerC }))}
    ${S.shadow(380, FLOOR + 104, 56)}
    ${S.fx(monkey({ x: 380, y: FLOOR + 102, s: 1.55, sit: true, flip: true, robe: S.robeC, c: S.monkeyC }))}
    ${S.title('三星洞')}`);
}

/** 4. 筋斗云: at sunset he rides the somersault cloud over a sea of peaks. */
function sceneCloud(S) {
  const far = peaks(-30, 1230, 620, [[100, 420, 140], [330, 380, 150], [600, 440, 140], [880, 400, 150], [1120, 430, 140]], 10, 12, 61);
  const near = peaks(-30, 1230, 760, [[60, 560, 130], [420, 600, 140], [760, 540, 150], [1100, 590, 140]], 10, 12, 62);
  const C = { x: 520, y: 360 };
  const [back, front] = nimbus({ ...C, c: S.cloudC });
  return svg(S, 'dusk', `
    ${S.sun(980, 300, 50)}
    ${S.range(far, 640, 0)}
    ${S.mist(600, 600, 900, 70)}
    ${S.range(near, 780, 1)}
    ${S.mist(600, 730, 900, 60)}
    ${S.fx(back)}
    ${S.fx(monkey({ x: C.x + 6, y: C.y + 10, s: 1.45, pose: 'shade', robe: S.robeC, c: S.monkeyC }))}
    ${S.fx(front)}
    ${S.title('筋斗云')}`);
}

export const studies = [];
for (const [key, S] of Object.entries(STYLES)) {
  studies.push({ name: `${key}-1-raft`, svg: sceneRaft(S) });
  studies.push({ name: `${key}-2-falls`, svg: sceneFalls(S) });
  studies.push({ name: `${key}-3-cave`, svg: sceneCave(S) });
  studies.push({ name: `${key}-4-cloud`, svg: sceneCloud(S) });
}
