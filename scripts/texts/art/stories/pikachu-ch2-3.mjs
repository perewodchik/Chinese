/**
 * 皮卡丘饿了, chapters 2 (河里的大鱼) and 3 (城里的比赛), drawn by hand with
 * the kit (see ../BRIEF.md).
 */
import {
  ash, boot, boy, bunting, cake, clockPost, counter, figure, flowers, grassTufts, hills, marks, medal, pikachu, pine,
  plates, reeds, river, rock, rod, room, shopFront, sky, splash, svg, thought, townFar, bolt, INK, W, H,
} from '../kit.mjs';

const bank = (y, colour = '#b9d59c') => `<path d="M0 ${y} C240 ${y - 16} 600 ${y + 14} ${W} ${y - 8} L${W} ${H} L0 ${H} Z" fill="${colour}" filter="url(#wash)"/>
  <path d="M0 ${y} C240 ${y - 16} 600 ${y + 14} ${W} ${y - 8}" stroke="#93b878" stroke-width="5" fill="none"/>`;
const pavement = (y) => `<rect y="${y}" width="${W}" height="${H - y}" fill="#e6dccb"/><path d="M0 ${y} H${W}" stroke="${INK}" stroke-width="2.5"/>
  ${Array.from({ length: 4 }, (_, i) => `<path d="M0 ${y + 50 + i * 60} H${W}" stroke="#d2c6b2" stroke-width="2"/>`).join('')}
  ${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 96 + (i % 2) * 40} ${y} l-30 ${H - y}" stroke="#d2c6b2" stroke-width="2"/>`).join('')}`;

/* ------------------------------------------------------------ chapter 2 */

/** ¶1 At the river a boy is being pulled in by something on his line; Ash and Pikachu run to help. */
const c2p1 = svg(`${sky('#d4eaf2', '#f2f2e0')}
  ${hills(400, '#cfe0c6', 22, 2)}${pine(90, 440, 220, '#9cc2a0')}${pine(960, 440, 200, '#9cc2a0')}
  ${river(440, 600)}
  ${reeds(880, 600, 1)}${reeds(40, 610, 0.8)}
  ${bank(600)}
  ${splash(860, 520, 1.1)}
  ${grassTufts([[120, 730], [480, 740], [930, 720]])}${flowers([[60, 700, '#f6f0e8'], [990, 740, '#f2a6b4']])}
  ${pikachu({ x: 120, y: 712, s: 0.92, mood: 'worried', arms: 'run' })}
  ${ash({ x: 310, y: 706, s: 1.12, pose: 'run', face: 'determined', arms: [[[-46, -128], [-70, -112]], [[44, -128], [58, -160]]] })}
  ${marks.speed(220, 520, 3, 50)}
  ${boy({ x: 650, y: 706, s: 1.15, pose: 'brace', front: true, face: 'worried', arms: [[[-14, -112], [24, -126]], [[40, -118], [36, -130]]] })}
  ${rod(678, 590, 830, 452, 860, 516)}
  ${marks.sweat(610, 450)}`);

/** ¶2 The tug-of-war: Pikachu pulls Ash, Ash pulls the boy, the boy holds the rod. */
const c2p2 = svg(`${sky('#d8ecf2', '#f4f2de')}
  ${hills(400, '#d2e2c8', 20, 4)}${pine(70, 440, 200, '#9cc2a0')}
  ${river(440, 610)}
  ${reeds(960, 612, 0.9)}
  ${bank(610)}
  ${splash(900, 520, 1.2)}
  ${grassTufts([[60, 740], [960, 730]])}
  ${pikachu({ x: 384, y: 712, s: 0.95, mood: 'worried', arms: 'reach', tilt: -6 })}
  ${ash({ x: 470, y: 708, s: 1.08, pose: 'brace', front: true, face: 'determined', arms: [[[30, -118], [70, -110]], [[46, -112], [92, -104]]] })}
  ${boy({ x: 660, y: 708, s: 1.12, pose: 'brace', front: true, face: 'determined', arms: [[[-14, -112], [24, -126]], [[40, -118], [36, -130]]] })}
  ${rod(686, 594, 850, 446, 900, 516)}
  ${marks.sweat(430, 430)}${marks.sweat(700, 470)}
  <path d="M200 640 h-40 M206 668 h-30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);

