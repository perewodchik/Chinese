/**
 * 西游记, chapter 2 — 三星洞石猴学道: eight pictures, one a paragraph, for the
 * easier version and the book's text alike (¶6 has one for each: the book
 * kneels, the retelling sits). Drawn by hand with the kit and the monkeys of
 * chapter 1 (see ../BRIEF.md and ../../../../.claude/skills/add-text/books/xiyouji.md).
 *
 * New here are people: Master Bodhi, his young disciples and a woodcutter,
 * built the kit's way — a skeleton, sleeves from shoulders inside the robe
 * drawn before it, one ink outline, no filter on a figure.
 *
 *   node scripts/texts/art/render.mjs scripts/texts/art/stories/xyj-ch2.mjs <out dir>
 */
import { flowers, grassTufts, H, hills, INK, marks, pine, svg, W } from '../kit.mjs';
import { cave, cloud, HERO, ink, limb, monkey, peachTree, place, shade, shadow, sky, step } from './xyj-ch1.mjs';

/* ---------------------------------------------------------------- people */

const SKIN = '#f3d2ae';
const BONE = { upper: 34, fore: 32 };

/** Arm poses, [left, right] of [upper, forearm], degrees from straight down; and the layer they are in. */
const P_ARMS = {
  rest: { a: [[-12, -4], [12, 4]], layer: 'back' },
  lap: { a: [[-34, 60], [34, -60]], layer: 'front' },
  teach: { a: [[-34, 60], [70, 168]], layer: 'back' },
  point: { a: [[-12, -4], [128, 150]], layer: 'back' },
  strike: { a: [[-12, -4], [150, 118]], layer: 'back' },
  clap: { a: [[-44, 104], [44, -104]], layer: 'front' },
  cheer: { a: [[-150, -170], [150, 170]], layer: 'back' },
  write: { a: [[-30, 74], [26, 84]], layer: 'front' },
  shoulder: { a: [[-12, -4], [40, 178]], layer: 'front' },
  behind: { a: [[-20, -40], [20, 40]], layer: 'hidden' },
  frown: { a: [[-40, 100], [40, -100]], layer: 'front' },
};

/**
 * A person in a long robe. robe, trim: colours; hair: bun (a disciple),
 * bald (the master: a bald crown, a small topknot, white hair at the sides),
 * cap (the woodcutter); beard: a long white beard; legs: stand | sit
 * (cross-legged) | kneel; face: smile | happy | stern | worried | open;
 * hold: something drawn at the right hand (a function of its x, y).
 */
