/**
 * 皮卡丘饿了, chapter 1 — 森林里的苹果: the four paragraphs, drawn by hand
 * with the kit (see ../BRIEF.md).
 */
import { apple, ash, flowers, grassTufts, hills, marks, pikachu, pine, sky, svg, tree, W, H, INK } from '../kit.mjs';

const path = `<path d="M330 ${H} C380 640 470 590 520 540 C560 500 600 470 640 450 L660 452 C640 480 620 520 640 560 C660 620 720 680 760 ${H} Z" fill="#e8d6ac" filter="url(#wash)"/>
  <path d="M520 540 C560 500 600 470 640 450" stroke="#d8c290" stroke-width="3" fill="none" opacity="0.6"/>`;

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
  ${ash({ x: 440, y: 680, s: 1.3, pose: 'walk', front: true, face: 'worried', arms: [[[-34, -118], [-4, -104]], [[34, -118], [6, -98]]] })}
  ${pikachu({ x: 610, y: 690, s: 1.05, mood: 'worried', arms: 'belly' })}
  ${marks.rumble(500, 520)}${marks.rumble(650, 580)}${marks.sweat(380, 395)}`);

/** ¶2 Ash has climbed the apple tree and cannot get down; Pikachu looks up from below. */
const stuck = svg(`${sky('#d4eaf2', '#f4f2de')}
  ${hills(470, '#cfe0c6', 22, 2)}
  ${pine(80, 500, 230, '#9cc2a0')}${pine(950, 500, 220, '#8db592')}
  ${hills(560, '#b2d095', 16, 4)}
  ${tree(470, 720, 680, { apples: [[-0.9, 0.1], [-0.5, -0.4], [0.1, -0.7], [0.6, 0.4], [-0.2, 0.3], [0.9, -0.1], [-0.8, 0.6], [0.3, 0.8]] })}
  <path d="M380 196 C470 180 560 172 700 150" stroke="${INK}" stroke-width="23" fill="none" stroke-linecap="round"/>
  <path d="M380 196 C470 180 560 172 700 150" stroke="#7a573c" stroke-width="17" fill="none" stroke-linecap="round"/>
  ${ash({ x: 600, y: 480, s: 1.0, pose: 'hang', face: 'worried', look: 'front', arms: [[[-52, -200], [-34, -306]], [[52, -200], [36, -310]]] })}
  ${marks.sweat(668, 262)}${marks.sweat(532, 276)}
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
  ${ash({ x: 470, y: 700, s: 1.3, face: 'ouch', arms: [[[-46, -170], [-20, -236]], [[46, -170], [20, -238]]] })}
  ${apple(500, 330, 26)}
  ${marks.bump(470, 352)}${marks.star(400, 330, 16)}${marks.star(570, 300, 13)}${marks.star(540, 372, 10)}
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
  ${apple(460, 676, 15)}${apple(488, 680, 15)}${apple(474, 656, 15)}${apple(505, 660, 14)}
  ${ash({ x: 300, y: 690, s: 1.15, pose: 'sit', face: 'smile', look: 'right', arms: [[[-36, -118], [-40, -92]], [[40, -120], [32, -150]]], hold: 'apple' })}
  ${pikachu({ x: 610, y: 700, s: 1.0, mood: 'eat', arms: 'hold', hold: 'apple' })}
  ${grassTufts([[60, 740], [560, 740], [720, 720], [960, 740]])}`);

export const pictures = [
  { name: 'ch1-1', svg: walk },
  { name: 'ch1-2', svg: stuck },
  { name: 'ch1-3', svg: bonk },
  { name: 'ch1-4', svg: lunch },
];
