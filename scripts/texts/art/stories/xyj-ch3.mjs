/**
 * 西游记, chapter 3 — 闯龙宫醉闹冥府: eleven pictures, one a paragraph, for the
 * easier version and the book's text alike (¶3 has one for each: the book's
 * Dragon Kings bring a crown as well; the retelling has clothes and shoes).
 * Drawn by hand with the kit, the monkeys of chapter 1 and the people of
 * chapter 2 (see ../BRIEF.md and ../../../../.claude/skills/add-text/books/xiyouji.md).
 *
 * New here: the Dragon Kings (person + the `dragon` hat), the ghosts (the
 * `ghost` hat), the Ten Kings and the judge (`official`), the Jade Emperor
 * full size (`crown`), the Great White Star (`scholar`), and Wukong in his
 * golden armour and phoenix crown (`monkey({ armour, crown })`), from ¶4 on.
 *
 *   node scripts/texts/art/render.mjs scripts/texts/art/stories/xyj-ch3.mjs <out dir>
 */
import { flowers, grassTufts, H, hills, INK, marks, pine, svg, W } from '../kit.mjs';
import { cloud, HERO, ink, monkey, monkeyHand, mountain, palace, peachTree, sea, shade, sky, TROOP, waterfall } from './xyj-ch1.mjs';
import { DISCIPLE, nimbus, person, personHand } from './xyj-ch2.mjs';

/* ---------------------------------------------------------------- people */

const ARMOUR = '#e0b040'; // the golden chain mail, from ¶4 on
/** Wukong as he is after the Dragon Palace: golden mail, the phoenix crown. */
const armoured = (o) => monkey({ fur: HERO, hero: true, robe: ARMOUR, armour: true, crown: true, ...o });
/** Wukong before it: the grey robe of chapter 2. */
const robed = (o) => monkey({ fur: HERO, hero: true, robe: DISCIPLE, ...o });

/** The four Dragon Kings: a human face, golden antlers and whiskers, a robe a sea. */
const KINGS = { east: '#5f9a7a', south: '#c25a48', west: '#e6e2d6', north: '#4d6a92' };
const dragonKing = (sea, o) => person({ robe: KINGS[sea], trim: '#f4c430', hair: 'none', hat: 'dragon', beard: true, beardColour: '#e8e2c8', skin: '#e6d4b0', ...o });
/** A ghost messenger of the Underworld: pale, grey robe, tall white hat. */
const ghost = (o) => person({ robe: '#7d8290', trim: '#c9cdd4', hair: 'none', hat: 'ghost', skin: '#e3e6e4', ...o });
/** One of the Ten Kings of the Underworld: dark red robe, black winged hat, black beard. */
const underKing = (o) => person({ robe: '#7a3a3a', trim: '#e0b040', hair: 'none', hat: 'official', beard: true, beardColour: '#3a3330', ...o });
/** The judge: a dark green robe and the same hat. */
const judge = (o) => person({ robe: '#4f6a52', trim: '#e8dcc2', hair: 'none', hat: 'official', beard: true, beardColour: '#3a3330', ...o });
/** The Jade Emperor (ch. 1's yellow robe and black crown), full size. */
const jadeEmperor = (o) => person({ robe: '#f2c64a', trim: '#c9443a', hair: 'none', hat: 'crown', beard: true, beardColour: '#3a3330', ...o });
/** The Great White Star: an old immortal, white beard, pale blue robe, blue cap. */
const greatWhiteStar = (o) => person({ robe: '#cfe0ee', trim: '#7d9cc4', hair: 'bald', hat: 'scholar', beard: true, ...o });

/* ------------------------------------------------------------- the props */

