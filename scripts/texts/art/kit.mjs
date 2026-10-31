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

/*
 * The skeleton. Bones keep their length; a pose is the angle of each bone, in
 * degrees from straight down (90 points to +x, 180 straight up). A hand goes
 * only as far as the arm reaches: to reach higher, the body moves, the arm
 * does not stretch. Feet are put on the ground by moving the hips.
 */
const BONES = { upper: 38, fore: 36, thigh: 38, shin: 36 };
const dir = (a) => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
const step = ([x0, y0], a, len) => { const [dx, dy] = dir(a); return [x0 + dx * len, y0 + dy * len]; };

/**
 * Arms, [left, right], each [upper arm, forearm] angles; and where they are
 * drawn: behind the body, over it (front), or over the head too (over).
 */
export const ARMS = {
  rest: { a: [[-12, -6], [12, 6]], layer: 'back' },
  tummy: { a: [[-16, 72], [16, -72]], layer: 'front' },
  head: { a: [[-158, 176], [158, -176]], layer: 'over' },
  hang: { a: [[-170, -172], [170, 172]], layer: 'back' },
  pull: { a: [[46, 78], [62, 86]], layer: 'front' },
  hold: { a: [[-14, 86], [14, -86]], layer: 'front' },
  fist: { a: [[-12, -6], [156, 176]], layer: 'back' },
  shade: { a: [[-12, -6], [150, -118]], layer: 'over' },
  run: { a: [[-36, 44], [34, 146]], layer: 'back' },
  surprise: { a: [[-128, -150], [128, 150]], layer: 'back' },
  point: { a: [[-12, -6], [112, 118]], layer: 'back' },
  reach: { a: [[-12, -6], [86, 92]], layer: 'back' },
  lap: { a: [[-22, 24], [14, -150]], layer: 'front' },
  fork: { a: [[-12, -6], [34, 172]], layer: 'back' },
  clap: { a: [[-20, 110], [20, -110]], layer: 'front' },
  cradle: { a: [[-8, 62], [8, -62]], layer: 'front' },
  scratch: { a: [[-12, -6], [158, -176]], layer: ['back', 'over'] },
  restLap: { a: [[-14, 38], [14, -38]], layer: 'front' },
  carry: { a: [[-12, -6], [150, -128]], layer: ['back', 'front'] },
  sneak: { a: [[-34, 120], [34, -120]], layer: 'front' },
  catch: { a: [[-120, -150], [120, 150]], layer: 'back' },
  hips: { a: [[-48, 34], [48, -34]], layer: 'back' },
};

/** Legs, [left, right], each [thigh, shin] angles; cross: sitting cross-legged. */
export const LEGS = {
  stand: [[-4, -2], [4, 2]],
  walk: [[-14, -4], [16, 8]],
  run: [[-30, -78], [28, 6]],
  brace: [[-6, -4], [36, 44]],
  hang: [[-4, 8], [8, -8]],
  cross: 'cross',
  chair: 'chair',
};

/**
 * What a figure wears: the colours of each part, and the head. The cast is
 * built from these, so every figure has the same skeleton and the same
 * outline, and only its clothes and hair differ.
 */
const LOOKS = {
  ash: { top: '#2f5fa7', tee: '#f7f4ec', upper: '#2f5fa7', fore: SKIN, hand: '#4c9a55', pants: '#3f5f93', shin: '#3f5f93', shoe: '#d23a32', head: 'cap', marks: true },
  boy: { top: '#ee8c3a', upper: '#ee8c3a', fore: SKIN, hand: SKIN, pants: '#5b86b8', shin: SKIN, shoe: '#a46a3c', head: 'straw', hair: '#7a4a2a' },
  baker: { top: '#e9879e', apron: '#ffffff', upper: '#e9879e', fore: SKIN, hand: SKIN, pants: '#5d5a6a', shin: '#5d5a6a', shoe: '#5a4a3a', head: 'bun', hair: '#4a3328' },
  cook: { top: '#7fb0d6', apron: '#ffffff', upper: '#7fb0d6', fore: SKIN, hand: SKIN, pants: '#5d5a6a', shin: '#5d5a6a', shoe: '#5a4a3a', head: 'toque', hair: '#c9893a' },
  walker1: { top: '#9fbf86', upper: '#9fbf86', fore: '#9fbf86', hand: SKIN, pants: '#6a6a78', shin: '#6a6a78', shoe: '#4a4a52', head: 'short', hair: '#3a2a22' },
  doctor: { top: '#ffffff', upper: '#ffffff', fore: '#ffffff', hand: SKIN, pants: '#8fb4d9', shin: '#8fb4d9', shoe: '#ffffff', head: 'loops', hair: '#f29bb8', steth: true },
  jessie: { top: '#ffffff', upper: '#ffffff', fore: '#ffffff', hand: SKIN, pants: '#3e3a52', shin: '#3e3a52', shoe: '#3e3a52', head: 'long', hair: '#c2477e' },
  james: { top: '#ffffff', upper: '#ffffff', fore: '#ffffff', hand: SKIN, pants: '#3e3a52', shin: '#3e3a52', shoe: '#3e3a52', head: 'side', hair: '#a99be0' },
  clerk: { top: '#2f4a74', upper: '#2f4a74', fore: '#2f4a74', hand: SKIN, pants: '#2f4a74', shin: '#2f4a74', shoe: '#2a2a33', head: 'bun', hair: '#3a2a22', scarf: '#e9879e' },
  walker2: { top: '#d6a3c4', upper: '#d6a3c4', fore: SKIN, hand: SKIN, pants: '#e8d9b5', shin: SKIN, shoe: '#b05050', head: 'bob', hair: '#c9893a' },
};

/** Where every joint of a figure is, before it is placed: the legs, the hips, the arms. */
function skeleton({ legs: legName = 'stand', arms: armName = 'rest' }) {
  const A = typeof armName === 'string' ? ARMS[armName] : armName;
  const legSpec = LEGS[legName];
  const cross = legSpec === 'cross';
  const chair = legSpec === 'chair';
  // The legs from the hips, then the hips lifted so the lowest foot is on the ground.
  const legPts = cross || chair ? null : legSpec.map(([t, sh], i) => {
    const hip = [i ? 12 : -12, 0];
    const knee = step(hip, t, BONES.thigh);
    return [hip, knee, step(knee, sh, BONES.shin)];
  });
  const lowest = cross || chair ? 0 : Math.max(...legPts.map((p) => p[2][1]));
  // On a chair, seen from the front: the thighs come towards us, so they are short; the shins hang to the floor.
  const hipY = cross ? -26 : chair ? -10 - BONES.shin - 8 : -10 - lowest;
  const dy = hipY + 84; // the upper body's offset from standing
  const shoulders = [[-27, -150 + dy], [27, -150 + dy]];
  const armPts = A.a.map(([u, f], i) => {
    const el = step(shoulders[i], u, BONES.upper);
    return [shoulders[i], el, step(el, f, BONES.fore)];
  });
  return { A, cross, chair, legPts, hipY, dy, armPts };
}

