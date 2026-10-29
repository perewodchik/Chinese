/**
 * 皮卡丘饿了, chapters 4 (生病的皮卡丘), 5 (坏人和出租车) and 6 (在机场), drawn by
 * hand with the kit (see ../BRIEF.md). Where a hand holds something, the
 * thing is put where `handOf` says the hand is.
 */
import {
  ash, bed, blanket, bolt, chair, desk, figure, glassWall, grassTufts, handOf, hills, hospital, marks, nightWindow, pikachu,
  plane, room, sack, shopFront, sky, suitcase, svg, taxi, tree, INK, W, H,
} from '../kit.mjs';

const road = (y) => `<rect y="${y}" width="${W}" height="${H - y}" fill="#cfc8bd"/><path d="M0 ${y} H${W}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M0 ${y + 90} H${W}" stroke="#ffffff" stroke-width="8" stroke-dasharray="60 44"/>`;

/** Pikachu asleep on its back in a bed, its head on the pillow at (hx, hy). */
const inBed = (hx, hy, s = 0.8) => pikachu({ x: hx + 40 * s, y: hy + 60 * s, s, mood: 'sleep', tilt: -90, shadowless: true });

/** The dark of the hospital room at night: the window, the moonlight, the bed, Ash asleep in his chair. */
const nightRoom = (extra = '') => `${room('#34405e', '#2a3350', '#3d4966', 590)}
  ${nightWindow(420, 110)}
  <path d="M420 310 L300 ${H} L780 ${H} L600 310 Z" fill="#f6eec8" opacity="0.08"/>
  ${bed(600, 680, 340, '#cfd6e6', '#7d6a58')}
  ${inBed(660, 568)}
  ${blanket(700, 940, 584, '#7f9cc0', 0.2)}
  ${extra}`;

const sleeper = `${chair(250, 700)}${ash({ x: 250, y: 700, s: 1.0, legs: 'chair', arms: 'restLap', face: 'sleep' })}`;

/* ------------------------------------------------------------ chapter 4 */

/** ¶1 Morning: Pikachu will not get up; Ash puts a hand on the blanket, worried. */
// His hand rests on the blanket: the arm angled down to it, and Ash stood where that arm reaches.
const bedside = { y: 716, s: 1.15, flip: true, arms: { a: [[-12, -6], [58, 64]], layer: 'back' }, face: 'worried' };
const ashBedside = { ...bedside, x: 548 - handOf('ash', { ...bedside, x: 0 }, 1)[0] };
const c4p1 = svg(`${room('#f3ead9', '#e5c9a8', '#d9c6aa', 590)}
  <rect x="640" y="90" width="260" height="220" fill="#d9eef5" stroke="${INK}" stroke-width="3"/>
  <path d="M770 90 V310 M640 200 H900" stroke="#ffffff" stroke-width="8"/>
  <path d="M624 80 C640 150 650 250 626 330 L600 330 L600 80 Z M916 80 C900 150 890 250 914 330 L940 330 L940 80 Z" fill="#e7b9a0" stroke="${INK}" stroke-width="2.5"/>
  ${bed(150, 680, 420)}
  ${inBed(206, 568)}
  ${blanket(250, 570, 584, '#8fb4d9', 0.15)}
  ${marks.zzz(250, 470, 0.9)}
  ${ash(ashBedside)}
  ${marks.sweat(626, 470)}`);

/** ¶2 Ash runs to the Pokémon hospital with Pikachu asleep in his arms. */
const c4p2 = svg(`${sky('#d6eaf2', '#f2f1e2')}
  ${hills(470, '#cfe0c6', 18, 2)}
  ${hospital(560, 540, 380, 270)}
  ${hills(560, '#b9d59c', 8, 4)}
  <path d="M0 690 C220 650 420 620 750 548 L790 548 C480 650 300 700 0 740 Z" fill="#e8d6ac"/>
  ${grassTufts([[80, 640], [480, 720], [900, 640]])}
  ${ash({ x: 330, y: 708, s: 1.15, legs: 'run', arms: 'cradle', face: 'determined', inArms: pikachu({ x: 0, y: -66, s: 0.52, mood: 'sleep', shadowless: true }) })}
  ${marks.speed(220, 520, 3, 56)}${marks.sweat(380, 420)}`);

/** ¶3 The doctor laughs: Pikachu is not ill, only full of cake; Ash scratches his head. */
const c4p3 = svg(`${room('#eef4f2', '#9fcbe0', '#d8e2dc', 590)}
  <rect x="80" y="150" width="150" height="110" rx="8" fill="#ffffff" stroke="${INK}" stroke-width="2.5"/><path d="M155 170 v70 M120 205 h70" stroke="#e5533e" stroke-width="12" stroke-linecap="round"/>
  <rect x="360" y="520" width="300" height="34" rx="10" fill="#ffffff" stroke="${INK}" stroke-width="2.5"/>
  <path d="M380 554 V650 M640 554 V650" stroke="${INK}" stroke-width="12"/><path d="M380 554 V650 M640 554 V650" stroke="#9aa8a2" stroke-width="7"/>
  ${pikachu({ x: 510, y: 524, s: 1.0, mood: 'full', arms: 'belly', shadowless: true })}
  ${figure('doctor', { x: 790, y: 716, s: 1.08, arms: 'hips', face: 'laugh' })}
  ${ash({ x: 210, y: 716, s: 1.12, arms: 'scratch', face: 'smile' })}
  ${marks.sweat(272, 430)}`);