/** ¶3 It is a boot, not a fish; Ash and the boy end up in the water, hair on end; Pikachu sparks with joy. */
const c2p3 = svg(`${sky('#e3eee6', '#f6f0dc')}
  ${hills(330, '#d2e0c6', 18, 1)}${pine(980, 360, 180, '#9cc2a0')}
  ${bank(360, '#c2d9a8')}
  ${river(400, H)}
  ${rock(840, 600, 200, 110)}
  ${pikachu({ x: 840, y: 556, s: 0.95, mood: 'laugh', arms: 'up', spark: true, shadowless: true })}
  ${rod(632, 616, 712, 236, 712, 286)}
  ${boot(700, 376, 1.05)}
  ${ash({ x: 250, y: 700, s: 1.05, pose: 'sit', face: 'shock', hair: true, arms: [[[-36, -118], [-56, -96]], [[36, -118], [56, -96]]] })}
  ${boy({ x: 540, y: 706, s: 1.15, pose: 'sit', face: 'shock', hair: true, arms: [[[-36, -118], [-56, -96]], [[52, -128], [88, -140]]] })}
  ${bolt(200, 420, 1, 0.8)}${bolt(330, 430, -1, 0.8)}${bolt(530, 470, 1, 0.7)}${bolt(640, 470, -1, 0.7)}
  <rect y="650" width="${W}" height="${H - 650}" fill="#9fcbe0" opacity="0.7"/>
  <path d="M0 650 C200 640 400 660 600 648 C800 638 900 656 ${W} 646" stroke="#e6f4fa" stroke-width="5" fill="none"/>`);

/** ¶4 Evening: the boy points to the town and tomorrow's contest; Ash is all for it; Pikachu only wants dinner. */
const c2p4 = svg(`<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4c8a6"/><stop offset="1" stop-color="#fbe9cf"/></linearGradient>
  <rect width="${W}" height="${H}" fill="url(#dusk)"/>
  <circle cx="840" cy="420" r="70" fill="#f7b46a" opacity="0.8" filter="url(#blur6)"/>
  ${townFar(620, 470)}
  ${hills(470, '#c4c79c', 10, 2)}
  ${river(480, 560, '#a8c4cc')}
  ${bank(560, '#b4c98e')}
  ${grassTufts([[80, 730], [940, 720]], '#8aa564')}
  ${pikachu({ x: 150, y: 712, s: 0.95, mood: 'worried', arms: 'belly' })}
  ${thought(196, 560, 250, 460, cake(250, 488, 0.62))}
  ${ash({ x: 400, y: 706, s: 1.1, face: 'determined', front: false, arms: [[[-36, -118], [-40, -92]], [[44, -176], [36, -244]]] })}
  ${boy({ x: 640, y: 706, s: 1.15, face: 'happy', look: 'right', arms: [[[-36, -118], [-40, -92]], [[48, -150], [96, -186]]] })}
  ${marks.shout(470, 380)}`);

/* ------------------------------------------------------------ chapter 3 */

/** ¶1 A street of shops; Pikachu spots the cake shop and dashes for it; Ash runs after. */
const c3p1 = svg(`${sky('#d6e9f0', '#f6f1e2')}
  ${shopFront(14, 520, 220, 300, '#efe1c4', '#7fb3d5')}${shopFront(256, 520, 260, 330, '#f8e4e8', '#e9879e', true)}
  ${shopFront(538, 520, 220, 280, '#e2ead2', '#86b56f')}${shopFront(780, 520, 232, 310, '#f2e3c6', '#e0a54a')}
  ${pavement(520)}
  ${pikachu({ x: 400, y: 690, s: 0.95, mood: 'up', arms: 'run', tilt: -10 })}
  ${marks.speed(560, 600, 3, 60)}
  ${ash({ x: 720, y: 704, s: 1.12, flip: true, pose: 'run', face: 'shock', arms: [[[-46, -128], [-70, -112]], [[50, -140], [96, -150]]] })}
  ${marks.sweat(770, 430)}`);