/**
 * Where a figure's hand is in the picture (0 left, 1 right — the figure's own,
 * before a flip), for putting a rod, a rope or someone else's paw in it.
 */
export function handOf(lookName, { x, y, s = 1, flip = false, lean = 0, legs = 'stand', arms = 'rest' }, i = 1) {
  const k = lookName === 'boy' ? s * 0.86 : s;
  const { hipY, armPts } = skeleton({ legs, arms });
  const [hx, hy] = armPts[i][2];
  const r = (lean * Math.PI) / 180;
  const rx = hx * Math.cos(r) - (hy - hipY) * Math.sin(r);
  const ry = hx * Math.sin(r) + (hy - hipY) * Math.cos(r) + hipY;
  return [x + (flip ? -rx : rx) * k, y + ry * k];
}

/**
 * A figure of the cast. look: a key of LOOKS. legs: a key of LEGS; arms: a key
 * of ARMS, or { a: [[upper, fore], [upper, fore]], layer }; lean: degrees the
 * body leans from the hips (negative: back to the left); face: smile | worried
 * | ouch | happy | shock | determined | laugh; look: front | left | right |
 * up. hold: 'apple' | 'fork' in the right hand. hair: standing on end.
 */
export function figure(lookName, { x, y, s = 1, flip = false, legs: legName = 'stand', arms: armName = 'rest', lean = 0, face = 'smile', look = 'front', hold = null, hair = false, shadowless = false, inArms = '' }) {
  const K = LOOKS[lookName];
  const { A, cross, chair, legPts, hipY, dy, armPts } = skeleton({ legs: legName, arms: armName });
  const at = ([px, py]) => [px, py + hipY];
  const arm = ([sh, el, hand]) =>
    limb([sh, el], 17, K.upper) + limb([el, hand], 12, K.fore) +
    `<circle cx="${hand[0]}" cy="${hand[1]}" r="10" fill="${K.hand}" ${ink(3)}/>`;
  const shoe = (foot, toe) =>
    `<path d="M${foot[0] - 14 * toe} ${foot[1] + 8} q${2 * toe} -18 ${18 * toe} -16 q${14 * toe} 2 ${16 * toe} 16 Z" fill="${K.shoe}" ${ink(3)}/>` +
    `<path d="M${foot[0] - 14 * toe} ${foot[1] + 8} h${32 * toe}" ${ink(4)}/>`;
  const leg = (pts) => {
    const [hip, knee, foot] = pts.map(at);
    const drawn = K.shin === K.pants ? limb([hip, knee, foot], 20, K.pants) : limb([hip, knee], 20, K.pants) + limb([knee, foot], 13, K.shin);
    return drawn + shoe(foot, foot[0] < 0 ? -1 : 1);
  };
  const legs = cross
    ? (() => {
        // Cross-legged, seen from the front: thighs out to the knees, shins crossing in front.
        const l = [[-12, hipY], [-54, hipY + 12], [10, hipY + 20]];
        const r = [[12, hipY], [54, hipY + 12], [-10, hipY + 24]];
        const one = ([hip, knee, foot]) => (K.shin === K.pants ? limb([hip, knee], 20, K.pants) + limb([knee, foot], 18, K.pants) : limb([hip, knee], 20, K.pants) + limb([knee, foot], 13, K.shin));
        const sole = (f, t) => `<ellipse cx="${f[0] + 8 * t}" cy="${f[1] + 2}" rx="15" ry="9" fill="${K.shoe}" ${ink(3)}/>`;
        return [one(l) + sole(l[2], 1), one(r) + sole(r[2], -1)];
      })()
    : chair
      ? [[-1, 0], [1, 0]].map(([sx]) => {
          const hip = [12 * sx, hipY];
          const knee = [17 * sx, hipY + 8];
          const foot = [19 * sx, -10];
          const shin = K.shin === K.pants ? limb([knee, foot], 18, K.pants) : limb([knee, foot], 13, K.shin);
          return shin + `<ellipse cx="${hip[0] + 2 * sx}" cy="${hipY + 4}" rx="15" ry="12" fill="${K.pants}" ${ink(3)}/>` + shoe(foot, sx);
        })
      : legPts.map(leg);
  const hy = -204 + dy; // head centre
  const eye = (ex) => {
    const ox = look === 'left' ? -3 : look === 'right' ? 3 : 0;
    const oy = look === 'up' ? -3 : 0;
    if (face === 'ouch') return `<path d="M${ex - 6} ${hy - 4} l10 4 l-10 4" ${ink(3)} fill="none" transform="${ex > 0 ? `rotate(180 ${ex} ${hy})` : ''}"/>`;
    if (face === 'sleep') return `<path d="M${ex - 6} ${hy - 1} q6 7 12 0" ${ink(3)} fill="none"/>`;
    if (face === 'happy' || face === 'laugh') return `<path d="M${ex - 6} ${hy + 1} q6 -8 12 0" ${ink(3)} fill="none"/>`;
    if (face === 'shock') return `<circle cx="${ex}" cy="${hy}" r="7" fill="#fff" ${ink(2.5)}/><circle cx="${ex}" cy="${hy}" r="3" fill="${INK}"/>`;
    return `<ellipse cx="${ex + ox}" cy="${hy + oy}" rx="4.5" ry="6.5" fill="${INK}"/><circle cx="${ex + ox + 1.5}" cy="${hy + oy - 2.5}" r="1.8" fill="#fff"/>`;
  };
  const brows = {
    worried: `<path d="M-20 ${hy - 13} l10 -4 M20 ${hy - 13} l-10 -4" ${ink(3)}/>`,
    ouch: `<path d="M-20 ${hy - 15} l10 3 M20 ${hy - 15} l-10 3" ${ink(3)}/>`,
    determined: `<path d="M-21 ${hy - 16} l11 5 M21 ${hy - 16} l-11 5" ${ink(3.5)}/>`,
    shock: `<path d="M-21 ${hy - 16} q6 -5 12 0 M9 ${hy - 16} q6 -5 12 0" ${ink(3)} fill="none"/>`,
  }[face] ?? '';
  const mouth = {
    smile: `<path d="M-8 ${hy + 15} q8 8 16 0" ${ink(3)} fill="none"/>`,
    happy: `<path d="M-10 ${hy + 13} q10 14 20 0 Z" fill="#a8423a" ${ink(2.5)}/>`,
    laugh: `<path d="M-12 ${hy + 12} q12 18 24 0 Z" fill="#a8423a" ${ink(2.5)}/><path d="M-6 ${hy + 19} q6 4 12 0" fill="#ec8a7a"/>`,
    worried: `<path d="M-7 ${hy + 19} q7 -6 14 0" ${ink(3)} fill="none"/>`,
    ouch: `<ellipse cx="0" cy="${hy + 18}" rx="6" ry="7" fill="#a8423a" ${ink(2.5)}/>`,
    shock: `<ellipse cx="0" cy="${hy + 19}" rx="7" ry="9" fill="#a8423a" ${ink(2.5)}/>`,
    determined: `<path d="M-10 ${hy + 14} q10 9 20 0 Z" fill="#fff" ${ink(2.5)}/>`,
    sleep: `<ellipse cx="0" cy="${hy + 17}" rx="4" ry="3" fill="#a8423a" ${ink(2)}/>`,
    sly: `<path d="M-10 ${hy + 13} q12 6 22 -4" ${ink(3)} fill="none"/>`,
  }[face];
  const hand = armPts[1][2];
  const held = hold === 'apple' ? apple(hand[0] + 4, hand[1] - 10, 13)
    : hold === 'fork' ? `<path d="M${hand[0]} ${hand[1] - 6} v-46" ${ink(7)}/><path d="M${hand[0]} ${hand[1] - 6} v-46" stroke="#c9cdd2" stroke-width="3"/><path d="M${hand[0] - 8} ${hand[1] - 62} v14 q8 8 16 0 v-14 M${hand[0]} ${hand[1] - 62} v14" ${ink(3)} fill="none"/>` : '';
  const head = {
    cap: `<path d="M-38 ${hy - 6} l-12 10 l12 2 l-10 12 l14 -2 M38 ${hy - 6} l12 10 l-12 2 l10 12 l-14 -2" fill="#2a2a33" ${ink(2)}/>
      <circle cx="-38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/><circle cx="38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/>
      <circle cx="0" cy="${hy}" r="38" fill="${SKIN}" ${ink()}/>
      <path d="M-40 ${hy - 10} C-40 ${hy - 54} 40 ${hy - 54} 40 ${hy - 10} Z" fill="#d93b30" ${ink()}/>
      <path d="M-17 ${hy - 40} C-9 ${hy - 48} 9 ${hy - 48} 17 ${hy - 40} L15 ${hy - 22} L-15 ${hy - 22} Z" fill="#f7f4ec" ${ink(2.5)}/>
      <path d="M-42 ${hy - 10} Q0 ${hy - 2} 46 ${hy - 12} Q20 ${hy + 4} -42 ${hy - 10} Z" fill="#b82e26" ${ink(2.5)}/>`,
    straw: `<circle cx="-38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/><circle cx="38" cy="${hy + 4}" r="7" fill="${SKIN}" ${ink(2.5)}/>
      <circle cx="0" cy="${hy}" r="38" fill="${SKIN}" ${ink()}/>
      <path d="M-34 ${hy - 4} q4 -10 12 -8 q2 -8 10 -6 M34 ${hy - 4} q-4 -10 -12 -8" fill="none" stroke="${K.hair}" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="0" cy="${hy - 22}" rx="62" ry="13" fill="#ead07a" ${ink()}/>
      <path d="M-30 ${hy - 24} C-30 ${hy - 62} 30 ${hy - 62} 30 ${hy - 24} Z" fill="#ead07a" ${ink()}/>
      <path d="M-30 ${hy - 30} Q0 ${hy - 24} 30 ${hy - 30} L30 ${hy - 38} Q0 ${hy - 32} -30 ${hy - 38} Z" fill="#c8453a" ${ink(2)}/>`,
    short: `<circle cx="0" cy="${hy}" r="38" fill="${SKIN}" ${ink()}/><path d="M-38 ${hy - 4} C-40 ${hy - 50} 40 ${hy - 50} 38 ${hy - 4} C26 ${hy - 26} -20 ${hy - 30} -38 ${hy - 4} Z" fill="${K.hair}" ${ink()}/>`,
    bob: `<path d="M-44 ${hy + 24} C-52 ${hy - 50} 52 ${hy - 50} 44 ${hy + 24} Z" fill="${K.hair}" ${ink()}/><circle cx="0" cy="${hy}" r="36" fill="${SKIN}" ${ink()}/><path d="M-36 ${hy - 6} C-30 ${hy - 44} 30 ${hy - 44} 36 ${hy - 6} C20 ${hy - 22} -20 ${hy - 22} -36 ${hy - 6} Z" fill="${K.hair}" ${ink()}/>`,
    bun: `<circle cx="0" cy="${hy - 44}" r="16" fill="${K.hair}" ${ink()}/><circle cx="0" cy="${hy}" r="37" fill="${SKIN}" ${ink()}/><path d="M-37 ${hy - 4} C-34 ${hy - 46} 34 ${hy - 46} 37 ${hy - 4} C22 ${hy - 26} -22 ${hy - 26} -37 ${hy - 4} Z" fill="${K.hair}" ${ink()}/>`,
    loops: `<circle cx="-40" cy="${hy - 10}" r="17" fill="${K.hair}" ${ink()}/><circle cx="40" cy="${hy - 10}" r="17" fill="${K.hair}" ${ink()}/>
      <circle cx="0" cy="${hy}" r="37" fill="${SKIN}" ${ink()}/>
      <path d="M-37 ${hy - 4} C-34 ${hy - 46} 34 ${hy - 46} 37 ${hy - 4} C24 ${hy - 20} 4 ${hy - 26} 0 ${hy - 12} C-6 ${hy - 26} -24 ${hy - 20} -37 ${hy - 4} Z" fill="${K.hair}" ${ink()}/>
      <path d="M-18 ${hy - 36} L18 ${hy - 36} L14 ${hy - 54} L-14 ${hy - 54} Z" fill="#ffffff" ${ink(2.5)}/><path d="M0 ${hy - 50} v10 M-5 ${hy - 45} h10" stroke="#e5533e" stroke-width="3"/>`,
    long: `<circle cx="0" cy="${hy}" r="37" fill="${SKIN}" ${ink()}/>
      <path d="M-39 ${hy + 2} C-40 ${hy - 50} 40 ${hy - 50} 39 ${hy + 2} C30 ${hy - 26} 10 ${hy - 30} -4 ${hy - 20} C-16 ${hy - 28} -30 ${hy - 22} -39 ${hy + 2} Z" fill="${K.hair}" ${ink()}/>`,
    side: `<circle cx="0" cy="${hy}" r="37" fill="${SKIN}" ${ink()}/>
      <path d="M-38 ${hy + 4} C-44 ${hy - 50} 40 ${hy - 56} 40 ${hy - 6} C30 ${hy - 26} 10 ${hy - 26} -4 ${hy - 14} C-14 ${hy - 6} -26 ${hy - 6} -38 ${hy + 4} Z" fill="${K.hair}" ${ink()}/>`,
    toque: `<circle cx="0" cy="${hy}" r="37" fill="${SKIN}" ${ink()}/><path d="M-30 ${hy - 20} L-30 ${hy - 40} C-50 ${hy - 50} -40 ${hy - 86} -14 ${hy - 76} C-8 ${hy - 96} 22 ${hy - 94} 22 ${hy - 76} C46 ${hy - 82} 52 ${hy - 50} 30 ${hy - 40} L30 ${hy - 20} Z" fill="#ffffff" ${ink()}/>`,
  }[K.head];
  const marks = K.marks ? `<path d="M-25 ${hy + 9} l3 3 l3 -3 M25 ${hy + 9} l-3 3 l-3 -3" ${ink(2)} fill="none"/>` : '';
  const spiky = hair ? `<path d="M-24 ${hy - 46} l-10 -26 M0 ${hy - 52} v-30 M24 ${hy - 46} l10 -26 M-40 ${hy - 30} l-22 -14 M40 ${hy - 30} l22 -14" ${ink(4)}/>` : '';
  const torso = `<path d="M-31 ${-152 + dy} Q0 ${-160 + dy} 31 ${-152 + dy} L35 ${-82 + dy} Q0 ${-74 + dy} -35 ${-82 + dy} Z" fill="${K.top}" ${ink()}/>` +
    (K.tee ? `<path d="M-9 ${-155 + dy} L9 ${-155 + dy} L10 ${-79 + dy} L-10 ${-79 + dy} Z" fill="${K.tee}" ${ink(2)}/><path d="M-18 ${-153 + dy} l9 14 M18 ${-153 + dy} l-9 14" ${ink(2.5)}/>` : '') +
    (K.apron ? `<path d="M-20 ${-140 + dy} L20 ${-140 + dy} L26 ${-76 + dy} L-26 ${-76 + dy} Z" fill="${K.apron}" ${ink(2.5)}/>` : '') +
    (K.top === '#ffffff' ? `<path d="M0 ${-154 + dy} V${-78 + dy} M-14 ${-154 + dy} l12 22 M14 ${-154 + dy} l-12 22" ${ink(2.5)}/>` : '') +
    (K.steth ? `<path d="M-12 ${-152 + dy} q0 40 14 44 q14 -4 14 -44" stroke="#5a6a7a" stroke-width="4" fill="none"/><circle cx="2" cy="${-106 + dy}" r="6" fill="#9aa8b4" ${ink(2)}/>` : '') +
    (K.scarf ? `<path d="M-14 ${-154 + dy} L14 ${-154 + dy} L4 ${-132 + dy} Z" fill="${K.scarf}" ${ink(2)}/>` : '');
  // Long hair falls behind the shoulders: it is drawn before the body and the arms.
  const backHair = K.head === 'long'
    ? `<path d="M-40 ${hy - 10} C-70 ${hy + 30} -60 ${hy + 90} -30 ${hy + 110} C-12 ${hy + 80} -6 ${hy + 60} 0 ${hy + 40} C6 ${hy + 60} 12 ${hy + 80} 30 ${hy + 110} C60 ${hy + 90} 70 ${hy + 30} 40 ${hy - 10} Z" fill="${K.hair}" ${ink()}/>`
    : '';
  const layerOf = (i) => (Array.isArray(A.layer) ? A.layer[i] : A.layer);
  const armsIn = (layer) => armPts.filter((_, i) => layerOf(i) === layer).map(arm).join('');
  const upper = `${backHair}${armsIn('back')}
    ${torso}
    ${inArms}
    ${armsIn('front')}
    <rect x="-8" y="${-172 + dy}" width="16" height="20" fill="${SKIN}" ${ink(2.5)}/>
    ${spiky}${head}
    ${eye(-14)}${eye(14)}${brows}${marks}${mouth}
    ${armsIn('over')}${held}`;
  const body = `${shadowless || legName === 'hang' ? '' : shadow(cross ? 64 : chair ? 0 : 46)}
    ${legs.join('')}
    <g transform="rotate(${lean} 0 ${hipY})">${upper}</g>`;
  return place(x, y, s, flip, body);
}