/** ¶4 Night at the hospital: Pikachu in bed, Ash asleep in a chair. */
const c4p4 = svg(nightRoom(`${sleeper}${marks.zzz(330, 430, 0.9)}${marks.zzz(720, 470, 0.8)}`));

/** ¶5 The door opens a crack; two long shadows fall across the floor. */
const shadows = `<g fill="#1a2236" opacity="0.75">
  <path d="M150 620 L520 690 L534 664 L172 604 Z"/><ellipse cx="560" cy="680" rx="34" ry="18"/><path d="M560 664 C600 650 640 690 600 708 Z"/>
  <path d="M164 650 L470 740 L486 712 L186 636 Z"/><ellipse cx="510" cy="730" rx="30" ry="16"/></g>`;
const c5door = `${room('#2e3954', '#262f48', '#384461', 590)}
  <rect x="40" y="200" width="150" height="390" fill="#1f2840" stroke="${INK}" stroke-width="3"/>
  <path d="M190 200 L238 222 L238 590 L190 590 Z" fill="#f6e7b8" stroke="${INK}" stroke-width="2"/>
  <path d="M190 590 L1024 760 L1024 768 L190 768 Z" fill="#f6e7b8" opacity="0.2"/>
  <path d="M238 590 L1024 700 L1024 768 L238 768 Z" fill="#f6e7b8" opacity="0.12"/>
  ${shadows}
  ${bed(640, 680, 320, '#cfd6e6', '#7d6a58')}${inBed(700, 568)}${blanket(740, 960, 584, '#6f8cb0', 0.2)}
  ${chair(420, 640)}${ash({ x: 420, y: 640, s: 0.85, legs: 'chair', arms: 'restLap', face: 'sleep' })}`;
const c4p5 = svg(c5door);

/* ------------------------------------------------------------ chapter 5 */

/** ¶1 Two bad guys in white coats tiptoe off with Pikachu in a sack; Ash sleeps on. */
const jes1 = { x: 640, y: 716, s: 1.05, legs: 'walk', arms: 'carry', face: 'sly' };
const [sx1, sy1] = handOf('jessie', jes1, 1);
const c5p1 = svg(`${room('#34405e', '#2a3350', '#3d4966', 590)}
  ${nightWindow(760, 110, 160, 180)}
  ${sleeper}${marks.zzz(330, 430, 0.9)}
  ${sack(sx1 + 30, sy1 + 52, 0.8, pikachu({ x: 0, y: -10, s: 0.62, mood: 'sleep', shadowless: true }))}
  ${figure('jessie', jes1)}
  ${figure('james', { x: 820, y: 716, s: 1.0, legs: 'walk', arms: 'sneak', face: 'sly' })}
  <path d="M560 740 h22 M700 744 h22 M790 744 h22" stroke="#f6eec8" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`);

/** ¶2 Dawn: the bad guys drive off in a taxi; Ash runs after it, shouting. */
const c5p2 = svg(`${sky('#f6d6c0', '#fbeedd')}
  <circle cx="150" cy="380" r="70" fill="#f6b46a" opacity="0.7" filter="url(#blur6)"/>
  ${hospital(30, 560, 300, 230)}
  ${road(560)}
  ${taxi(700, 680, 1.15, [[-48, '#c2477e'], [52, '#a99be0']])}
  ${marks.speed(930, 560, 3, -50)}
  ${ash({ x: 280, y: 720, s: 1.1, legs: 'run', arms: { a: [[-36, 44], [96, 92]], layer: 'back' }, face: 'shock' })}`);

/** ¶3 Sparks from the sack stop the taxi by the airport; the bad guys run for it, hair on end. */
const jes3 = { x: 650, y: 716, s: 1.0, legs: 'run', arms: 'carry', face: 'shock', hair: true };
const [sx3, sy3] = handOf('jessie', jes3, 1);
const c5p3 = svg(`${sky('#d6eaf2', '#f2f1e2')}
  <rect x="640" y="250" width="384" height="320" fill="#e8eef2" stroke="${INK}" stroke-width="2.5"/>
  ${glassWall(660, 1010, 300, 200)}
  ${plane(820, 170, 0.5)}
  ${road(570)}
  ${ash({ x: 70, y: 660, s: 0.72, legs: 'run', arms: 'run', face: 'determined' })}
  ${taxi(330, 700, 1.0)}
  ${bolt(220, 590, 1)}${bolt(330, 580, -1)}
  ${sack(sx3 + 30, sy3 + 52, 0.8)}
  ${bolt(sx3 + 8, sy3 + 30, 1, 0.8)}${bolt(sx3 + 70, sy3 + 20, -1, 0.8)}
  ${figure('jessie', jes3)}
  ${figure('james', { x: 830, y: 716, s: 0.98, legs: 'run', arms: 'run', face: 'shock', hair: true })}`);

