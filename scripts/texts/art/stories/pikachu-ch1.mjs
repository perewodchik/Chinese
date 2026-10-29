/**
 * 皮卡丘饿了, chapter 1 — 森林里的苹果: the four paragraphs, drawn by hand
 * with the kit (see ../BRIEF.md).
 */
import { apple, ash, flowers, grassTufts, handOf, hills, marks, pikachu, pine, sky, svg, tree, W, H, INK } from '../kit.mjs';

const path = `<path d="M330 ${H} C380 640 470 590 520 540 C560 500 600 470 640 450 L660 452 C640 480 620 520 640 560 C660 620 720 680 760 ${H} Z" fill="#e8d6ac" filter="url(#wash)"/>`;

const river = (y) => `<path d="M560 ${y} C680 ${y - 14} 820 ${y + 10} ${W} ${y - 6} L${W} ${y + 46} C860 ${y + 54} 700 ${y + 34} 560 ${y + 26} Z" fill="#9fcbe0" filter="url(#wash)"/>
  <path d="M640 ${y + 14} h50 M780 ${y + 22} h60 M900 ${y + 12} h40" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`;

/** ¶1 Ash and Pikachu walk through the forest, hungry; apple trees ahead. */
const walk = svg(`${sky('#cfe6e6', '#f2f2df')}
  ${hills(430, '#c9dcc0', 26, 1)}
  ${pine(70, 470, 260, '#8db592')}${pine(170, 480, 200, '#9cc2a0')}${pine(930, 470, 250, '#8db592')}${pine(850, 480, 190, '#9cc2a0')}
  ${hills(500, '#b7d39a', 18, 3)}
  ${tree(720, 500, 190, { apples: [[-0.5, 0.2], [0.3, -0.3], [0.7, 0.3], [-0.1, 0.5]] })}${tree(860, 510, 160, { apples: [[-0.4, 0.1], [0.4, 0.3], [0, -0.4]] })}
  ${path}
  ${grassTufts([[90, 700], [180, 650], [880, 690], [960, 640], [260, 740], [820, 740]])}
  ${flowers([[150, 690, '#f2a6b4'], [900, 720, '#f6f0e8'], [230, 610, '#f6f0e8']])}
  ${ash({ x: 450, y: 690, s: 1.3, legs: 'walk', arms: 'tummy', face: 'worried', look: 'right' })}
  ${pikachu({ x: 620, y: 696, s: 1.05, mood: 'worried', arms: 'belly' })}
  ${marks.rumble(500, 540)}${marks.rumble(660, 590)}${marks.sweat(392, 405)}`);

/** ¶2 Ash has climbed the apple tree and cannot get down; Pikachu looks up from below. */
const ashHang = { x: 600, y: 486, s: 1.0, legs: 'hang', arms: 'hang', face: 'worried' };
const [, gripY] = handOf('ash', ashHang, 1);
const stuck = svg(`${sky('#d4eaf2', '#f4f2de')}
  ${hills(470, '#cfe0c6', 22, 2)}
  ${pine(80, 500, 230, '#9cc2a0')}${pine(950, 500, 220, '#8db592')}
  ${hills(560, '#b2d095', 16, 4)}
  ${tree(470, 720, 680, { apples: [[-0.9, 0.1], [-0.5, -0.4], [0.1, -0.7], [0.6, 0.4], [-0.2, 0.3], [0.9, -0.1], [-0.8, 0.6], [0.3, 0.8]] })}
  <path d="M380 ${gripY + 24} C470 ${gripY + 10} 560 ${gripY + 2} 720 ${gripY - 22}" stroke="${INK}" stroke-width="24" fill="none" stroke-linecap="round"/>
  <path d="M380 ${gripY + 24} C470 ${gripY + 10} 560 ${gripY + 2} 720 ${gripY - 22}" stroke="#7a573c" stroke-width="18" fill="none" stroke-linecap="round"/>
  ${ash(ashHang)}
  ${marks.sweat(664, 262)}${marks.sweat(536, 274)}
  ${grassTufts([[120, 720], [220, 690], [760, 730], [900, 700]])}
  ${pikachu({ x: 800, y: 710, s: 1.05, mood: 'up', arms: 'up' })}`);

/** ¶3 A big apple drops on Ash's head; Pikachu laughs. */
const bonk = svg(`${sky('#e3eee2', '#f7f0dc')}
  ${hills(470, '#d3e2c4', 24, 5)}
  ${pine(940, 500, 220, '#9cc2a0')}
  ${hills(540, '#b8d39a', 14, 2)}
  ${tree(180, 720, 620, { apples: [[-0.6, 0.2], [0.2, -0.5], [0.7, 0.4], [-0.2, 0.6], [0.8, -0.2]] })}
  ${grassTufts([[60, 730], [330, 700], [880, 720], [980, 690]])}
  ${flowers([[300, 740, '#f2a6b4'], [960, 740, '#f6f0e8']])}
  ${ash({ x: 470, y: 700, s: 1.3, arms: 'head', face: 'ouch' })}
  ${apple(520, 340, 26)}
  ${marks.bump(470, 372)}${marks.star(392, 350, 16)}${marks.star(580, 300, 13)}${marks.star(560, 392, 10)}
  ${pikachu({ x: 770, y: 710, s: 1.1, mood: 'laugh', arms: 'belly', tilt: -10 })}
  <path d="M860 520 l20 -12 M866 548 l24 -2 M690 520 l-18 -14" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);

/** ¶4 They sit under the tree eating apples; across the river someone calls for help. */
const lunch = svg(`${sky('#d3e7ef', '#f1f2df')}
  ${hills(440, '#cddfc6', 20, 3)}
  ${pine(980, 470, 200, '#9cc2a0')}
  ${hills(480, '#bcd6a2', 12, 1)}
  ${river(492)}
  <g><circle cx="868" cy="452" r="11" fill="#f6cfa8" stroke="${INK}" stroke-width="2"/><path d="M856 464 h24 l2 26 h-28 Z" fill="#e98a3c" stroke="${INK}" stroke-width="2"/>
    <path d="M858 468 l-12 -20 M878 468 l12 -20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M858 468 l-12 -20 M878 468 l12 -20" stroke="#e98a3c" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="868" cy="442" rx="18" ry="5" fill="#e7c86a" stroke="${INK}" stroke-width="2"/></g>
  ${marks.shout(868, 420)}
  ${hills(560, '#b2d095', 10, 6)}
  ${tree(250, 690, 600, { apples: [[-0.7, 0.2], [0.1, -0.6], [0.7, 0.3], [-0.3, 0.5], [0.5, -0.3]] })}
  ${apple(452, 682, 15)}${apple(480, 686, 15)}${apple(466, 662, 15)}
  ${ash({ x: 300, y: 700, s: 1.15, legs: 'cross', arms: 'lap', hold: 'apple', face: 'smile', look: 'right' })}
  ${pikachu({ x: 600, y: 704, s: 1.0, mood: 'eat', arms: 'hold', hold: 'apple' })}
  ${grassTufts([[60, 740], [560, 744], [720, 720], [960, 740]])}`);

export const pictures = [
  { name: 'ch1-1', svg: walk },
  { name: 'ch1-2', svg: stuck },
  { name: 'ch1-3', svg: bonk },
  { name: 'ch1-4', svg: lunch },
];