export function person({ x, y, s = 1, flip = false, robe = '#7d9cc4', trim = '#f4efe2', hair = 'bun', beard = false, legs = 'stand', arms = 'rest', lean = 0, face = 'smile', look = 'front', hold = null, shadowless = false }) {
  const A = P_ARMS[arms];
  // The shoulders' height, and the robe from them down, by how the person is placed.
  const top = legs === 'stand' ? -150 : legs === 'kneel' ? -118 : -104;
  const shoulders = [[-24, top + 8], [24, top + 8]];
  const armPts = A.a.map(([u, f], i) => { const el = step(shoulders[i], u, BONE.upper); return [shoulders[i], el, step(el, f, BONE.fore)]; });
  const hand = (h) => `<circle cx="${h[0]}" cy="${h[1]}" r="9" fill="${SKIN}" ${ink(2.5)}/>`;
  const sleeve = ([sh, el, h]) => limb([sh, el], 18, robe) + limb([el, h], 16, robe) + `<path d="M${h[0] - 9} ${h[1] - 4} q9 6 18 0" stroke="${trim}" stroke-width="4" fill="none"/>` + hand(h);
  const armsIn = (layer) => (A.layer === layer ? armPts.map(sleeve).join('') : '');
  const held = hold ? hold(armPts[1][2][0], armPts[1][2][1]) : '';

  let body;
  if (legs === 'stand') {
    body = `<path d="M-26 ${top} C-40 ${top + 50} -46 -40 -48 -6 L48 -6 C46 -40 40 ${top + 50} 26 ${top} Q0 ${top - 10} -26 ${top} Z" fill="${robe}" ${ink()}/>
      <path d="M-48 -6 L48 -6" stroke="${trim}" stroke-width="6"/>
      <ellipse cx="-16" cy="-2" rx="14" ry="6" fill="#4a3c34" ${ink(2)}/><ellipse cx="16" cy="-2" rx="14" ry="6" fill="#4a3c34" ${ink(2)}/>`;
  } else if (legs === 'kneel') {
    body = `<path d="M-60 -2 C-64 -30 -40 -40 -20 -40 L40 -40 C64 -40 70 -14 64 -2 Z" fill="${shade(robe, -0.08)}" ${ink()}/>
      <path d="M-26 ${top} C-38 ${top + 40} -40 -50 -36 -30 L36 -30 C40 -50 38 ${top + 40} 26 ${top} Q0 ${top - 10} -26 ${top} Z" fill="${robe}" ${ink()}/>`;
  } else {
    body = `<path d="M-76 -2 C-80 -28 -50 -36 0 -36 C50 -36 80 -28 76 -2 Z" fill="${shade(robe, -0.08)}" ${ink()}/>
      <path d="M-26 ${top} C-38 ${top + 34} -42 -48 -36 -28 L36 -28 C42 -48 38 ${top + 34} 26 ${top} Q0 ${top - 10} -26 ${top} Z" fill="${robe}" ${ink()}/>`;
  }
  // The collar crossed left over right, and a sash.
  const collar = `<path d="M-14 ${top - 4} L8 ${top + 34} M14 ${top - 4} L0 ${top + 22}" stroke="${trim}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M-34 ${top + 58} Q0 ${top + 66} 34 ${top + 58}" stroke="${shade(robe, -0.3)}" stroke-width="9" fill="none" stroke-linecap="round"/>`;

  const hy = top - 36; // head centre
  const ox = look === 'left' ? -3 : look === 'right' ? 3 : 0;
  const oy = look === 'up' ? -4 : look === 'down' ? 3 : 0;
  const eye = (ex) =>
    face === 'happy'
      ? `<path d="M${ex - 6} ${hy} q6 -7 12 0" ${ink(3)} fill="none"/>`
      : `<ellipse cx="${ex + ox}" cy="${hy + oy}" rx="4.2" ry="5.6" fill="${INK}"/><circle cx="${ex + ox + 1.5}" cy="${hy - 2 + oy}" r="1.6" fill="#fff"/>`;
  const browColour = hair === 'bald' ? '#fffaf0' : INK;
  const brows = {
    stern: `<path d="M-20 ${hy - 12} l12 5 M20 ${hy - 12} l-12 5" stroke="${browColour}" stroke-width="${hair === 'bald' ? 6 : 3.5}" stroke-linecap="round"/>`,
    worried: `<path d="M-20 ${hy - 9} l12 -5 M20 ${hy - 9} l-12 -5" stroke="${browColour}" stroke-width="${hair === 'bald' ? 6 : 3}" stroke-linecap="round"/>`,
  }[face] ?? (hair === 'bald' ? `<path d="M-22 ${hy - 10} q8 -8 15 -2 M22 ${hy - 10} q-8 -8 -15 -2" stroke="#fffaf0" stroke-width="6" fill="none" stroke-linecap="round"/>` : '');
  const mouth = {
    smile: `<path d="M-7 ${hy + 14} q7 6 14 0" ${ink(2.5)} fill="none"/>`,
    happy: `<path d="M-9 ${hy + 12} q9 13 18 0 Z" fill="#a8423a" ${ink(2.5)}/>`,
    open: `<ellipse cx="0" cy="${hy + 15}" rx="6" ry="7" fill="#a8423a" ${ink(2.5)}/>`,
    stern: `<path d="M-8 ${hy + 16} h16" ${ink(3)}/>`,
    worried: `<path d="M-7 ${hy + 17} q7 -6 14 0" ${ink(2.5)} fill="none"/>`,
  }[face];
  const hairBack = {
    bun: `<circle cx="0" cy="${hy - 36}" r="13" fill="#3a302c" ${ink(2.5)}/>`,
    bald: `<circle cx="0" cy="${hy - 34}" r="8" fill="#fffaf0" ${ink(2.5)}/>`,
    cap: '',
  }[hair];
  const hairFront = {
    bun: `<path d="M-30 ${hy - 2} C-32 ${hy - 34} 32 ${hy - 34} 30 ${hy - 2} C22 ${hy - 20} -22 ${hy - 20} -30 ${hy - 2} Z" fill="#3a302c" ${ink(2.5)}/>`,
    bald: `<path d="M-31 ${hy + 4} q-6 -14 2 -24 M31 ${hy + 4} q6 -14 -2 -24" stroke="#fffaf0" stroke-width="9" fill="none" stroke-linecap="round"/>`,
    cap: `<path d="M-34 ${hy - 6} C-30 ${hy - 40} 30 ${hy - 40} 34 ${hy - 6} Z" fill="#8a7a5a" ${ink(2.5)}/>`,
  }[hair];
  const beardSvg = beard
    ? `<path d="M-20 ${hy + 10} C-24 ${hy + 50} -8 ${hy + 86} 0 ${hy + 96} C8 ${hy + 86} 24 ${hy + 50} 20 ${hy + 10} C12 ${hy + 24} -12 ${hy + 24} -20 ${hy + 10} Z" fill="#fffaf0" ${ink(2.5)}/>
       <path d="M-14 ${hy + 9} q14 -8 28 0" stroke="#fffaf0" stroke-width="7" fill="none" stroke-linecap="round"/>`
    : '';
  const head = `${hairBack}
    <circle cx="0" cy="${hy}" r="31" fill="${SKIN}" ${ink()}/>
    ${hairFront}
    ${eye(-11)}${eye(11)}${brows}
    <circle cx="-19" cy="${hy + 9}" r="5" fill="#e89a86" opacity="0.55"/><circle cx="19" cy="${hy + 9}" r="5" fill="#e89a86" opacity="0.55"/>
    ${beard ? '' : mouth}
    ${beardSvg}
    ${beard ? `<path d="M-6 ${hy + 13} q6 ${face === 'stern' ? 0 : 4} 12 0" ${ink(2.5)} fill="none"/>` : ''}`;
  const upper = `${armsIn('back')}${body}${collar}${armsIn('front')}${head}${held}`;
  return place(x, y, s, flip, `${shadowless ? '' : shadow(legs === 'stand' ? 44 : 70)}<g transform="rotate(${lean} 0 0)">${upper}</g>`);
}