/** ¶2 The square with the clock: Ash searches, worried; the contest is about to start. */
const c3p2 = svg(`${sky('#d9e8ef', '#f4efe0')}
  ${shopFront(-20, 470, 220, 260, '#efe1c4', '#7fb3d5')}${shopFront(824, 470, 220, 270, '#f2e3c6', '#e0a54a')}
  ${pavement(470)}
  ${clockPost(560, 520, 210)}
  ${figure('walker2', { x: 220, y: 690, s: 0.88, face: 'smile', look: 'left' })}
  ${figure('walker1', { x: 830, y: 700, s: 0.92, pose: 'walk', face: 'smile', look: 'right' })}
  ${ash({ x: 470, y: 712, s: 1.12, front: true, face: 'worried', look: 'left', arms: [[[-36, -118], [-40, -92]], [[46, -150], [12, -198]]] })}
  ${marks.sweat(420, 440)}${marks.sweat(540, 450)}`);

/** ¶3 In the cake shop: Pikachu, covered in cream, hugs a cake on the counter and won't budge; Ash pulls. */
const c3p3 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  <rect x="60" y="250" width="904" height="12" fill="#c99a6a" stroke="${INK}" stroke-width="2.5"/>
  ${[140, 280, 420, 600, 740, 880].map((x) => cake(x, 250, 0.6)).join('')}
  ${counter(120, 920, 470)}
  ${pikachu({ x: 486, y: 458, s: 1.0, mood: 'eat', arms: 'hold', hold: 'cake', cream: true, shadowless: true })}
  ${ash({ x: 320, y: 712, s: 1.12, pose: 'brace', front: true, face: 'determined', arms: [[[40, -160], [96, -196]], [[54, -150], [120, -206]]] })}
  ${marks.sweat(290, 440)}`);

/** ¶4 The shop people laugh: this is the cake-eating contest; Ash is astonished. */
const c3p4 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  ${bunting(40, 984, 110)}
  ${counter(320, 1000, 440, '#c99a6a', '#b4835a', 130)}
  ${[400, 520, 640, 760, 880].map((x) => cake(x, 426, 0.72)).join('')}
  ${figure('baker', { x: 560, y: 712, s: 1.0, face: 'laugh', front: true, arms: [[[-36, -118], [-6, -100]], [[36, -118], [6, -98]]] })}
  ${figure('cook', { x: 800, y: 712, s: 1.0, face: 'laugh', arms: [[[-36, -118], [-40, -92]], [[44, -150], [70, -186]]] })}
  ${ash({ x: 210, y: 712, s: 1.14, face: 'shock', arms: [[[-46, -140], [-60, -170]], [[46, -140], [60, -170]]] })}
  <path d="M150 420 l-16 -14 M200 400 v-22 M250 420 l16 -14" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`);

/** ¶5 Ten cakes and first place: a stack of plates, a medal, the biggest cake — and Ash with a fork. */
const c3p5 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  ${bunting(40, 984, 110)}
  ${counter(60, 760, 470)}
  ${plates(170, 452, 10)}
  ${pikachu({ x: 330, y: 458, s: 1.0, mood: 'full', arms: 'belly', shadowless: true })}
  ${medal(330, 424, 0.85)}
  ${cake(560, 456, 1.9)}
  ${figure('baker', { x: 70, y: 720, s: 0.95, face: 'happy', front: true, arms: [[[-30, -130], [-6, -150]], [[30, -130], [8, -156]]] })}
  ${ash({ x: 860, y: 712, s: 1.12, flip: true, face: 'laugh', hold: 'fork', arms: [[[-36, -118], [-40, -92]], [[44, -150], [40, -196]]] })}
  ${marks.star(700, 300, 14)}${marks.star(470, 250, 10)}`);

export const pictures = [
  { name: 'ch2-1', svg: c2p1 }, { name: 'ch2-2', svg: c2p2 }, { name: 'ch2-3', svg: c2p3 }, { name: 'ch2-4', svg: c2p4 },
  { name: 'ch3-1', svg: c3p1 }, { name: 'ch3-2', svg: c3p2 }, { name: 'ch3-3', svg: c3p3 }, { name: 'ch3-4', svg: c3p4 }, { name: 'ch3-5', svg: c3p5 },
];