/** The golden-banded staff from (x1, y1) to (x2, y2): black iron, a gold band at each end. */
const staff = (x1, y1, x2, y2, w = 12) => {
  const t = (k) => [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k];
  const [a1, b1] = t(0.14);
  const [a2, b2] = t(0.86);
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="${w + 6}" stroke-linecap="round"/>
    <path d="M${x1} ${y1} L${x2} ${y2}" stroke="#55545c" stroke-width="${w}" stroke-linecap="round"/>
    <path d="M${x1} ${y1} L${a1} ${b1} M${a2} ${b2} L${x2} ${y2}" stroke="#f4c430" stroke-width="${w}" stroke-linecap="round"/>`;
};
/** A staff through a hand: `len` either way along angle a (degrees from straight up, clockwise). */
const staffAt = ([hx, hy], a, before, after, w) => {
  const [dx, dy] = [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
  return staff(hx - dx * before, hy - dy * before, hx + dx * after, hy + dy * after, w);
};
/** A staff stood upright on the ground at foot level `ground`, held in the hand. */
const staffStood = (hand, ground, above, w = 12) => staffAt(hand, 0, ground - hand[1] - 4, above, w);
/** A sword held up in the hand, blade up. */
const sword = (hx, hy) => `<path d="M${hx} ${hy - 6} L${hx + 10} ${hy - 110}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${hx} ${hy - 6} L${hx + 10} ${hy - 110}" stroke="#d8dde2" stroke-width="7" stroke-linecap="round"/><path d="M${hx - 16} ${hy - 12} L${hx + 16} ${hy - 8}" ${ink(7)}/>`;
/** A rack of spears and halberds. */
const rack = (x, y) => `<g>${[-60, -20, 20, 60].map((dx, i) => `<path d="M${x + dx} ${y} V${y - 230}" stroke="${INK}" stroke-width="9"/><path d="M${x + dx} ${y} V${y - 230}" stroke="#a07a52" stroke-width="5"/>${i % 2 ? `<path d="M${x + dx - 12} ${y - 236} L${x + dx} ${y - 270} L${x + dx + 12} ${y - 236} Z" fill="#d8dde2" ${ink(2)}/>` : `<path d="M${x + dx} ${y - 232} q22 -6 24 -30 q-14 10 -24 6 Z" fill="#d8dde2" ${ink(2)}/>`}`).join('')}
  <rect x="${x - 86}" y="${y - 160}" width="172" height="12" rx="4" fill="#8a6a4a" ${ink(2.5)}/><rect x="${x - 86}" y="${y - 20}" width="172" height="14" rx="4" fill="#8a6a4a" ${ink(2.5)}/></g>`;
/** A wooden stick for a young monkey to practise with. */
const stick = ([hx, hy]) => `<path d="M${hx - 6} ${hy + 30} L${hx + 14} ${hy - 70}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${hx - 6} ${hy + 30} L${hx + 14} ${hy - 70}" stroke="#b48a5a" stroke-width="5" stroke-linecap="round"/>`;
/** The purple-gold crown with phoenix wings, held out. */
const crownHeld = (hx, hy) => `<g transform="translate(${hx + 6} ${hy - 22})"><path d="M-6 -14 C-22 -50 -46 -56 -60 -50 M6 -14 C22 -50 46 -56 60 -50" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M-6 -14 C-22 -50 -46 -56 -60 -50 M6 -14 C22 -50 46 -56 60 -50" stroke="#c9443a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M-22 6 C-22 -22 22 -22 22 6 Z" fill="#8e5aa8" ${ink(2.5)}/><path d="M-24 5 h48" stroke="#f4c430" stroke-width="6" stroke-linecap="round"/></g>`;
/** The golden chain mail, folded over the arms. */
const mailHeld = (hx, hy) => `<g transform="translate(${hx + 4} ${hy - 8})"><path d="M-30 -30 L30 -30 L36 20 L-36 20 Z" fill="${ARMOUR}" ${ink(2.5)}/>${Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<path d="M${-28 + c * 12 + (r % 2) * 6} ${-20 + r * 12} q6 8 12 0" stroke="${shade(ARMOUR, -0.35)}" stroke-width="2" fill="none"/>`).join('')).join('')}</g>`;
/** The cloud-walking shoes: a pair, with a cloud curl on each toe. */
const shoesHeld = (hx, hy) => `<g transform="translate(${hx + 4} ${hy - 6})">${[-16, 16].map((dx) => `<path d="M${dx - 14} 10 C${dx - 16} -16 ${dx + 14} -16 ${dx + 16} 10 Z" fill="#e8dcc2" ${ink(2.5)}/><path d="M${dx - 6} -2 q6 -8 12 0" stroke="#7d9cc4" stroke-width="3" fill="none"/>`).join('')}</g>`;
/** A wine jar. */
const jar = (x, y) => `<path d="M${x - 22} ${y} C${x - 36} ${y - 30} ${x - 26} ${y - 56} ${x - 12} ${y - 60} L${x + 12} ${y - 60} C${x + 26} ${y - 56} ${x + 36} ${y - 30} ${x + 22} ${y} Z" fill="#9a6a44" ${ink(2.5)}/><rect x="${x - 14}" y="${y - 72}" width="28" height="14" rx="4" fill="#c9443a" ${ink(2)}/>`;
/** A paper warrant in the hand. */
const warrant = (hx, hy) => `<rect x="${hx - 4}" y="${hy - 64}" width="38" height="64" fill="#f6efd8" ${ink(2.5)}/><path d="M${hx + 6} ${hy - 52} v40 M${hx + 18} ${hy - 52} v30" stroke="#c9443a" stroke-width="3"/>`;
/** A loop of rope hanging from the hand. */
const rope = (hx, hy) => `<path d="M${hx} ${hy} C${hx + 10} ${hy + 40} ${hx - 30} ${hy + 70} ${hx - 6} ${hy + 90} C${hx + 30} ${hy + 110} ${hx + 40} ${hy + 50} ${hx + 4} ${hy + 40}" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M${hx} ${hy} C${hx + 10} ${hy + 40} ${hx - 30} ${hy + 70} ${hx - 6} ${hy + 90} C${hx + 30} ${hy + 110} ${hx + 40} ${hy + 50} ${hx + 4} ${hy + 40}" stroke="#c8a870" stroke-width="5" fill="none" stroke-linecap="round"/>`;
/** The Book of Life and Death, open, on a low table. */
const ledger = (x, y) => `<rect x="${x - 90}" y="${y - 22}" width="180" height="14" rx="3" fill="#7a5a3a" ${ink(2.5)}/><path d="M${x - 70} ${y - 8} v20 M${x + 70} ${y - 8} v20" ${ink(6)}/>
  <path d="M${x} ${y - 26} C${x - 30} ${y - 40} ${x - 70} ${y - 40} ${x - 80} ${y - 30} L${x - 80} ${y - 20} L${x} ${y - 20} Z" fill="#f6efd8" ${ink(2.5)}/><path d="M${x} ${y - 26} C${x + 30} ${y - 40} ${x + 70} ${y - 40} ${x + 80} ${y - 30} L${x + 80} ${y - 20} L${x} ${y - 20} Z" fill="#f6efd8" ${ink(2.5)}/>
  ${[-62, -48, -34, 34, 48, 62].map((dx) => `<path d="M${x + dx} ${y - 34} v10" stroke="#6a6a6a" stroke-width="2"/>`).join('')}<path d="M${x - 66} ${y - 30} l40 -2 M${x - 64} ${y - 26} l40 -2" stroke="#c9443a" stroke-width="3"/>`;