/** Where a person's right hand is in the picture. */
export function personHand({ x, y, s = 1, flip = false, legs = 'stand', arms = 'rest' }) {
  const top = legs === 'stand' ? -150 : legs === 'kneel' ? -118 : -104;
  const [u, f] = P_ARMS[arms].a[1];
  const h = step(step([24, top + 8], u, BONE.upper), f, BONE.fore);
  return [x + (flip ? -h[0] : h[0]) * s, y + h[1] * s];
}

/* ------------------------------------------------------------- the props */

const DISCIPLE = '#9aa3ad'; // Wukong's grey disciple's robe
const ROBES = ['#8fb3a3', '#c9a77a', '#a7a3c9']; // the other disciples
const MASTER = '#f1ead8'; // the master's pale robe
const MASTER_TRIM = '#c9443a';

/** A teacher's ruler held in the hand, pointing up and out. */
const ruler = (hx, hy) => `<path d="M${hx - 4} ${hy + 6} L${hx + 44} ${hy - 70}" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M${hx - 4} ${hy + 6} L${hx + 44} ${hy - 70}" stroke="#c99a5a" stroke-width="8" stroke-linecap="round"/>`;
/** A brush held for writing, tip down to the paper. */
const brush = (hx, hy) => `<path d="M${hx} ${hy - 30} L${hx + 4} ${hy + 18}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${hx} ${hy - 30} L${hx + 4} ${hy + 18}" stroke="#a07a52" stroke-width="3" stroke-linecap="round"/><path d="M${hx + 1} ${hy + 14} q2 10 4 14 q4 -6 2 -14 Z" fill="${INK}"/>`;
/** A bundle of firewood carried on the shoulder, tied in the middle. */
const firewood = (x, y) => `<g transform="translate(${x} ${y}) rotate(-12)">${[-12, -4, 4, 12].map((dy) => `<rect x="-70" y="${dy - 4}" width="140" height="9" rx="4" fill="#a07a52" ${ink(2)}/>`).join('')}<path d="M-8 -18 v34 M8 -18 v34" stroke="#6f5638" stroke-width="5"/></g>`;
/** A low writing table with paper on it. */
const lowTable = (x, y, w = 160) => `<rect x="${x - w / 2}" y="${y - 26}" width="${w}" height="12" rx="3" fill="#a07a52" ${ink(2.5)}/><path d="M${x - w / 2 + 14} ${y - 14} v14 M${x + w / 2 - 14} ${y - 14} v14" ${ink(5)}/><rect x="${x - w / 4}" y="${y - 32}" width="${w / 2}" height="8" fill="#fbf6e8" ${ink(1.5)}/>`;
/** An incense burner on its legs, smoke curling up. */
const incense = (x, y) => `<path d="M${x - 26} ${y - 30} C${x - 26} ${y} ${x + 26} ${y} ${x + 26} ${y - 30} Z" fill="#b08a4a" ${ink(2.5)}/><path d="M${x - 30} ${y - 32} h60" ${ink(4)}/><path d="M${x - 16} ${y - 6} l-6 10 M${x + 16} ${y - 6} l6 10" ${ink(4)}/>
  <path d="M${x - 4} ${y - 34} c-14 -20 14 -30 0 -52 c-12 -18 10 -26 2 -46" stroke="#e8e4dc" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.9"/><path d="M${x + 6} ${y - 34} c10 -16 -8 -26 4 -42" stroke="#e8e4dc" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
/** A raised stone platform, the master's seat for teaching. */
const platform = (x, y, w = 300) => `<path d="M${x - w / 2} ${y} L${x - w / 2 + 20} ${y - 70} L${x + w / 2 - 20} ${y - 70} L${x + w / 2} ${y} Z" fill="#a8a294" ${ink(2.5)}/><path d="M${x - w / 2 + 26} ${y - 56} h${w - 52}" stroke="#c6c0b2" stroke-width="6" stroke-linecap="round"/>
  <rect x="${x - 70}" y="${y - 86}" width="140" height="18" rx="8" fill="#c9443a" ${ink(2.5)}/>`;
/** A wooden raft of lashed logs, its top at y. */
const raft = (x, y, w = 260) => `<path d="M${x - w / 2} ${y} h${w} l-10 26 h${-w + 20} Z" fill="#a07a52" ${ink(2.5)}/>${Array.from({ length: Math.floor(w / 30) }, (_, i) => `<path d="M${x - w / 2 + 14 + i * 30} ${y + 2} v22" stroke="#7f5e3e" stroke-width="3"/>`).join('')}<path d="M${x - w / 2 + 40} ${y + 4} v20 M${x + w / 2 - 40} ${y + 4} v20" stroke="#6f9f5c" stroke-width="6"/>`;
/** The somersault cloud: a swirl of white puffs with a curling tail. */
const nimbus = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M90 10 C150 14 190 -10 230 6 C200 10 170 34 120 30" fill="#ffffff" ${ink(2.5)}/>
  <path d="M-110 10 q-14 -30 20 -34 q14 -28 50 -16 q24 -24 58 0 q34 -14 52 14 q30 4 22 34 q-20 18 -50 10 q-30 16 -62 4 q-40 14 -66 -4 q-30 4 -24 -8 Z" fill="#ffffff" ${ink(2.5)}/>
  <path d="M-70 4 q20 -14 40 -2 M10 -6 q20 -12 40 0" stroke="#e4e9f2" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
/** A rocky mountain with a cave mouth, far up a path. */
const caveMountain = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
  <path d="M-220 0 C-200 -160 -120 -300 -20 -330 C80 -310 170 -170 220 0 Z" fill="#a9ab92" ${ink(2.5)}/>
  <path d="M-150 -120 q40 -20 70 8 M60 -200 q30 -16 60 8 M90 -80 q40 -14 70 10" stroke="#c4c6ae" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M-30 -210 C-30 -250 30 -250 30 -210 Z" fill="#4a4440" ${ink(2.5)}/>
  <path d="M-36 -210 h72" ${ink(3)}/>
  <path d="M-8 -206 C-40 -160 40 -120 -20 -60 C-50 -30 10 -10 -10 0" stroke="#e8dcc2" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.9"/></g>`;