/** Ash: see `figure`. */
export const ash = (o) => figure('ash', o);
/** The boy at the river, about Ash's height less a head: see `figure`. */
export const boy = (o) => figure('boy', { ...o, s: (o.s ?? 1) * 0.86 });

/* -------------------------------------------------------------- Pikachu */

/**
 * Pikachu. mood: smile | laugh | up | worried | eat | full. arms: 'down' |
 * 'up' | 'belly' | 'hold' | 'run' | 'reach' (both paws out to the right). tilt: degrees, for rolling about. spark:
 * little lightning from the cheeks; cream: cake all over the head and paws.
 */
export function pikachu({ x, y, s = 1, flip = false, mood = 'smile', arms = 'down', tilt = 0, hold = null, spark = false, cream = false, shadowless = false }) {
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
    run: [[[-20, -58], [-40, -50]], [[20, -58], [40, -72]]],
    reach: [[[-18, -60], [14, -66]], [[20, -58], [48, -62]]],
  }[arms];
  const eyes = {
    smile: `<circle cx="-15" cy="-104" r="6.5" fill="#2a2522"/><circle cx="15" cy="-104" r="6.5" fill="#2a2522"/><circle cx="-13" cy="-107" r="2.3" fill="#fff"/><circle cx="17" cy="-107" r="2.3" fill="#fff"/>`,
    up: `<circle cx="-15" cy="-106" r="6.5" fill="#2a2522"/><circle cx="15" cy="-106" r="6.5" fill="#2a2522"/><circle cx="-14" cy="-110" r="2.3" fill="#fff"/><circle cx="16" cy="-110" r="2.3" fill="#fff"/>`,
    laugh: `<path d="M-22 -102 q7 -10 14 0 M8 -102 q7 -10 14 0" ${ink(3.5)} fill="none"/>`,
    worried: `<circle cx="-15" cy="-103" r="6" fill="#2a2522"/><circle cx="15" cy="-103" r="6" fill="#2a2522"/><path d="M-22 -116 l10 4 M22 -116 l-10 4" ${ink(2.5)}/>`,
    eat: `<path d="M-22 -104 q7 -8 14 0 M8 -104 q7 -8 14 0" ${ink(3)} fill="none"/>`,
    sleep: `<path d="M-22 -104 q7 7 14 0 M8 -104 q7 7 14 0" ${ink(3)} fill="none"/>`,
    full: `<path d="M-22 -104 q7 6 14 0 M8 -104 q7 6 14 0" ${ink(3)} fill="none"/>`,
  }[mood];
  const mouth = mood === 'laugh'
    ? `<path d="M-10 -92 q10 16 20 0 Z" fill="#b84a3a" ${ink(2.5)}/><path d="M-5 -86 q5 4 10 0" fill="#ec8a7a"/>`
    : mood === 'eat' ? `<ellipse cx="0" cy="-89" rx="5" ry="4" fill="#b84a3a" ${ink(2)}/>`
      : `<path d="M-8 -91 q4 5 8 0 q4 5 8 0" ${ink(2.5)} fill="none"/>`;
  const held = hold === 'apple' ? apple(0, -60, 14) : hold === 'cake' ? cake(0, -44, 0.7) : '';
  const zap = spark ? `${bolt(-52, -96, 1)}${bolt(52, -96, -1)}${bolt(-44, -60, 1, 0.7)}${bolt(46, -130, -1, 0.7)}` : '';
  const goo = cream ? `<g fill="#fffaf2" ${ink(2)}><path d="M-28 -128 q8 -14 20 -6 q10 -12 20 0 q10 2 4 12 q-22 6 -44 -6 Z"/><circle cx="-34" cy="-46" r="7"/><circle cx="32" cy="-50" r="8"/><circle cx="20" cy="-82" r="5"/></g><circle cx="-6" cy="-132" r="5" fill="#d8443a" ${ink(2)}/>` : '';
  const body = `${shadowless ? '' : shadow(40)}<g transform="rotate(${tilt} 0 -60)">
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
    ${goo}${zap}
  </g>`;
  return place(x, y, s, flip, body);
}