/** A brush held for writing, tip down to the paper. */
const brush = (hx, hy) => `<path d="M${hx} ${hy - 30} L${hx + 4} ${hy + 18}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${hx} ${hy - 30} L${hx + 4} ${hy + 18}" stroke="#a07a52" stroke-width="3" stroke-linecap="round"/><path d="M${hx + 1} ${hy + 14} q2 10 4 14 q4 -6 2 -14 Z" fill="${INK}"/>`;
/** A horsetail whisk, the immortal's sign: a short handle, long white hair falling over the wrist. */
const whisk = (hx, hy) => `<path d="M${hx} ${hy + 4} L${hx + 6} ${hy - 44}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${hx} ${hy + 4} L${hx + 6} ${hy - 44}" stroke="#a07a52" stroke-width="4" stroke-linecap="round"/>
  ${[0, 6, 12, 18].map((d) => `<path d="M${hx + 6} ${hy - 44} C${hx + 22 + d} ${hy - 44} ${hx + 26 + d} ${hy - 10} ${hx + 18 + d} ${hy + 40}" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}
  ${[0, 6, 12, 18].map((d) => `<path d="M${hx + 6} ${hy - 44} C${hx + 22 + d} ${hy - 44} ${hx + 26 + d} ${hy - 10} ${hx + 18 + d} ${hy + 40}" stroke="#fffaf0" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}`;
/** A red lantern hanging on a cord from the top of the picture. */
const lantern = (x, y) => `<path d="M${x} 0 V${y - 30}" ${ink(2)}/><ellipse cx="${x}" cy="${y}" rx="60" ry="60" fill="#ff9a6a" opacity="0.35" filter="url(#blur18)"/><ellipse cx="${x}" cy="${y}" rx="22" ry="28" fill="#d8503a" ${ink(2.5)}/><path d="M${x - 10} ${y - 28} h20 M${x - 10} ${y + 28} h20" ${ink(4)}/><path d="M${x} ${y + 30} v16" stroke="#e0b040" stroke-width="3"/>`;
/** A pillar, red or dark, from floor to ceiling. */
const pillar = (x, top, bottom, colour = '#8a2e2a') => `<rect x="${x - 22}" y="${top}" width="44" height="${bottom - top}" fill="${colour}" ${ink(2.5)}/><rect x="${x - 30}" y="${bottom - 16}" width="60" height="16" rx="3" fill="${shade(colour, -0.3)}" ${ink(2)}/>`;
/** A throne: a tall carved back and a seat. */
const throne = (x, y, colour = '#c9443a') => `<path d="M${x - 110} ${y} V${y - 190} Q${x - 110} ${y - 240} ${x - 60} ${y - 246} H${x + 60} Q${x + 110} ${y - 240} ${x + 110} ${y - 190} V${y} Z" fill="${colour}" ${ink(2.5)}/>
  <path d="M${x - 80} ${y - 190} q80 -40 160 0" stroke="#f4c430" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="${x - 130}" y="${y - 10}" width="260" height="30" rx="6" fill="${shade(colour, -0.25)}" ${ink(2.5)}/>`;
/** A plank bridge over a stream, its deck at y. */
const ironBridge = (x, y, w = 340) => `<path d="M${x - w / 2} ${y + 10} Q${x} ${y - 50} ${x + w / 2} ${y + 10}" stroke="${INK}" stroke-width="22" fill="none"/><path d="M${x - w / 2} ${y + 10} Q${x} ${y - 50} ${x + w / 2} ${y + 10}" stroke="#6a6e78" stroke-width="16" fill="none"/>
  ${[-0.36, -0.12, 0.12, 0.36].map((k) => `<path d="M${x + k * w} ${y - 10 - (0.25 - k * k) * 80} v-46" ${ink(5)}/>`).join('')}<path d="M${x - w * 0.42} ${y - 42} Q${x} ${y - 100} ${x + w * 0.42} ${y - 42}" ${ink(5)} fill="none"/>`;
/** A dark city gate with a blank iron plaque over it. */
const gate = (x, y) => `<path d="M${x - 300} ${y} V${y - 300} H${x + 300} V${y} Z" fill="#4a4456" ${ink(2.5)}/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${x - 300 + i * 90}" y="${y - 332}" width="56" height="34" fill="#4a4456" ${ink(2.5)}/>`).join('')}
  <path d="M${x - 110} ${y} V${y - 150} Q${x} ${y - 250} ${x + 110} ${y - 150} V${y} Z" fill="#221e2a" ${ink(2.5)}/>
  <rect x="${x - 90}" y="${y - 290}" width="180" height="56" rx="4" fill="#6a6e78" ${ink(3)}/><rect x="${x - 78}" y="${y - 280}" width="156" height="36" fill="#7e828c"/>`;
/** Bubbles rising. */
const bubbles = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.35" stroke="#ffffff" stroke-width="2"/>`).join('');
/** Seaweed swaying up from the floor. */
const weed = (x, y, h, colour = '#4f8a6a') => `<path d="M${x} ${y} c-16 ${-h * 0.25} 16 ${-h * 0.5} 0 ${-h * 0.75} c-12 ${-h * 0.12} 4 ${-h * 0.2} 6 ${-h * 0.25}" stroke="${INK}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M${x} ${y} c-16 ${-h * 0.25} 16 ${-h * 0.5} 0 ${-h * 0.75} c-12 ${-h * 0.12} 4 ${-h * 0.2} 6 ${-h * 0.25}" stroke="${colour}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
/** The Dragon Palace inside: blue-green water, coral-red pillars, a pearl-white floor. */
const underwater = () => `<defs><linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4cc"/><stop offset="1" stop-color="#3f7f94"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#deep)"/>
  ${[[180, 0, 40], [420, 0, 60], [700, 0, 50]].map(([x, , w]) => `<path d="M${x} 0 L${x + w} 0 L${x + w * 3} 560 L${x - w} 560 Z" fill="#e8fbff" opacity="0.18"/>`).join('')}
  ${pillar(90, 110, 600, '#c25a48')}${pillar(934, 110, 600, '#c25a48')}
  <path d="M40 110 Q512 40 984 110 L984 140 Q512 70 40 140 Z" fill="#e0b040" ${ink(2.5)}/>
  <path d="M0 768 L0 590 C300 570 700 570 1024 590 L1024 768 Z" fill="#d8e6e0" ${ink(2.5)}/>
  ${weed(40, 640, 200)}${weed(990, 650, 220, '#5f9a6a')}${weed(160, 700, 140, '#5f9a6a')}`;
/** The Underworld: purple gloom, a dark ground. */
const gloom = (top = '#3c3650', bottom = '#5a5068') => `<defs><linearGradient id="gloom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#gloom)"/>`;
/** A dark hall of the Underworld, lit by lanterns. */
const darkHall = () => `${gloom('#2e2838', '#4a3e4c')}
  ${pillar(110, 0, 590)}${pillar(914, 0, 590)}${pillar(330, 0, 520, '#6a2a2a')}${pillar(694, 0, 520, '#6a2a2a')}
  <path d="M0 768 L0 580 C300 560 700 560 1024 580 L1024 768 Z" fill="#5e5260" ${ink(2.5)}/>
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${i * 230 - 40} 768 L${120 + i * 200} 590" stroke="#4e4450" stroke-width="3"/>`).join('')}
  ${lantern(220, 150)}${lantern(804, 150)}`;
/** Heaven: a golden sky and banks of cloud. */
const heaven = () => `${sky('#f6dca0', '#fbf3df', [512, 160])}
  ${cloud(140, 600, 1.6, '#fffaf0')}${cloud(880, 610, 1.7, '#fffaf0')}${cloud(520, 680, 2.4, '#ffffff')}`;

/* ---------------------------------------------------------------- scenes */

/** ¶1 On the Mountain, Wukong teaches the monkeys with weapons; the sword in his own hand will not do. */
const w1 = { x: 470, y: 640, s: 1.1, arms: 'raise', face: 'worried', look: 'up' };
const s1 = svg(`${sky('#cfe6ea', '#f6f2de', [880, 110])}
  ${hills(400, '#c6d8c2', 30, 4)}
  ${mountain(160, 190, 420, 560)}${waterfall(170, 300, 60, 540)}
  <path d="M0 768 L0 560 C220 540 520 560 760 550 C880 546 960 552 1024 556 L1024 768 Z" fill="#9cc27f" ${ink(2.5)}/>
  ${peachTree(920, 560, 200)}
  ${rack(760, 640)}
  ${robed(w1)}${sword(...monkeyHand(w1))}
  ${[[200, 700, 0, 0.78], [300, 720, 1, 0.74]].map(([x, y, i, s]) => { const m = { x, y, s, arms: 'stick', flip: true, look: 'right' }; return monkey({ ...m, fur: TROOP[i], face: 'determined' }) + stick(monkeyHand(m)); }).join('')}
  ${monkey({ x: 620, y: 730, s: 0.72, fur: TROOP[2], arms: 'lap', legs: 'sit', face: 'smile', look: 'left' })}
  ${flowers([[80, 720, '#f2a6b4'], [880, 730, '#f6f0e8']])}${grassTufts([[60, 690], [420, 740], [990, 700]])}`);

/** ¶2 In the Dragon Palace, the magic iron shrinks to a staff in Wukong's hands; the Dragon King gapes. */
const w2 = { x: 600, y: 650, s: 1.1, arms: 'raise', face: 'happy', look: 'up' };
const h2 = monkeyHand(w2);
const s2 = svg(`${underwater()}
  <rect x="${h2[0] - 60}" y="40" width="120" height="560" rx="20" fill="#cfe0e6" opacity="0.35" stroke="#ffffff" stroke-width="4" stroke-dasharray="14 12"/>
  ${dragonKing('east', { x: 260, y: 660, s: 1.05, arms: 'frown', face: 'worried', look: 'right' })}
  ${robed(w2)}
  ${staffAt(h2, 10, 110, 150, 14)}
  ${marks.star(h2[0] - 40, h2[1] - 150, 12, '#fff2a8')}${marks.star(h2[0] + 60, h2[1] - 100, 14, '#fff2a8')}${marks.star(h2[0] + 50, 110, 10, '#fff2a8')}
  ${bubbles([[200, 300, 10], [230, 250, 7], [820, 360, 12], [850, 300, 8], [760, 200, 6], [420, 260, 8]])}`);

/** ¶3 The four Dragon Kings bring a crown, golden mail and cloud shoes; the Eastern King frowns behind. */
const kingsScene = (withCrown) => {
  const south = { x: 285, y: 670, s: 0.92, arms: withCrown ? 'offer' : 'clap', face: 'worried', look: 'right' };
  const west = { x: 490, y: 690, s: 0.92, arms: 'offer', face: 'worried', look: 'right' };
  const north = { x: 670, y: 700, s: 0.92, arms: 'offer', face: 'worried', look: 'right' };
  const w = { x: 870, y: 690, s: 1.05, arms: 'stick', face: 'happy', look: 'left', flip: true };
  return svg(`${underwater()}
    ${dragonKing('east', { x: 130, y: 610, s: 0.82, arms: 'frown', face: 'stern', look: 'right' })}
    ${dragonKing('south', { ...south, hold: withCrown ? crownHeld : null })}
    ${dragonKing('west', { ...west, hold: mailHeld })}
    ${dragonKing('north', { ...north, hold: shoesHeld })}
    ${staffStood(monkeyHand(w), w.y, 200)}
    ${robed(w)}
    ${bubbles([[700, 260, 9], [730, 210, 6], [380, 230, 8], [520, 180, 6]])}`);
};
const s3Book = kingsScene(true);
const s3Easy = kingsScene(false);

/** ¶4 In golden mail and the phoenix crown, Wukong bursts up out of the sea, swinging his staff. */
const w4 = { x: 520, y: 470, s: 1.1, legs: 'jump', arms: 'raise', face: 'determined', look: 'right', shadowless: true };
const s4 = svg(`${sky('#bfe2f0', '#f2f6ee', [860, 100])}
  ${cloud(180, 150, 0.8)}${cloud(820, 220, 0.6)}
  ${sea(560, '#6fb0cc')}
  <ellipse cx="520" cy="610" rx="170" ry="26" fill="#a8d4e6" ${ink(2.5)}/><ellipse cx="520" cy="610" rx="100" ry="14" fill="#d6eef6" ${ink(2)}/>
  ${[[-1, 60], [-1, 110], [1, 60], [1, 110], [0, 0]].map(([d, k]) => `<path d="M${520 + d * 20} 600 C${520 + d * (40 + k * 0.4)} ${560 - k * 0.3} ${520 + d * (60 + k)} ${540 - k * 0.2} ${520 + d * (80 + k * 1.2)} ${580 - k * 0.1}" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round"/>`).join('')}
  ${[[430, 530, 8], [470, 500, 6], [600, 510, 7], [640, 540, 9]].map(([x, y, r]) => `<path d="M${x} ${y - r} q${r} ${r * 1.4} 0 ${r * 2} q${-r} ${-r * 0.6} 0 ${-r * 2} Z" fill="#e8f6fb" ${ink(2)}/>`).join('')}
  ${staffAt(monkeyHand(w4), 34, 170, 130, 13)}
  ${armoured(w4)}
  ${dragonKing('east', { x: 170, y: 660, s: 0.62, arms: 'frown', face: 'worried', look: 'right', shadowless: true })}
  ${dragonKing('north', { x: 860, y: 670, s: 0.6, arms: 'frown', face: 'worried', look: 'left', flip: true, shadowless: true })}
  <path d="M90 640 q40 -16 80 0 t80 0 M790 650 q40 -16 80 0 t80 0" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="0" y="650" width="${W}" height="118" fill="#6fb0cc" filter="url(#wash)"/>
  ${[[60, 700, 90], [400, 720, 120], [760, 700, 100]].map(([x, y, w]) => `<path d="M${x} ${y} q${w / 4} -8 ${w / 2} 0 t${w / 2} 0" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`).join('')}`);

/** ¶5 Asleep by the iron bridge after the feast; two ghosts creep up with a warrant and a rope. */
const g1 = { x: 720, y: 660, s: 0.96, arms: 'offer', face: 'stern', look: 'left', flip: true };
const g2 = { x: 880, y: 670, s: 0.96, arms: 'offer', face: 'stern', look: 'left', flip: true };
const s5 = svg(`${sky('#5a6a96', '#c9b8c8', [160, 120])}
  <circle cx="160" cy="120" r="34" fill="#f4ecc8"/>
  ${hills(470, '#7a7c9a', 30, 3)}
  <path d="M0 520 C200 510 500 530 1024 520 L1024 600 L0 600 Z" fill="#7fa0b8" filter="url(#wash)"/>
  ${ironBridge(560, 560, 300)}
  <path d="M0 768 L0 590 C260 572 600 584 1024 594 L1024 768 Z" fill="#6f8a64" ${ink(2.5)}/>
  ${pine(250, 640, 380, '#4f7a58')}
  ${jar(400, 700)}
  ${armoured({ x: 280, y: 690, s: 1.0, legs: 'sit', arms: 'lap', face: 'shut', lean: -6 })}
  ${ghost({ ...g1, hold: warrant })}
  ${ghost({ ...g2, hold: rope })}
  ${grassTufts([[60, 720], [520, 740], [990, 720]], '#5f7a54')}`);

/** ¶6 Before the gate of the Underworld, Wukong knocks the two ghosts flying with his staff. */
const w6 = { x: 512, y: 700, s: 1.12, legs: 'walk', arms: 'raise', face: 'determined', look: 'right' };
const s6 = svg(`${gloom()}
  ${gate(512, 560)}
  <path d="M0 768 L0 560 C300 548 700 548 1024 560 L1024 768 Z" fill="#6a6070" ${ink(2.5)}/>
  ${staffAt(monkeyHand(w6), 52, 150, 160, 13)}
  ${armoured(w6)}
  ${ghost({ x: 170, y: 520, s: 0.8, arms: 'cheer', face: 'open', lean: -38, shadowless: true })}
  ${ghost({ x: 870, y: 460, s: 0.8, arms: 'cheer', face: 'open', lean: 40, shadowless: true, flip: true })}
  ${marks.star(240, 330, 12, '#fff2a8')}${marks.star(800, 260, 12, '#fff2a8')}${marks.speed(300, 470, 3, 50)}${marks.speed(760, 410, 3, -50)}
  <path d="M260 720 C300 700 360 740 400 716 C430 700 400 680 370 700" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M260 720 C300 700 360 740 400 716 C430 700 400 680 370 700" stroke="#c8a870" stroke-width="5" fill="none" stroke-linecap="round"/>`);