const bedOf = (x, y, w = 300) => `<rect x="${x - w / 2}" y="${y - 60}" width="${w}" height="60" rx="6" fill="#a07a52" ${ink(2.5)}/><rect x="${x - w / 2 - 6}" y="${y - 76}" width="${w + 12}" height="20" rx="6" fill="#f4efe2" ${ink(2.5)}/><path d="M${x - w / 2 + 10} ${y} v14 M${x + w / 2 - 10} ${y} v14" ${ink(6)}/>`;
const lamp = (x, y) => `<ellipse cx="${x}" cy="${y - 60}" rx="120" ry="110" fill="#ffd98a" opacity="0.55" filter="url(#blur18)"/><rect x="${x - 6}" y="${y - 40}" width="12" height="40" fill="#8a6a4a" ${ink(2)}/><path d="M${x - 22} ${y - 40} h44 l-6 -10 h-32 Z" fill="#b08a4a" ${ink(2)}/><path d="M${x} ${y - 50} q-8 -14 0 -26 q8 12 0 26 Z" fill="#ffcc4a" ${ink(1.8)}/>`;

/* ---------------------------------------------------------------- scenes */

/** ¶1 Alone on a raft, down a river between misty mountains, towards the west. */
const s1 = svg(`${sky('#f3d9c0', '#fbf0dc', [180, 160])}
  ${hills(330, '#d9d2c6', 40, 5)}${hills(400, '#c3cdb8', 34, 2)}
  <path d="M0 470 C200 440 360 420 520 430 C700 440 860 420 1024 430 L1024 768 L0 768 Z" fill="#9fc8dc" filter="url(#wash)"/>
  ${[[80, 520, 90], [320, 580, 120], [640, 520, 80], [820, 600, 110], [200, 680, 100], [560, 690, 120]].map(([x, y, w]) => `<path d="M${x} ${y} q${w / 4} -8 ${w / 2} 0 t${w / 2} 0" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>`).join('')}
  <path d="M0 470 C80 430 160 420 230 440 C260 470 250 520 200 560 C120 560 40 540 0 560 Z" fill="#8fb47a" ${ink(2.5)}/>
  <path d="M1024 440 C940 420 860 430 820 460 C800 500 840 540 900 550 C960 540 1000 520 1024 530 Z" fill="#8fb47a" ${ink(2.5)}/>
  ${pine(110, 470, 150, '#6f9f68')}${pine(190, 480, 110, '#7fae7a')}${pine(900, 470, 140, '#6f9f68')}
  ${raft(520, 600, 250)}
  <path d="M400 640 q40 -10 80 0 t80 0 t80 0" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${monkey({ x: 520, y: 600, s: 1.05, fur: HERO, hero: true, arms: 'shade', face: 'determined', look: 'left', shadowless: true, flip: true })}`);

