/**
 * A hand-drawn picture kit: the cast as puppets and the pieces of a scene, as
 * SVG strings. Read BRIEF.md first.
 *
 * A puppet's origin is the ground between its feet; y grows downwards, so the
 * body is at negative y. Limbs run from a joint inside the body to the hand or
 * foot and are drawn before the body, so a joint is never seen; every shape of
 * a figure has the same ink outline; no filter touches a figure.
 */

export const W = 1024;
export const H = 768;
export const INK = '#3a3330';
const SKIN = '#f6cfa8';
const ink = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** A limb through its points, outlined: the ink drawn wider beneath the colour. */
function limb(points, width, colour) {
  const d = points.length === 3
    ? `M${points[0][0]} ${points[0][1]} Q${points[1][0]} ${points[1][1]} ${points[2][0]} ${points[2][1]}`
    : `M${points.map((p) => p.join(' ')).join(' L')}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + 6}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const shadow = (rx) => `<ellipse cx="0" cy="2" rx="${rx}" ry="${rx / 5}" fill="#2b3a2a" opacity="0.16"/>`;
const place = (x, y, s, flip, body) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${body}</g>`;

export const apple = (x, y, r = 14) => `<g transform="translate(${x} ${y})">
  <circle r="${r}" fill="#d8443a" ${ink(2.5)}/><path d="M${-r * 0.4} ${-r * 0.35} a${r * 0.35} ${r * 0.3} 0 0 1 ${r * 0.45} ${-r * 0.2}" stroke="#f6b3a8" stroke-width="${r * 0.22}" fill="none" stroke-linecap="round"/>
  <path d="M0 ${-r} l2 ${-r * 0.5}" ${ink(2.5)}/><path d="M2 ${-r * 1.3} q${r * 0.6} ${-r * 0.4} ${r * 0.9} ${r * 0.1} q${-r * 0.5} ${r * 0.3} ${-r * 0.9} ${-r * 0.1} Z" fill="#6fa856" ${ink(2)}/></g>`;

/* ------------------------------------------------------------------ Ash */

const ASH_POSES = {
  stand: { hipY: -84, legs: [[[-12, -84], [-13, -46], [-15, -12]], [[12, -84], [13, -46], [15, -12]]] },
  walk: { hipY: -84, legs: [[[-12, -84], [-22, -48], [-30, -12]], [[12, -84], [16, -46], [22, -12]]] },
  hang: { hipY: -84, legs: [[[-12, -84], [-18, -46], [-12, -10]], [[12, -84], [26, -52], [30, -18]]] },
  sit: { hipY: -30, legs: [[[-10, -30], [30, -52], [58, -12]], [[10, -30], [46, -38], [78, -12]]] },
};

/**
 * Ash. pose: stand | walk | hang | sit. arms: [left, right] hands, each
 * [elbow, hand] relative to the shoulders' level; face: smile | worried |
 * ouch | happy; look: front | left | right | up. hold: 'apple' in the right
 * hand. front: the arms cross in front of the body (hands on the tummy), so
 * they are drawn over it.
 */
export function ash({ x, y, s = 1, flip = false, pose = 'stand', arms, front = false, face = 'smile', look = 'front', hold = null }) {
  const P = ASH_POSES[pose];
  const dy = P.hipY + 84; // the upper body comes down when sitting
  const sh = (px, py) => [px, py + dy];
  const L = sh(-27, -150);
  const R = sh(27, -150);
  const [al, ar] = arms ?? [[[-36, -118], [-40, -92]], [[36, -118], [40, -92]]];
  const at = ([px, py]) => [px, py + dy];
  const arm = (shoulder, [elbow, hand]) =>
    limb([shoulder, at(elbow)], 17, '#2f5fa7') + limb([at(elbow), at(hand)], 12, SKIN) +
    `<circle cx="${at(hand)[0]}" cy="${at(hand)[1]}" r="10" fill="#4c9a55" ${ink(3)}/>`;
  const legs = P.legs.map((pts) => {
    const foot = pts[2];
    const toe = pose === 'sit' ? 1 : foot[0] < 0 ? -1 : 1;
    return limb(pts, 20, '#3f5f93') +
      `<path d="M${foot[0] - 14 * toe} ${foot[1] + 8} q${2 * toe} -18 ${18 * toe} -16 q${14 * toe} 2 ${16 * toe} 16 Z" fill="#d23a32" ${ink(3)}/>` +
      `<path d="M${foot[0] - 14 * toe} ${foot[1] + 8} h${32 * toe}" ${ink(4)}/>`;
  });
  const hy = -204 + dy; // head centre
  const eye = (ex) => {
    const ox = look === 'left' ? -3 : look === 'right' ? 3 : 0;
    const oy = look === 'up' ? -3 : 0;
    if (face === 'ouch') return `<path d="M${ex - 6} ${hy - 4} l10 4 l-10 4" ${ink(3)} fill="none" transform="${ex > 0 ? `rotate(180 ${ex} ${hy})` : ''}"/>`;
    if (face === 'happy') return `<path d="M${ex - 6} ${hy + 1} q6 -8 12 0" ${ink(3)} fill="none"/>`;
    return `<ellipse cx="${ex + ox}" cy="${hy + oy}" rx="4.5" ry="6.5" fill="${INK}"/><circle cx="${ex + ox + 1.5}" cy="${hy + oy - 2.5}" r="1.8" fill="#fff"/>`;
  };
  const brows = face === 'worried'
    ? `<path d="M-20 ${hy - 13} l10 -4 M20 ${hy - 13} l-10 -4" ${ink(3)}/>`
    : face === 'ouch' ? `<path d="M-20 ${hy - 15} l10 3 M20 ${hy - 15} l-10 3" ${ink(3)}/>` : '';
  const mouth = {
    smile: `<path d="M-8 ${hy + 15} q8 8 16 0" ${ink(3)} fill="none"/>`,
    happy: `<path d="M-10 ${hy + 13} q10 14 20 0 Z" fill="#a8423a" ${ink(2.5)}/>`,
    worried: `<path d="M-7 ${hy + 19} q7 -6 14 0" ${ink(3)} fill="none"/>`,
    ouch: `<ellipse cx="0" cy="${hy + 18}" rx="6" ry="7" fill="#a8423a" ${ink(2.5)}/>`,
  }[face];
  const held = hold === 'apple' ? apple(at(ar[1])[0] + 4, at(ar[1])[1] - 10, 13) : '';
  const body = `${pose === 'hang' ? '' : shadow(pose === 'sit' ? 70 : 46)}
    ${legs.join('')}
    ${front ? '' : arm(L, al) + arm(R, ar)}
    <path d="M-31 ${-152 + dy} Q0 ${-160 + dy} 31 ${-152 + dy} L35 ${-82 + dy} Q0 ${-74 + dy} -35 ${-82 + dy} Z" fill="#2f5fa7" ${ink()}/>
    <path d="M-9 ${-155 + dy} L9 ${-155 + dy} L10 ${-79 + dy} L-10 ${-79 + dy} Z" fill="#f7f4ec" ${ink(2)}/>
    <path d="M-18 ${-153 + dy} l9 14 M18 ${-153 + dy} l-9 14" ${ink(2.5)}/>
    ${front ? arm(L, al) + arm(R, ar) : ''}
    <rect x="-8" y="${-172 + dy}" width="16" height="20" fill="${SKIN}" ${ink(2.5)}/>
    <path d="M-38 ${hy - 6} l-12 10 l12 2 l-10 12 l14 -2 M38 ${hy - 6} l12 10 l-12 2 l10 12 l-14 -2" fill="#2a2a33" ${ink(2)}/>
    <circle cx="-38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/><circle cx="38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/>
    <circle cx="0" cy="${hy}" r="38" fill="${SKIN}" ${ink()}/>
    <path d="M-40 ${hy - 10} C-40 ${hy - 54} 40 ${hy - 54} 40 ${hy - 10} Z" fill="#d93b30" ${ink()}/>
    <path d="M-17 ${hy - 40} C-9 ${hy - 48} 9 ${hy - 48} 17 ${hy - 40} L15 ${hy - 22} L-15 ${hy - 22} Z" fill="#f7f4ec" ${ink(2.5)}/>
    <path d="M-42 ${hy - 10} Q0 ${hy - 2} 46 ${hy - 12} Q20 ${hy + 4} -42 ${hy - 10} Z" fill="#b82e26" ${ink(2.5)}/>
    ${eye(-14)}${eye(14)}${brows}
    <path d="M-25 ${hy + 9} l3 3 l3 -3 M25 ${hy + 9} l-3 3 l-3 -3" ${ink(2)} fill="none"/>
    ${mouth}${held}`;
  return place(x, y, s, flip, body);
}

/* -------------------------------------------------------------- Pikachu */

/**
 * Pikachu. mood: smile | laugh | up | worried | eat. arms: 'down' | 'up' |
 * 'belly' | 'hold'. tilt: degrees, for rolling about.
 */
export function pikachu({ x, y, s = 1, flip = false, mood = 'smile', arms = 'down', tilt = 0, hold = null }) {
  const Y = '#f7d23c';
  const tail = `<path d="M18 -34 L34 -58 L26 -62 L50 -90 L42 -94 L70 -128 L88 -116 L62 -86 L72 -82 L46 -52 L56 -48 L24 -22 Z" fill="${Y}" ${ink()}/>
    <path d="M18 -34 L34 -58 L40 -54 L24 -26 Z" fill="#9a6a34" ${ink(2)}/>`;
  const ear = (sx) => `<g transform="scale(${sx} 1)"><path d="M-24 -112 C-38 -140 -50 -164 -48 -182 C-30 -172 -16 -146 -8 -118 Z" fill="${Y}" ${ink()}/>
    <path d="M-41 -158 C-46 -168 -49 -176 -48 -182 C-40 -177 -34 -168 -30 -160 Z" fill="#2a2522" ${ink(2)}/></g>`;
  const armPts = {
    down: [[[-20, -56], [-30, -40]], [[20, -56], [30, -40]]],
    up: [[[-22, -60], [-40, -84]], [[22, -60], [40, -84]]],
    belly: [[[-22, -56], [-6, -42]], [[22, -56], [6, -40]]],
    hold: [[[-20, -58], [-8, -62]], [[20, -58], [8, -62]]],
  }[arms];
  const eyes = {
    smile: `<circle cx="-15" cy="-104" r="6.5" fill="#2a2522"/><circle cx="15" cy="-104" r="6.5" fill="#2a2522"/><circle cx="-13" cy="-107" r="2.3" fill="#fff"/><circle cx="17" cy="-107" r="2.3" fill="#fff"/>`,
    up: `<circle cx="-15" cy="-106" r="6.5" fill="#2a2522"/><circle cx="15" cy="-106" r="6.5" fill="#2a2522"/><circle cx="-14" cy="-110" r="2.3" fill="#fff"/><circle cx="16" cy="-110" r="2.3" fill="#fff"/>`,
    laugh: `<path d="M-22 -102 q7 -10 14 0 M8 -102 q7 -10 14 0" ${ink(3.5)} fill="none"/>`,
    worried: `<circle cx="-15" cy="-103" r="6" fill="#2a2522"/><circle cx="15" cy="-103" r="6" fill="#2a2522"/><path d="M-22 -116 l10 4 M22 -116 l-10 4" ${ink(2.5)}/>`,
    eat: `<path d="M-22 -104 q7 -8 14 0 M8 -104 q7 -8 14 0" ${ink(3)} fill="none"/>`,
  }[mood];
  const mouth = mood === 'laugh'
    ? `<path d="M-10 -92 q10 16 20 0 Z" fill="#b84a3a" ${ink(2.5)}/><path d="M-5 -86 q5 4 10 0" fill="#ec8a7a"/>`
    : mood === 'eat' ? `<ellipse cx="0" cy="-89" rx="5" ry="4" fill="#b84a3a" ${ink(2)}/>`
      : `<path d="M-8 -91 q4 5 8 0 q4 5 8 0" ${ink(2.5)} fill="none"/>`;
  const held = hold === 'apple' ? apple(0, -60, 14) : '';
  const body = `${shadow(40)}<g transform="rotate(${tilt} 0 -60)">
    ${tail}
    <ellipse cx="-17" cy="-8" rx="14" ry="8" fill="${Y}" ${ink()}/><ellipse cx="17" cy="-8" rx="14" ry="8" fill="${Y}" ${ink()}/>
    <path d="M-31 -22 C-38 -58 -26 -82 0 -84 C26 -82 38 -58 31 -22 C24 -6 -24 -6 -31 -22 Z" fill="${Y}" ${ink()}/>
    ${ear(1)}${ear(-1)}
    <ellipse cx="0" cy="-100" rx="41" ry="34" fill="${Y}" ${ink()}/>
    ${eyes}
    <circle cx="-29" cy="-89" r="9" fill="#e5503e" ${ink(2)}/><circle cx="29" cy="-89" r="9" fill="#e5503e" ${ink(2)}/>
    <ellipse cx="0" cy="-96" rx="2" ry="1.5" fill="#2a2522"/>
    ${mouth}
    ${held}
    ${armPts.map((pts) => limb(pts, 11, Y)).join('')}
  </g>`;
  return place(x, y, s, flip, body);
}

/* ---------------------------------------------------------- the scenery */

export const defs = `<defs>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>
    <feColorMatrix type="saturate" values="0" in="n" result="g"/>
    <feComponentTransfer in="g" result="g2"><feFuncA type="linear" slope="0.06"/></feComponentTransfer>
    <feBlend in="SourceGraphic" in2="g2" mode="multiply"/>
  </filter>
  <filter id="wash" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="10" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="blur18"><feGaussianBlur stdDeviation="18"/></filter>
</defs>`;

export const sky = (top, bottom) => `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="860" cy="90" r="160" fill="#fff4d2" opacity="0.7" filter="url(#blur18)"/>`;

/** A band of hills across the picture at height y, wavy. */
export const hills = (y, colour, amp = 30, seed = 0) => {
  const pts = Array.from({ length: 7 }, (_, i) => [i * (W / 6), y - amp * Math.sin(i * 1.3 + seed)]);
  let d = `M0 ${H} L0 ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    d += ` C${px + 60} ${py} ${cx - 60} ${cy} ${cx} ${cy}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${colour}" filter="url(#wash)"/>`;
};

export const grassTufts = (pts, colour = '#7aa65e') => pts.map(([x, y]) => `<path d="M${x - 8} ${y} q2 -14 6 -18 M${x} ${y} q0 -16 2 -22 M${x + 8} ${y} q-1 -12 4 -16" stroke="${colour}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');

export const flowers = (pts) => pts.map(([x, y, c]) => `<g transform="translate(${x} ${y})"><circle r="4" cx="-4" fill="${c}"/><circle r="4" cx="4" fill="${c}"/><circle r="4" cy="-4" fill="${c}"/><circle r="4" cy="4" fill="${c}"/><circle r="3" fill="#f6d24a"/></g>`).join('');

/** A pine, soft, for the far and middle distance. */
export const pine = (x, y, h, colour) => `<g filter="url(#wash)"><rect x="${x - h * 0.03}" y="${y - h * 0.18}" width="${h * 0.06}" height="${h * 0.18}" fill="#7d6047"/>
  <path d="M${x} ${y - h} L${x - h * 0.28} ${y - h * 0.45} L${x - h * 0.14} ${y - h * 0.47} L${x - h * 0.36} ${y - h * 0.14} L${x + h * 0.36} ${y - h * 0.14} L${x + h * 0.14} ${y - h * 0.47} L${x + h * 0.28} ${y - h * 0.45} Z" fill="${colour}"/></g>`;

/** A round leafy tree; with apples, an apple tree. Its ground is at y. */
export function tree(x, y, h, { apples = [], colour = '#6f9f5c', dark = '#58864a', light = '#8dbb72' } = {}) {
  const r = h * 0.32;
  const cy = y - h + r;
  const crown = [[0, 0, r], [-r * 0.65, r * 0.25, r * 0.7], [r * 0.7, r * 0.2, r * 0.72], [-r * 0.2, -r * 0.45, r * 0.65], [r * 0.4, -r * 0.35, r * 0.6]];
  return `<g>
    <path d="M${x - h * 0.05} ${y} C${x - h * 0.03} ${y - h * 0.3} ${x - h * 0.06} ${y - h * 0.5} ${x - h * 0.02} ${cy + r * 0.3} L${x + h * 0.04} ${cy + r * 0.3} C${x + h * 0.06} ${y - h * 0.5} ${x + h * 0.04} ${y - h * 0.3} ${x + h * 0.07} ${y} Z" fill="#8a6446" ${ink(2.5)}/>
    <path d="M${x} ${cy + r * 0.5} q${-r * 0.4} ${-r * 0.2} ${-r * 0.7} ${-r * 0.5} M${x + 4} ${cy + r * 0.4} q${r * 0.4} ${-r * 0.2} ${r * 0.6} ${-r * 0.55}" stroke="#7a573c" stroke-width="${h * 0.025}" fill="none" stroke-linecap="round"/>
    ${crown.map(([dx, dy, rr]) => `<circle cx="${x + dx}" cy="${cy + dy}" r="${rr}" fill="${colour}" ${ink(2.5)}/>`).join('')}
    ${crown.map(([dx, dy, rr]) => `<circle cx="${x + dx}" cy="${cy + dy}" r="${rr - 2}" fill="${colour}"/>`).join('')}
    ${crown.map(([dx, dy, rr]) => `<path d="M${x + dx - rr * 0.6} ${cy + dy + rr * 0.55} a${rr * 0.8} ${rr * 0.5} 0 0 0 ${rr * 1.2} 0" stroke="${dark}" stroke-width="${rr * 0.18}" fill="none" stroke-linecap="round" opacity="0.6"/>`).join('')}
    ${crown.map(([dx, dy, rr]) => `<circle cx="${x + dx - rr * 0.3}" cy="${cy + dy - rr * 0.35}" r="${rr * 0.28}" fill="${light}" opacity="0.7"/>`).join('')}
    ${apples.map(([ax, ay]) => apple(x + ax * r, cy + ay * r, h * 0.035)).join('')}
  </g>`;
}

/** Ink marks: speed lines, a rumble, stars, sweat, a shout. */
export const marks = {
  speed: (x, y, n = 3, len = 40) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + i * 16} h${-len + i * 8}" ${ink(3)}/>`).join(''),
  rumble: (x, y) => `<path d="M${x} ${y} q6 -7 12 0 t12 0 t12 0" ${ink(2.5)} fill="none"/><path d="M${x + 6} ${y + 12} q6 -7 12 0 t12 0" ${ink(2.5)} fill="none"/>`,
  star: (x, y, r = 12, colour = '#f4c430') => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${colour}" ${ink(2)}/>`,
  sweat: (x, y) => `<path d="M${x} ${y} q-7 12 0 16 q7 -4 0 -16 Z" fill="#9fd0ea" ${ink(2)}/>`,
  shout: (x, y) => `<path d="M${x - 20} ${y} l-14 -14 M${x} ${y - 6} v-20 M${x + 20} ${y} l14 -14" ${ink(3)}/>`,
  bump: (x, y) => `<path d="M${x - 16} ${y} a16 10 0 0 1 32 0" ${ink(3)} fill="none"/>`,
};

export const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<g filter="url(#paper)">${inner}</g></svg>`;