/** ¶7 The Ten Kings hurry out of their hall and bow to Wukong. */
const s7 = svg(`${darkHall()}
  ${underKing({ x: 140, y: 690, s: 0.82, arms: 'clap', face: 'worried', look: 'right', lean: 12 })}
  ${underKing({ x: 270, y: 710, s: 0.9, arms: 'clap', face: 'worried', look: 'right', lean: 14 })}
  ${underKing({ x: 400, y: 728, s: 0.96, arms: 'clap', face: 'open', look: 'right', lean: 16 })}
  ${underKing({ x: 900, y: 700, s: 0.86, arms: 'clap', face: 'worried', look: 'left', lean: -12, flip: true })}
  ${staffStood(monkeyHand({ x: 680, y: 720, s: 1.12, arms: 'stick', flip: true }), 720, 210, 13)}
  ${armoured({ x: 680, y: 720, s: 1.12, arms: 'stick', face: 'determined', look: 'left', flip: true })}`);

/** ¶8 Seated in the middle of the hall, Wukong strikes the monkeys' names out of the Book of Life and Death. */
const w8 = { x: 512, y: 640, s: 1.05, legs: 'sit', arms: 'write', face: 'happy', look: 'down' };
const s8 = svg(`${darkHall()}
  ${throne(512, 600)}
  ${armoured(w8)}
  ${ledger(512, monkeyHand(w8)[1] + 34)}
  ${brush(...monkeyHand(w8))}
  ${judge({ x: 230, y: 730, s: 0.95, arms: 'frown', face: 'worried', look: 'right' })}
  ${underKing({ x: 800, y: 730, s: 0.9, arms: 'frown', face: 'worried', look: 'left', flip: true })}
  ${underKing({ x: 930, y: 740, s: 0.8, arms: 'clap', face: 'open', look: 'left', flip: true })}`);