/** ¶2 On the mountain path, the woodcutter with his firewood points up to the cave; the monkey bows. */
// He faces the monkey and points back over his shoulder, up to the cave; the firewood rides across his back.
const woodcutter = { x: 600, y: 650, s: 1.05, robe: '#b9a27a', trim: '#e8dcc2', hair: 'cap', arms: 'point', face: 'smile', look: 'left' };
const s2 = svg(`${sky('#cfe3ea', '#f3f0de')}
  ${hills(420, '#c6d8c2', 30, 4)}
  ${caveMountain(780, 520, 0.9)}
  ${pine(120, 600, 260, '#6f9f68')}${pine(230, 640, 200, '#7fae7a')}${pine(960, 620, 220, '#6f9f68')}
  <path d="M0 768 L0 610 C200 590 420 640 600 630 C760 620 900 600 1024 610 L1024 768 Z" fill="#9cc27f" ${ink(2.5)}/>
  <path d="M300 768 C380 700 520 660 640 646 C720 640 780 630 820 620" stroke="#e8dcc2" stroke-width="40" fill="none" stroke-linecap="round" filter="url(#wash)"/>
  ${firewood(woodcutter.x + 6, woodcutter.y - 136 * woodcutter.s)}
  ${person(woodcutter)}
  ${monkey({ x: 420, y: 690, s: 1.0, fur: HERO, hero: true, arms: 'bow', lean: 16, face: 'smile', look: 'right' })}
  ${flowers([[80, 700, '#f2a6b4'], [500, 740, '#f6f0e8'], [900, 700, '#f2a6b4']])}${grassTufts([[60, 660], [260, 700], [860, 680], [990, 650]])}`);