/* ---------------------------------------------------------------- props */

/** A small lightning bolt, inked; dir 1 points left, -1 right. */
export const bolt = (x, y, dir = 1, k = 1) => `<path transform="translate(${x} ${y}) scale(${dir * k} ${k})" d="M0 0 l-14 8 l8 2 l-14 12 l22 -10 l-8 -2 l12 -10 Z" fill="#ffe25a" ${ink(2)}/>`;

/** A cake with pink icing and a cherry, standing on its plate at (x, y). */
export const cake = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <ellipse cx="0" cy="0" rx="46" ry="9" fill="#ffffff" ${ink(2.5)}/>
  <path d="M-36 -2 L-36 -40 Q0 -50 36 -40 L36 -2 Q0 6 -36 -2 Z" fill="#f6e2c4" ${ink(2.5)}/>
  <path d="M-36 -22 Q0 -14 36 -22" stroke="#e7a7b8" stroke-width="5" fill="none"/>
  <path d="M-38 -40 Q0 -54 38 -40 q-4 10 -10 4 q-6 10 -12 2 q-8 10 -14 2 q-8 10 -14 0 q-6 8 -10 -2 Z" fill="#f4a3b8" ${ink(2.5)}/>
  <circle cx="0" cy="-52" r="7" fill="#d8443a" ${ink(2)}/></g>`;

/** A stack of n plates, its bottom at (x, y). */
export const plates = (x, y, n) => Array.from({ length: n }, (_, i) => `<ellipse cx="${x}" cy="${y - i * 8}" rx="40" ry="9" fill="#ffffff" ${ink(2)}/>`).join('');

/** A gold medal on a red ribbon. */
export const medal = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-12 -40 L-4 -6 L4 -6 L12 -40" fill="#d84a3a" ${ink(2)}/><circle cx="0" cy="6" r="16" fill="#f4c430" ${ink(2.5)}/>${marks.star(0, 6, 8, '#fff2a8')}</g>`;