/** ¶9 Back on the Mountain: he wakes under the pine, and the monkeys crowd round to hear the dream. */
const s9 = svg(`${sky('#f6dcc0', '#fbf3e2', [860, 120])}
  ${hills(420, '#c6d8c2', 30, 6)}
  ${waterfall(860, 250, 70, 560)}
  <path d="M0 768 L0 560 C260 540 520 560 760 550 C880 546 960 552 1024 556 L1024 768 Z" fill="#9cc27f" ${ink(2.5)}/>
  ${pine(400, 620, 400, '#5f9058')}
  ${armoured({ x: 420, y: 650, s: 1.05, legs: 'sit', arms: 'wide', face: 'happy', look: 'right' })}
  ${monkey({ x: 200, y: 700, s: 0.78, fur: TROOP[0], legs: 'jump', arms: 'cheer', face: 'happy', look: 'right' })}
  ${monkey({ x: 640, y: 700, s: 0.78, fur: TROOP[1], arms: 'clasp', face: 'happy', look: 'left', flip: true })}
  ${monkey({ x: 770, y: 720, s: 0.72, fur: TROOP[2], legs: 'jump', arms: 'cheer', face: 'happy', look: 'left', flip: true })}
  ${monkey({ x: 560, y: 740, s: 0.7, fur: TROOP[1], old: true, legs: 'sit', arms: 'lap', face: 'smile', look: 'left' })}
  ${flowers([[90, 740, '#f2a6b4'], [960, 740, '#f6d24a']])}${grassTufts([[40, 700], [320, 750], [900, 700]])}`);

