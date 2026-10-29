/**
 * 皮卡丘饿了, chapters 2 (河里的大鱼) and 3 (城里的比赛), drawn by hand with
 * the kit (see ../BRIEF.md).
 */
import {
  ash, boot, boy, bunting, handOf, cake, clockPost, counter, figure, flowers, grassTufts, hills, marks, medal, pikachu, pine,
  plates, reeds, river, rock, rod, room, shopFront, sky, splash, svg, thought, townFar, bolt, INK, W, H,
} from '../kit.mjs';

const bank = (y, colour = '#b9d59c') => `<path d="M0 ${y} C240 ${y - 16} 600 ${y + 14} ${W} ${y - 8} L${W} ${H} L0 ${H} Z" fill="${colour}" filter="url(#wash)"/>
  <path d="M0 ${y} C240 ${y - 16} 600 ${y + 14} ${W} ${y - 8}" stroke="#93b878" stroke-width="5" fill="none"/>`;
const pavement = (y) => `<rect y="${y}" width="${W}" height="${H - y}" fill="#e6dccb"/><path d="M0 ${y} H${W}" stroke="${INK}" stroke-width="2.5"/>
  ${Array.from({ length: 4 }, (_, i) => `<path d="M0 ${y + 50 + i * 60} H${W}" stroke="#d2c6b2" stroke-width="2"/>`).join('')}
  ${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 96 + (i % 2) * 40} ${y} l-30 ${H - y}" stroke="#d2c6b2" stroke-width="2"/>`).join('')}`;

/* ------------------------------------------------------------ chapter 2 */

const boy1 = { x: 650, y: 706, s: 1.15, legs: 'brace', arms: 'pull', lean: -10, face: 'worried' };

/** ¶1 At the river a boy is being pulled in by something on his line; Ash and Pikachu run to help. */
const c2p1 = svg(`${sky('#d4eaf2', '#f2f2e0')}
  ${hills(400, '#cfe0c6', 22, 2)}${pine(90, 440, 220, '#9cc2a0')}${pine(960, 440, 200, '#9cc2a0')}
  ${river(440, 600)}
  ${reeds(880, 600, 1)}${reeds(40, 610, 0.8)}
  ${bank(600)}
  ${splash(860, 520, 1.1)}
  ${grassTufts([[120, 730], [480, 740], [930, 720]])}${flowers([[60, 700, '#f6f0e8'], [990, 740, '#f2a6b4']])}
  ${pikachu({ x: 120, y: 712, s: 0.92, mood: 'worried', arms: 'run' })}
  ${ash({ x: 310, y: 706, s: 1.12, legs: 'run', arms: 'run', face: 'determined', look: 'right' })}
  ${marks.speed(220, 520, 3, 50)}
  ${boy(boy1)}
  ${rod(...handOf('boy', boy1), 830, 452, 860, 516)}
  ${marks.sweat(610, 450)}`);

const ash2 = { x: 480, y: 708, s: 1.08, legs: 'brace', arms: 'pull', lean: -14, face: 'determined' };
const boy2 = { x: 660, y: 708, s: 1.12, legs: 'brace', arms: 'pull', lean: -10, face: 'determined' };
// Pikachu holds on to the back of Ash's jacket: its right paw at Ash's left side.
const pikaX = 480 - 36 * 1.08 - 48 * 0.95 + 6;

/** ¶2 The tug-of-war: Pikachu pulls Ash, Ash pulls the boy, the boy holds the rod. */
const c2p2 = svg(`${sky('#d8ecf2', '#f4f2de')}
  ${hills(400, '#d2e2c8', 20, 4)}${pine(70, 440, 200, '#9cc2a0')}
  ${river(440, 610)}
  ${reeds(960, 612, 0.9)}
  ${bank(610)}
  ${splash(900, 520, 1.2)}
  ${grassTufts([[60, 740], [960, 730]])}
  ${pikachu({ x: pikaX, y: 712, s: 0.95, mood: 'worried', arms: 'reach' })}
  ${ash(ash2)}
  ${boy(boy2)}
  ${rod(...handOf('boy', boy2), 850, 446, 900, 516)}
  ${marks.sweat(430, 430)}${marks.sweat(700, 470)}
  <path d="M200 640 h-40 M206 668 h-30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);

const boy3 = { x: 540, y: 706, s: 1.15, legs: 'cross', arms: { a: [[-128, -150], [150, 166]], layer: 'back' }, face: 'shock', hair: true };

/** ¶3 It is a boot, not a fish; Ash and the boy end up in the water, hair on end; Pikachu sparks with joy. */
const c2p3 = svg(`${sky('#e3eee6', '#f6f0dc')}
  ${hills(330, '#d2e0c6', 18, 1)}${pine(980, 360, 180, '#9cc2a0')}
  ${bank(360, '#c2d9a8')}
  ${river(400, H)}
  ${rock(840, 600, 200, 110)}
  ${pikachu({ x: 840, y: 556, s: 0.95, mood: 'laugh', arms: 'up', spark: true, shadowless: true })}
  ${rod(...handOf('boy', boy3), 712, 236, 712, 286)}
  ${boot(700, 376, 1.05)}
  ${ash({ x: 250, y: 700, s: 1.05, legs: 'cross', arms: 'surprise', face: 'shock', hair: true })}
  ${boy(boy3)}
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
  ${ash({ x: 400, y: 706, s: 1.1, arms: 'fist', face: 'determined' })}
  ${boy({ x: 640, y: 706, s: 1.15, arms: 'point', face: 'happy', look: 'right' })}
  ${marks.shout(470, 380)}`);