/** A fishing rod held at (hx, hy), its tip at (tx, ty), the line down to (lx, ly). */
export const rod = (hx, hy, tx, ty, lx, ly) => `<path d="M${hx} ${hy} Q${(hx + tx) / 2} ${Math.min(hy, ty) - 60} ${tx} ${ty}" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M${hx} ${hy} Q${(hx + tx) / 2} ${Math.min(hy, ty) - 60} ${tx} ${ty}" stroke="#a87a4a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M${tx} ${ty} L${lx} ${ly}" stroke="${INK}" stroke-width="1.6"/>`;

/** Rings and drops where something pulls at the water. */
export const splash = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round">
  <ellipse rx="26" ry="7"/><ellipse rx="46" ry="12" opacity="0.6"/></g>
  <g transform="translate(${x} ${y}) scale(${k})" fill="#bfe3f2" ${ink(2)}><path d="M-20 -14 q-4 -10 0 -16 q4 6 0 16 Z"/><path d="M14 -18 q-4 -10 0 -16 q4 6 0 16 Z"/><path d="M-2 -24 q-3 -8 0 -12 q3 4 0 12 Z"/></g>`;

/** An old boot on the end of a line, dripping. */
export const boot = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M-26 -92 L18 -92 L20 -34 L64 -24 C80 -20 82 0 66 4 L-28 4 Z" fill="#8a6446" ${ink()}/>
  <path d="M-26 -92 L18 -92 L18 -80 L-26 -80 Z" fill="#6e4e34" ${ink(2.5)}/>
  <path d="M-28 4 L66 4" ${ink(4)}/><path d="M-6 -60 l14 6 M-6 -46 l14 6" ${ink(2.5)}/>
  <path d="M-14 4 q-6 18 2 30 M20 4 q6 14 -2 26 M50 4 q4 14 -4 22" stroke="#5f9a4a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <g fill="#bfe3f2" ${ink(1.5)}><path d="M-30 20 q-4 8 0 12 q4 -4 0 -12 Z"/><path d="M70 16 q-4 8 0 12 q4 -4 0 -12 Z"/></g></g>`;

/** A thought bubble from (x, y) up to a cloud at (cx, cy) with something inside. */
export const thought = (x, y, cx, cy, inside) => `<g><circle cx="${x}" cy="${y}" r="6" fill="#fff" ${ink(2)}/><circle cx="${(x * 2 + cx) / 3}" cy="${(y * 2 + cy) / 3 + 10}" r="10" fill="#fff" ${ink(2)}/>
  <path d="M${cx - 70} ${cy + 10} q-10 -40 30 -44 q16 -26 50 -12 q34 -14 48 16 q30 10 10 40 q-10 24 -40 16 q-30 18 -60 4 q-36 6 -38 -20 Z" fill="#fff" ${ink(2.5)}/>${inside}</g>`;

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
  zzz: (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})" ${ink(3)} fill="none"><path d="M0 0 h16 l-16 16 h16"/><path d="M22 -22 h12 l-12 12 h12"/><path d="M40 -40 h9 l-9 9 h9"/></g>`,
  heart: (x, y, k = 1) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 8 C-18 -6 -14 -22 0 -14 C14 -22 18 -6 0 8 Z" fill="#e5533e" ${ink(2)}/>`,
  bump: (x, y) => `<path d="M${x - 16} ${y} a16 10 0 0 1 32 0" ${ink(3)} fill="none"/>`,
};