/** ¶10 In the Hall of Divine Mists, the Great White Star steps out of the ranks with his idea. */
const s10 = svg(`${heaven()}
  ${pillar(150, 60, 560, '#c9443a')}${pillar(874, 60, 560, '#c9443a')}
  <path d="M60 60 Q512 0 964 60 L964 90 Q512 30 60 90 Z" fill="#e8b13a" ${ink(2.5)}/>
  <path d="M0 768 L0 560 C300 540 700 540 1024 560 L1024 768 Z" fill="#f2e6cc" ${ink(2.5)}/>
  ${throne(640, 520, '#e8b13a')}
  ${jadeEmperor({ x: 640, y: 500, s: 0.95, legs: 'sit', arms: 'lap', face: 'smile', look: 'left' })}
  ${greatWhiteStar({ x: 330, y: 700, s: 1.02, arms: 'offer', lean: 8, face: 'smile', look: 'right', hold: whisk })}
  ${person({ x: 140, y: 720, s: 0.8, robe: '#a7a3c9', hair: 'none', hat: 'official', arms: 'clap', face: 'smile', look: 'right' })}
  ${person({ x: 900, y: 720, s: 0.8, robe: '#8fb3a3', hair: 'none', hat: 'official', arms: 'clap', face: 'smile', look: 'left', flip: true })}`);