/* ------------------------------------------------------------ chapter 3 */

/** ¶1 A street of shops; Pikachu spots the cake shop and dashes for it; Ash runs after. */
const c3p1 = svg(`${sky('#d6e9f0', '#f6f1e2')}
  ${shopFront(14, 520, 220, 300, '#efe1c4', '#7fb3d5')}${shopFront(256, 520, 260, 330, '#f8e4e8', '#e9879e', true)}
  ${shopFront(538, 520, 220, 280, '#e2ead2', '#86b56f')}${shopFront(780, 520, 232, 310, '#f2e3c6', '#e0a54a')}
  ${pavement(520)}
  ${pikachu({ x: 400, y: 690, s: 0.95, mood: 'up', arms: 'run', tilt: -10 })}
  ${marks.speed(560, 600, 3, 60)}
  ${ash({ x: 720, y: 704, s: 1.12, flip: true, legs: 'run', arms: 'reach', face: 'shock' })}
  ${marks.sweat(770, 430)}`);

/** ¶2 The square with the clock: Ash searches, worried; the contest is about to start. */
const c3p2 = svg(`${sky('#d9e8ef', '#f4efe0')}
  ${shopFront(-20, 470, 220, 260, '#efe1c4', '#7fb3d5')}${shopFront(824, 470, 220, 270, '#f2e3c6', '#e0a54a')}
  ${pavement(470)}
  ${clockPost(560, 520, 210)}
  ${figure('walker2', { x: 220, y: 690, s: 0.88, face: 'smile', look: 'left' })}
  ${figure('walker1', { x: 830, y: 700, s: 0.92, legs: 'walk', face: 'smile', look: 'right' })}
  ${ash({ x: 470, y: 712, s: 1.12, arms: 'shade', face: 'worried', look: 'left' })}
  ${marks.sweat(420, 440)}${marks.sweat(540, 450)}`);

const ash33 = { x: 300, y: 712, s: 1.12, legs: 'brace', arms: { a: [[86, 96], [94, 104]], layer: 'front' }, lean: -12, face: 'determined' };
const grab = handOf('ash', ash33, 1);

/** ¶3 In the cake shop: Pikachu, covered in cream, hugs a cake on the counter and won't budge; Ash pulls. */
const c3p3 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  <rect x="60" y="250" width="904" height="12" fill="#c99a6a" stroke="${INK}" stroke-width="2.5"/>
  ${[140, 280, 420, 600, 740, 880].map((x) => cake(x, 250, 0.6)).join('')}
  ${counter(120, 920, 540, '#c99a6a', '#b4835a', 100)}
  ${pikachu({ x: grab[0] + 30, y: 540, s: 1.0, mood: 'eat', arms: 'down', cream: true, shadowless: true })}
  ${ash(ash33)}
  ${marks.sweat(290, 440)}`);

/** ¶4 The shop people laugh: this is the cake-eating contest; Ash is astonished. */
const c3p4 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  ${bunting(40, 984, 110)}
  ${counter(320, 1000, 440, '#c99a6a', '#b4835a', 130)}
  ${[400, 520, 640, 760, 880].map((x) => cake(x, 426, 0.72)).join('')}
  ${figure('baker', { x: 560, y: 712, s: 1.0, arms: 'clap', face: 'laugh' })}
  ${figure('cook', { x: 800, y: 712, s: 1.0, arms: 'fist', face: 'laugh' })}
  ${ash({ x: 210, y: 712, s: 1.14, arms: 'surprise', face: 'shock' })}
  <path d="M150 420 l-16 -14 M200 400 v-22 M250 420 l16 -14" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`);

/** ¶5 Ten cakes and first place: a stack of plates, a medal, the biggest cake — and Ash with a fork. */
const c3p5 = svg(`${room('#fbeee8', '#e9879e', '#ead9c2', 560)}
  ${bunting(40, 984, 110)}
  ${counter(60, 760, 470)}
  ${plates(170, 452, 10)}
  ${pikachu({ x: 330, y: 458, s: 1.0, mood: 'full', arms: 'belly', shadowless: true })}
  ${medal(330, 424, 0.85)}
  ${cake(560, 456, 1.9)}
  ${figure('baker', { x: 70, y: 720, s: 0.95, arms: 'clap', face: 'happy' })}
  ${ash({ x: 860, y: 712, s: 1.12, flip: true, arms: 'fork', hold: 'fork', face: 'laugh' })}
  ${marks.star(700, 300, 14)}${marks.star(470, 250, 10)}`);

export const pictures = [
  { name: 'ch2-1', svg: c2p1 }, { name: 'ch2-2', svg: c2p2 }, { name: 'ch2-3', svg: c2p3 }, { name: 'ch2-4', svg: c2p4 },
  { name: 'ch3-1', svg: c3p1 }, { name: 'ch3-2', svg: c3p2 }, { name: 'ch3-3', svg: c3p3 }, { name: 'ch3-4', svg: c3p4 }, { name: 'ch3-5', svg: c3p5 },
];