/* ------------------------------------------------------------ chapter 6 */

const hall = (planeX = 520) => `<rect width="${W}" height="${H}" fill="#eef2f5"/>
  ${glassWall(40, 984, 70, 320)}
  ${plane(planeX, 240, 0.7)}
  <rect y="440" width="${W}" height="${H - 440}" fill="#dfe3e6"/><path d="M0 440 H${W}" stroke="${INK}" stroke-width="2.5"/>
  ${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 210 - 80} ${H} L${i * 210 + 60} 440" stroke="#000" stroke-width="2" opacity="0.06"/>`).join('')}`;

/** ¶1 The airport hall: Ash asks the woman at the desk; she points the way. */
const c6p1 = svg(`${hall()}
  ${figure('clerk', { x: 780, y: 716, s: 1.0, arms: { a: [[-12, -6], [128, 140]], layer: 'back' }, face: 'smile', look: 'right' })}
  ${desk(600, 960, 600)}
  ${figure('walker1', { x: 120, y: 716, s: 0.86, legs: 'walk', face: 'smile', look: 'left' })}${suitcase(190, 716)}
  ${ash({ x: 420, y: 716, s: 1.12, arms: 'reach', face: 'worried' })}`);

/** ¶2 The bad guys say the sack holds their cat; a lightning-bolt tail pokes out; Ash laughs. */
// The tail comes out of the sack's mouth and off to the right, clear of her face.
const tail = `<g transform="scale(1.3)"><path d="M20 -50 L50 -66 L46 -74 L80 -88 L92 -70 L62 -60 L66 -52 L30 -38 Z" fill="#f7d23c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 -50 L32 -56 L36 -44 L30 -38 Z" fill="#9a6a34" stroke="${INK}" stroke-width="2"/></g>`;
const c6p2 = svg(`${hall(640)}
  ${figure('james', { x: 840, y: 716, s: 1.0, arms: 'hips', face: 'sly' })}
  ${figure('jessie', { x: 650, y: 716, s: 1.05, arms: 'hold', face: 'sly', inArms: sack(0, -84, 0.85, tail) })}
  ${ash({ x: 300, y: 716, s: 1.12, arms: 'point', face: 'laugh' })}`);

/** ¶3 The sack bursts; Pikachu leaps into Ash's arms; the bad guys run for the plane. */
const c6p3 = svg(`${hall(560)}
  ${figure('jessie', { x: 780, y: 620, s: 0.72, legs: 'run', arms: 'run', face: 'shock', hair: true })}
  ${figure('james', { x: 890, y: 620, s: 0.7, legs: 'run', arms: 'run', face: 'shock', hair: true })}
  <path d="M600 720 C590 690 640 676 660 700 C680 680 720 690 704 722 Z" fill="#cdb48e" stroke="${INK}" stroke-width="2.5"/>
  ${bolt(620, 660, 1)}${bolt(720, 650, -1)}${bolt(670, 620, 1, 0.7)}
  ${ash({ x: 330, y: 716, s: 1.15, arms: 'catch', face: 'happy' })}
  ${pikachu({ x: 500, y: 560, s: 0.95, mood: 'laugh', arms: 'up', tilt: -24, shadowless: true })}
  <path d="M600 520 l30 10 M606 548 l30 2 M598 576 l26 -6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);

/** ¶4 Outside the airport: Ash hugs Pikachu; a taxi to the cake shop. */
const c6p4 = svg(`${sky('#f3dcc0', '#fbf0de')}
  <rect x="0" y="230" width="360" height="330" fill="#e8eef2" stroke="${INK}" stroke-width="2.5"/>${glassWall(20, 340, 270, 220)}
  ${shopFront(820, 560, 200, 260, '#f8e4e8', '#e9879e', true)}
  ${road(560)}
  ${taxi(620, 700, 1.0)}
  ${ash({ x: 300, y: 724, s: 1.15, arms: 'cradle', face: 'happy', inArms: pikachu({ x: 0, y: -66, s: 0.52, mood: 'laugh', shadowless: true }) })}
  ${marks.heart(300, 410, 1.2)}`);

export const pictures = [
  { name: 'ch4-1', svg: c4p1 }, { name: 'ch4-2', svg: c4p2 }, { name: 'ch4-3', svg: c4p3 }, { name: 'ch4-4', svg: c4p4 }, { name: 'ch4-5', svg: c4p5 },
  { name: 'ch5-1', svg: c5p1 }, { name: 'ch5-2', svg: c5p2 }, { name: 'ch5-3', svg: c5p3 },
  { name: 'ch6-1', svg: c6p1 }, { name: 'ch6-2', svg: c6p2 }, { name: 'ch6-3', svg: c6p3 }, { name: 'ch6-4', svg: c6p4 },
];