/** ¶3 The cave school: Wukong in his grey robe writing at a low table among the disciples; incense. */
const s3 = svg(`${cave('#8a7660', '#b39c80')}
  <ellipse cx="520" cy="380" rx="420" ry="260" fill="#fff0c8" opacity="0.5" filter="url(#blur18)"/>
  <path d="M0 768 L0 540 C300 520 700 520 1024 540 L1024 768 Z" fill="#c8b48e" ${ink(2.5)}/>
  ${incense(965, 600)}
  ${person({ x: 220, y: 640, s: 0.95, robe: ROBES[0], legs: 'sit', arms: 'write', face: 'smile', look: 'down', hold: brush })}
  ${lowTable(220, 690, 170)}
  ${monkey({ x: 520, y: 650, s: 1.0, fur: HERO, hero: true, robe: DISCIPLE, legs: 'sit', arms: 'write', face: 'smile', look: 'down' })}
  ${lowTable(520, 700, 180)}
  ${brush(536, 640)}
  ${person({ x: 790, y: 660, s: 0.95, robe: ROBES[1], legs: 'sit', arms: 'lap', face: 'smile', look: 'left', flip: true })}
  ${lowTable(790, 712, 170)}`);

/** ¶4 The master teaches from the platform; Wukong jumps for joy; the disciples stare. */
const s4 = svg(`${cave('#8a7660', '#b39c80')}
  <ellipse cx="520" cy="330" rx="380" ry="240" fill="#fff0c8" opacity="0.55" filter="url(#blur18)"/>
  <path d="M0 768 L0 560 C300 540 700 540 1024 560 L1024 768 Z" fill="#c8b48e" ${ink(2.5)}/>
  ${platform(520, 470, 320)}
  ${person({ x: 520, y: 384, s: 1.0, robe: MASTER, trim: MASTER_TRIM, hair: 'bald', beard: true, legs: 'sit', arms: 'teach', face: 'smile' })}
  ${incense(300, 470)}
  ${person({ x: 170, y: 700, s: 0.9, robe: ROBES[0], legs: 'sit', arms: 'lap', face: 'open', look: 'right' })}
  ${person({ x: 860, y: 700, s: 0.9, robe: ROBES[2], legs: 'sit', arms: 'lap', face: 'open', look: 'left', flip: true })}
  ${monkey({ x: 520, y: 720, s: 1.0, fur: HERO, hero: true, robe: DISCIPLE, legs: 'jump', arms: 'cheer', face: 'happy', look: 'up' })}
  ${marks.star(420, 560, 10, '#fff2a8')}${marks.star(630, 540, 12, '#fff2a8')}${marks.speed(410, 640, 2, 30)}`);