/** A river across the picture from y1 to y2, with a lighter shallow edge. */
export const river = (y1, y2, colour = '#9fcbe0') => `<path d="M0 ${y1} C260 ${y1 - 14} 520 ${y1 + 12} 780 ${y1 - 4} C900 ${y1 - 12} 980 ${y1} ${W} ${y1 - 6} L${W} ${y2} L0 ${y2} Z" fill="${colour}" filter="url(#wash)"/>
  <path d="M0 ${y1 + 4} C260 ${y1 - 10} 520 ${y1 + 16} 780 ${y1} C900 ${y1 - 8} 980 ${y1 + 4} ${W} ${y1 - 2}" stroke="#d7eef6" stroke-width="6" fill="none" opacity="0.8"/>
  ${[[90, 40, 60], [380, 70, 90], [700, 34, 60], [260, 120, 70], [860, 100, 60]].filter(([, dy]) => y1 + dy < y2 - 6).map(([x, dy, w]) => `<path d="M${x} ${y1 + dy} h${w}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.65"/>`).join('')}`;

export const reeds = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})" stroke="#5f8f4a" stroke-width="5" fill="none" stroke-linecap="round"><path d="M0 0 q-6 -50 4 -96"/><path d="M14 0 q4 -64 -2 -116"/><path d="M28 0 q8 -42 16 -80"/></g>
  <g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="2" cy="-100" rx="5" ry="14" fill="#8a6446" ${ink(2)}/><ellipse cx="13" cy="-122" rx="5" ry="14" fill="#8a6446" ${ink(2)}/></g>`;

export const rock = (x, y, w, h) => `<path d="M${x - w / 2} ${y} C${x - w / 2} ${y - h} ${x + w / 2} ${y - h} ${x + w / 2} ${y} Z" fill="#a9a59a" ${ink(2.5)}/><path d="M${x - w / 4} ${y - h * 0.55} q${w / 6} -${h / 6} ${w / 3} 0" stroke="#c8c4b8" stroke-width="5" fill="none" stroke-linecap="round"/>`;

/** A row of town houses far off, at ground y. */
export const townFar = (x, y, colour = '#b9a7c9') => `<g fill="${colour}" filter="url(#wash)">${[[0, 70, 50], [56, 110, 40], [104, 80, 0], [160, 90, 60], [228, 54, 40], [276, 120, 34], [318, 70, 50]].map(([dx, h, w], i) => i === 2 ? `<path d="M${x + dx} ${y} v-60 l30 -30 l30 30 v60 Z"/>` : `<rect x="${x + dx}" y="${y - h}" width="${w}" height="${h}"/>`).join('')}</g>`;

/** A shop front at ground y: walls, an awning in stripes, a window (cakes in it). */
export function shopFront(x, y, w, h, wall, awning, cakes = false) {
  const stripes = Array.from({ length: Math.ceil(w / 32) }, (_, i) => `<path d="M${x + i * 32} ${y - h + 6} h16 v34 q-8 10 -16 0 Z" fill="#ffffff" opacity="0.85"/>`).join('');
  const scallop = Array.from({ length: Math.ceil(w / 32) }, (_, i) => `<path d="M${x + i * 32} ${y - h + 40} q8 12 16 0 q8 12 16 0" fill="${awning}" ${ink(2)}/>`).join('');
  const win = cakes ? [0.25, 0.5, 0.75].map((f) => cake(x + w * f, y - 70, 0.55)).join('') : '';
  return `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}" ${ink(2.5)}/>
    <rect x="${x + 18}" y="${y - h + 70}" width="${w - 36}" height="${h - 110}" rx="6" fill="#d8ebf1" ${ink(2.5)}/>
    <path d="M${x + 22} ${y - h + 76} l${w * 0.2} ${h * 0.25}" stroke="#ffffff" stroke-width="8" opacity="0.6" stroke-linecap="round"/>
    ${win}
    <rect x="${x - 4}" y="${y - h + 6}" width="${w + 8}" height="34" fill="${awning}" ${ink(2.5)}/>${stripes}${scallop}</g>`;
}

/** A town clock on its post, ground at y. */
export const clockPost = (x, y, h) => `<g><rect x="${x - 10}" y="${y - h}" width="20" height="${h}" fill="#5a6a72" ${ink(2.5)}/><rect x="${x - 22}" y="${y - 14}" width="44" height="14" rx="4" fill="#5a6a72" ${ink(2.5)}/>
  <circle cx="${x}" cy="${y - h - 40}" r="46" fill="#f8f4ea" stroke="${INK}" stroke-width="3"/><circle cx="${x}" cy="${y - h - 40}" r="46" fill="none" stroke="#5a6a72" stroke-width="8" opacity="0.9"/>
  ${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<circle cx="${x + Math.sin(a) * 34}" cy="${y - h - 40 - Math.cos(a) * 34}" r="2.5" fill="${INK}"/>`; }).join('')}
  <path d="M${x} ${y - h - 40} v-28 M${x} ${y - h - 40} l20 -6" ${ink(5)}/></g>`;

/** A room: a wall with a band and a floor from y down. */
export const room = (wall, band, floor, y) => `<rect width="${W}" height="${H}" fill="${wall}"/><rect y="${y - 230}" width="${W}" height="16" fill="${band}" opacity="0.7"/>
  <rect y="${y}" width="${W}" height="${H - y}" fill="${floor}"/><path d="M0 ${y} H${W}" ${ink(2.5)}/>
  ${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 200 - 60} ${H} L${i * 200 + 40} ${y}" stroke="#000" stroke-width="2" opacity="0.06"/>`).join('')}`;

/** A counter or table: top at y, from x1 to x2. */
export const counter = (x1, x2, y, top = '#c99a6a', front = '#b4835a', h = 120) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" fill="${front}" ${ink(2.5)}/><rect x="${x1 - 10}" y="${y - 14}" width="${x2 - x1 + 20}" height="18" rx="5" fill="${top}" ${ink(2.5)}/>`;

/** Bunting across from (x1, y1) to (x2, y1), in a sag. */
export const bunting = (x1, x2, y, colours = ['#f4a3b8', '#f4c430', '#9fcbe0', '#9fd08a']) => {
  const n = Math.floor((x2 - x1) / 56);
  const sag = (t) => y + Math.sin(Math.PI * t) * 40;
  return `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + 80} ${x2} ${y}" stroke="${INK}" stroke-width="2.5" fill="none"/>` +
    Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n; const px = x1 + (x2 - x1) * t; const py = sag(t); return `<path d="M${px - 16} ${py} L${px + 16} ${py} L${px} ${py + 30} Z" fill="${colours[i % colours.length]}" ${ink(2)}/>`; }).join('');
};