/** ¶11 The Great White Star and Wukong ride a lucky cloud up from the Mountain to heaven. */
const s11 = svg(`${sky('#bfe0f2', '#fbf1dc', [880, 90])}
  ${palace(880, 210, 0.8)}
  ${cloud(180, 120, 0.6)}
  ${hills(600, '#c6d8c2', 26, 3)}
  ${mountain(250, 520, 460, 768)}${waterfall(250, 600, 40, 740)}
  ${[[180, 600], [320, 610]].map(([x, y], i) => monkey({ x, y, s: 0.36, fur: TROOP[i], arms: 'wave', face: 'happy', look: 'up' })).join('')}
  ${nimbus(560, 420, 1.3)}
  ${greatWhiteStar({ x: 490, y: 416, s: 0.95, arms: 'offer', face: 'smile', look: 'right', hold: whisk, shadowless: true })}
  ${armoured({ x: 640, y: 420, s: 1.0, arms: 'wave', face: 'happy', look: 'up', shadowless: true })}
  ${marks.speed(400, 400, 3, 70)}`);

export const pictures = [
  { name: 'p1', svg: s1 },
  { name: 'p2', svg: s2 },
  { name: 'p3-book', svg: s3Book },
  { name: 'p3-easy', svg: s3Easy },
  { name: 'p4', svg: s4 },
  { name: 'p5', svg: s5 },
  { name: 'p6', svg: s6 },
  { name: 'p7', svg: s7 },
  { name: 'p8', svg: s8 },
  { name: 'p9', svg: s9 },
  { name: 'p10', svg: s10 },
  { name: 'p11', svg: s11 },
];