/** ¶5 The master, stern, raps Wukong's head with his ruler; Wukong holds his head; the disciples are dismayed. */
const masterStrike = { x: 600, y: 680, s: 1.05, robe: MASTER, trim: MASTER_TRIM, hair: 'bald', beard: true, arms: 'strike', face: 'stern', look: 'left', flip: true, hold: ruler };
const s5 = svg(`${cave('#8a7660', '#b39c80')}
  <path d="M760 520 L760 300 C760 250 900 250 900 300 L900 520 Z" fill="#5a4a3c" ${ink(2.5)}/><path d="M830 300 V520" ${ink(3)}/>
  <ellipse cx="480" cy="360" rx="360" ry="220" fill="#fff0c8" opacity="0.4" filter="url(#blur18)"/>
  <path d="M0 768 L0 560 C300 540 700 540 1024 560 L1024 768 Z" fill="#c8b48e" ${ink(2.5)}/>
  ${person(masterStrike)}
  ${monkey({ x: 430, y: 700, s: 1.0, fur: HERO, hero: true, robe: DISCIPLE, arms: 'head', face: 'shut', look: 'right' })}
  ${marks.bump(420, 470)}${marks.star(470, 450, 9, '#fff2a8')}${marks.star(390, 455, 7, '#fff2a8')}
  ${person({ x: 170, y: 720, s: 0.88, robe: ROBES[0], arms: 'frown', face: 'worried', look: 'right' })}
  ${person({ x: 880, y: 730, s: 0.85, robe: ROBES[1], arms: 'frown', face: 'worried', look: 'left', flip: true })}`);

/** ¶6 Midnight, by one lamp: the master wakes and smiles; Wukong waits by the bed (kneeling in the book, sitting in the retelling). */
const night = (wukong) => svg(`<rect width="${W}" height="${H}" fill="#2c3550"/>
  <path d="M0 0 H${W} V160 C820 120 640 100 512 104 C380 108 200 130 0 170 Z" fill="#232a40"/>
  <rect x="80" y="110" width="170" height="190" fill="#1d2338" ${ink(3)}/><circle cx="190" cy="170" r="26" fill="#f4ecc8"/>${marks.star(120, 150, 6, '#f4ecc8')}${marks.star(220, 250, 5, '#f4ecc8')}
  <path d="M0 768 L0 560 C300 540 700 540 1024 560 L1024 768 Z" fill="#4a4a5a" ${ink(2.5)}/>
  ${lamp(860, 600)}
  ${bedOf(560, 600, 340)}
  ${person({ x: 610, y: 548, s: 0.95, robe: MASTER, trim: MASTER_TRIM, hair: 'bald', beard: true, legs: 'sit', arms: 'lap', face: 'smile', look: 'left', shadowless: true })}
  <path d="M470 540 C500 500 720 500 740 540 L740 552 L470 552 Z" fill="#8fa8c8" ${ink(2.5)}/>
  ${wukong}`);
const s6Book = night(monkey({ x: 300, y: 690, s: 1.0, fur: HERO, hero: true, robe: DISCIPLE, legs: 'kneel', arms: 'bow', lean: 10, face: 'smile', look: 'right' }));
const s6Easy = night(monkey({ x: 300, y: 690, s: 1.0, fur: HERO, hero: true, robe: DISCIPLE, legs: 'sit', arms: 'lap', face: 'smile', look: 'right' }));