/* ------------------------------------------------- rooms, beds, vehicles */

/** A bed seen from the side, its head to the left: ground at y, from x, w wide. */
export const bed = (x, y, w, sheet = '#f4f1ea', wood = '#b48a64') => `<g>
  <rect x="${x - 12}" y="${y - 150}" width="22" height="150" rx="8" fill="${wood}" ${ink(2.5)}/>
  <rect x="${x + w - 10}" y="${y - 100}" width="20" height="100" rx="8" fill="${wood}" ${ink(2.5)}/>
  <rect x="${x}" y="${y - 70}" width="${w}" height="36" fill="${wood}" ${ink(2.5)}/>
  <rect x="${x}" y="${y - 96}" width="${w}" height="30" rx="10" fill="${sheet}" ${ink(2.5)}/>
  <ellipse cx="${x + 54}" cy="${y - 104}" rx="44" ry="16" fill="#ffffff" ${ink(2.5)}/></g>`;

/** A blanket over a bed from x to x2 at the mattress top y, a hump where someone lies. */
export const blanket = (x, x2, y, colour = '#8fb4d9', hump = 0.3) => {
  const hx = x + (x2 - x) * hump;
  return `<path d="M${x} ${y + 26} L${x} ${y} C${hx - 40} ${y - 4} ${hx - 30} ${y - 40} ${hx + 20} ${y - 40} C${hx + 80} ${y - 40} ${hx + 90} ${y - 6} ${x2} ${y - 4} L${x2 + 6} ${y + 30} Z" fill="${colour}" ${ink(2.5)}/>
    <path d="M${x + 20} ${y + 12} q40 -10 80 0 M${hx + 40} ${y - 14} q30 6 60 6" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round"/>`;
};

/** A chair seen from the front, its seat at height h above the ground y. Drawn behind whoever sits on it. */
export const chair = (x, y, h = 58, wood = '#9a7452') => `<g>
  <rect x="${x - 44}" y="${y - h - 120}" width="88" height="120" rx="12" fill="${wood}" ${ink(2.5)}/>
  <rect x="${x - 32}" y="${y - h - 106}" width="64" height="88" rx="8" fill="#b88e66"/>
  <path d="M${x - 40} ${y - h} V${y} M${x + 40} ${y - h} V${y}" ${ink(10)}/><path d="M${x - 40} ${y - h} V${y} M${x + 40} ${y - h} V${y}" stroke="${wood}" stroke-width="5"/>
  <rect x="${x - 50}" y="${y - h - 10}" width="100" height="18" rx="6" fill="${wood}" ${ink(2.5)}/></g>`;

/** A window at night with the moon in it. */
export const nightWindow = (x, y, w = 180, h = 200) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a3a5e" ${ink(3)}/>
  <circle cx="${x + w * 0.66}" cy="${y + h * 0.3}" r="${w * 0.14}" fill="#f6eec8" ${ink(2)}/>
  <circle cx="${x + w * 0.2}" cy="${y + h * 0.2}" r="2.5" fill="#f6eec8"/><circle cx="${x + w * 0.35}" cy="${y + h * 0.6}" r="2" fill="#f6eec8"/>
  <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#7a6a5a" stroke-width="10"/><path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" ${ink(2)} opacity="0.6"/></g>`;

/** A taxi seen from the side, facing right, wheels on the ground y. faces: [[x, colour of hair], …] in its windows. */
export const taxi = (x, y, k = 1, faces = []) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M-150 -36 L-118 -100 L88 -100 L128 -40 L170 -32 L172 -10 L-172 -10 L-172 -32 Z" fill="#f2c13d" ${ink()}/>
  <path d="M-104 -90 L-80 -48 L-4 -48 L-4 -90 Z M10 -90 L10 -48 L102 -48 L80 -90 Z" fill="#cfe3ea" ${ink(2.5)}/>
  ${faces.map(([fx, hair]) => `<circle cx="${fx}" cy="-64" r="15" fill="${SKIN}" ${ink(2)}/><path d="M${fx - 16} -64 C${fx - 16} -86 ${fx + 16} -86 ${fx + 16} -64 C${fx + 6} -74 ${fx - 6} -74 ${fx - 16} -64 Z" fill="${hair}" ${ink(2)}/>`).join('')}
  <path d="M-150 -36 L-118 -100 L88 -100 L128 -40 L170 -32 L172 -10 L-172 -10 L-172 -32 Z" fill="none" ${ink()}/>
  <path d="M-172 -24 H172" stroke="#2a2a2a" stroke-width="6" opacity="0.5"/>
  <rect x="-22" y="-120" width="44" height="18" rx="4" fill="#3a3a3a" ${ink(2)}/>
  <circle cx="-100" cy="-8" r="30" fill="#3a3a3a" ${ink()}/><circle cx="-100" cy="-8" r="12" fill="#c9cdd2"/><circle cx="104" cy="-8" r="30" fill="#3a3a3a" ${ink()}/><circle cx="104" cy="-8" r="12" fill="#c9cdd2"/></g>`;

/** An airliner, side on, facing right. */
export const plane = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M-150 -20 L-190 -84 L-160 -84 L-110 -24 Z" fill="#c9d6e0" ${ink(2.5)}/>
  <path d="M-200 0 C-200 -30 160 -40 206 -14 C222 -4 206 16 176 16 L-184 16 C-200 16 -200 8 -200 0 Z" fill="#f4f6f8" ${ink(2.5)}/>
  <path d="M-30 6 L-110 70 L-74 70 L40 10 Z" fill="#c9d6e0" ${ink(2.5)}/>
  ${Array.from({ length: 9 }, (_, i) => `<circle cx="${-120 + i * 30}" cy="-8" r="6" fill="#9cc7d9" ${ink(1.5)}/>`).join('')}
  <path d="M176 -12 q14 2 18 10" stroke="#9cc7d9" stroke-width="6" fill="none"/></g>`;

/** A burlap sack, its mouth at the top; something peeking out. */
export const sack = (x, y, k = 1, peek = '') => `<g transform="translate(${x} ${y}) scale(${k})">
  ${peek}
  <path d="M-44 -60 C-62 -20 -60 30 -30 44 C-10 52 14 52 34 44 C62 30 62 -20 44 -60 C24 -50 -24 -50 -44 -60 Z" fill="#cdb48e" ${ink()}/>
  <path d="M-46 -58 C-24 -46 24 -46 46 -58" ${ink(4)} fill="none"/><path d="M-20 0 q10 6 22 2 M-8 22 q12 4 24 -2" stroke="#a88f68" stroke-width="3" fill="none"/></g>`;

/** A hospital: a pale building with a red cross on its sign; ground at y. */
export const hospital = (x, y, w = 380, h = 280) => `<g>
  <rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="10" fill="#f5efe6" ${ink(2.5)}/>
  <rect x="${x - 8}" y="${y - h - 18}" width="${w + 16}" height="30" rx="8" fill="#f29bb8" ${ink(2.5)}/>
  <rect x="${x + w / 2 - 34}" y="${y - h - 96}" width="68" height="68" rx="12" fill="#ffffff" ${ink(2.5)}/>
  <path d="M${x + w / 2} ${y - h - 84} v44 M${x + w / 2 - 22} ${y - h - 62} h44" stroke="#e5533e" stroke-width="14" stroke-linecap="round"/>
  ${[0.15, 0.4, 0.65].map((f) => `<rect x="${x + w * f}" y="${y - h + 50}" width="${w * 0.17}" height="60" rx="6" fill="#cfe3ea" ${ink(2)}/>`).join('')}
  <rect x="${x + w / 2 - 40}" y="${y - 110}" width="80" height="110" rx="6" fill="#9cc7d9" ${ink(2.5)}/><path d="M${x + w / 2} ${y - 110} V${y}" ${ink(2)}/></g>`;

/** A big window wall of an airport hall, from x1 to x2, top at y, with the sky behind. */
export const glassWall = (x1, x2, y, h) => {
  const n = Math.round((x2 - x1) / 200);
  return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" fill="#d7ecf4" ${ink(2.5)}/>` +
    Array.from({ length: n - 1 }, (_, i) => `<path d="M${x1 + ((i + 1) * (x2 - x1)) / n} ${y} V${y + h}" stroke="#8fa3b2" stroke-width="10"/>`).join('') +
    `<path d="M${x1} ${y + h * 0.62} H${x2}" stroke="#8fa3b2" stroke-width="6"/>`;
};

/** A desk seen from the front: top at y, from x1 to x2. */
export const desk = (x1, x2, y, colour = '#7f97b0') => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${H}" fill="${colour}" ${ink(2.5)}/><rect x="${x1 - 8}" y="${y - 12}" width="${x2 - x1 + 16}" height="16" rx="4" fill="#dfe6ec" ${ink(2.5)}/>`;

/** A suitcase standing at ground y. */
export const suitcase = (x, y, colour = '#c48a2c') => `<rect x="${x - 26}" y="${y - 70}" width="52" height="66" rx="8" fill="${colour}" ${ink(2.5)}/><path d="M${x - 12} ${y - 70} v-14 h24 v14" ${ink(3)} fill="none"/><circle cx="${x - 16}" cy="${y - 2}" r="5" fill="#3a3a3a"/><circle cx="${x + 16}" cy="${y - 2}" r="5" fill="#3a3a3a"/>`;

/* ------------------------------------------------------- drawn by hand */

/** A seeded random, so a picture is drawn the same every time it is rendered. */
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/**
 * Coloured-pencil strokes: short lines at one slant, of uneven length, weight
 * and pressure, on a tile big enough that its repeat is not seen.
 */
const hatchTile = (() => {
  const r = seeded(42);
  const T = 180;
  let d = '';
  for (let i = 0; i < 150; i++) {
    const x = r() * T;
    const y = r() * T;
    const len = 18 + r() * 46;
    const a = ((-32 + (r() - 0.5) * 10) * Math.PI) / 180;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    const w = (0.7 + r() * 1.3).toFixed(2);
    const o = (0.25 + r() * 0.6).toFixed(2);
    // Drawn at the tile and its neighbours, so a stroke crossing an edge goes on across it.
    for (const [ox, oy] of [[0, 0], [-T, 0], [T, 0], [0, -T], [0, T]]) {
      d += `<path d="M${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)} q${(dx / 2).toFixed(1)} ${(dy / 2 + (r() - 0.5) * 3).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}" stroke-width="${w}" stroke-opacity="${o}"/>`;
    }
  }
  return `<pattern id="hatch" width="${T}" height="${T}" patternUnits="userSpaceOnUse"><g fill="none" stroke="#3b3430" stroke-linecap="round">${d}</g></pattern>`;
})();

/**
 * The look of a picture drawn by hand: the lines wander a little and tremble,
 * as a pencil's do; colours are a touch softer and lie on grained paper; and
 * where there is colour, pencil strokes show in it, more in the darker parts
 * and none on white paper.
 *
 * The wander is slow — the noise changes over a hundred pixels — so parts that
 * touch move together and a figure never comes apart (the brief's "no
 * displacement on a figure" was about the wash's much larger shift).
 */
const handDefs = `<defs>${hatchTile}
  <filter id="hand" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="3" result="wander"/>
    <feDisplacementMap in="SourceGraphic" in2="wander" scale="7" xChannelSelector="R" yChannelSelector="G" result="d1"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="1" seed="8" result="tremble"/>
    <feDisplacementMap in="d1" in2="tremble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d2"/>
    <feColorMatrix in="d2" type="saturate" values="0.86" result="soft"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.93  0 0 0 0 0.9  0 0 0 0 0.86  0.9 0 0 0 -0.25" result="grainA"/>
    <feComposite in="grainA" in2="soft" operator="in" result="grainIn"/>
    <feBlend in="soft" in2="grainIn" mode="multiply"/>
  </filter>
  <filter id="inked" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="3" result="wander"/>
    <feDisplacementMap in="SourceGraphic" in2="wander" scale="7" xChannelSelector="R" yChannelSelector="G" result="d1"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="1" seed="8" result="tremble"/>
    <feDisplacementMap in="d1" in2="tremble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d2"/>
    <feColorMatrix in="d2" type="matrix" values="-0.75 -0.75 -0.75 0 1.9  -0.75 -0.75 -0.75 0 1.9  -0.75 -0.75 -0.75 0 1.9  0 0 0 1 0"/>
  </filter>
</defs>`;

/** A little larger than the frame, so the wandering lines never pull the paper in at an edge. */
const bleed = (inner) => `<g transform="translate(${W / 2} ${H / 2}) scale(1.025) translate(${-W / 2} ${-H / 2})">${inner}</g>`;

export const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${handDefs}
  <mask id="coloured" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g filter="url(#inked)">${bleed(inner)}</g></mask>
  <rect width="${W}" height="${H}" fill="#fbf8f1"/>
  <g filter="url(#hand)">${bleed(inner)}</g>
  <rect width="${W}" height="${H}" fill="url(#hatch)" mask="url(#coloured)" opacity="0.5" style="mix-blend-mode:multiply"/>
</svg>`;