/** ¶7 Under the pines, Wukong turns into a pine tree in a puff of smoke; the disciples clap and cheer. */
const s7 = svg(`${sky('#cfe6e6', '#f4f1de')}
  ${hills(420, '#c9dcc0', 28, 6)}
  <path d="M0 768 L0 560 C260 540 520 560 760 550 C880 546 960 552 1024 556 L1024 768 Z" fill="#c9b994" ${ink(2.5)}/>
  ${pine(90, 600, 260, '#6f9f68')}${pine(950, 590, 250, '#6f9f68')}
  <path d="M400 610 q-60 -10 -50 -60 q-40 -40 10 -70 q0 -50 60 -50 q30 -40 80 -10 q50 -20 70 30 q50 10 30 60 q30 40 -20 70 q-10 40 -70 30 q-40 20 -110 0 Z" fill="#f2efe8" ${ink(2.5)} opacity="0.95"/>
  ${pine(500, 640, 330, '#5f9058')}
  <path d="M560 600 C600 590 610 560 590 540" stroke="${INK}" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M560 600 C600 590 610 560 590 540" stroke="${HERO}" stroke-width="9" fill="none" stroke-linecap="round"/>
  ${marks.star(380, 380, 12, '#fff2a8')}${marks.star(640, 360, 10, '#fff2a8')}${marks.star(660, 470, 8, '#fff2a8')}
  ${person({ x: 180, y: 720, s: 0.9, robe: ROBES[0], arms: 'clap', face: 'happy', look: 'right' })}
  ${person({ x: 800, y: 720, s: 0.9, robe: ROBES[1], arms: 'cheer', face: 'happy', look: 'left', flip: true })}
  ${person({ x: 920, y: 740, s: 0.82, robe: ROBES[2], arms: 'clap', face: 'happy', look: 'left', flip: true })}
  ${grassTufts([[60, 740], [300, 750], [700, 744], [1000, 730]], '#a3a46a')}`);

/** ¶8 Sunset: tears in his eyes, Wukong rides the somersault cloud away to the Mountain of Flowers and Fruit. */
const s8 = svg(`${sky('#f4c9a8', '#fbe9d2', [860, 380])}
  <circle cx="860" cy="420" r="70" fill="#f7a65a" opacity="0.85"/>
  ${cloud(200, 140, 0.7, '#fff3e6')}${cloud(560, 90, 0.55, '#fff3e6')}
  ${hills(560, '#d7c7c0', 30, 8)}
  <path d="M640 620 C690 520 760 470 820 468 C880 470 950 520 1000 620 Z" fill="#8fbf74" ${ink(2.5)}/>
  ${peachTree(780, 560, 90)}${peachTree(880, 570, 80)}
  ${flowers([[740, 600, '#f2a6b4'], [820, 590, '#f6f0e8'], [930, 600, '#f6d24a']])}
  <path d="M0 768 L0 600 C80 560 180 520 260 540 C320 560 360 640 380 768 Z" fill="#a9ab92" ${ink(2.5)}/>
  ${pine(150, 600, 160, '#6f9f68')}
  ${nimbus(440, 400, 1.1)}
  <path d="M300 420 q-60 6 -120 -10 M300 450 q-50 10 -100 0" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>
  ${monkey({ x: 440, y: 404, s: 0.95, fur: HERO, hero: true, robe: DISCIPLE, arms: 'rest', face: 'worried', look: 'right', tear: true, shadowless: true })}`);

export const pictures = [
  { name: 'p1', svg: s1 },
  { name: 'p2', svg: s2 },
  { name: 'p3', svg: s3 },
  { name: 'p4', svg: s4 },
  { name: 'p5', svg: s5 },
  { name: 'p6-book', svg: s6Book },
  { name: 'p6-easy', svg: s6Easy },
  { name: 'p7', svg: s7 },
  { name: 'p8', svg: s8 },
];
