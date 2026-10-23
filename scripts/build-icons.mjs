// Draw the app's icons: 写 written in blue ink in one 田字格 square of an
// exercise book.
//
// The app is 练习本, the exercise book (see the hanzi-design skill), and its
// mark is 写 in WenKai, so the icon is a page of that book: the paper, one
// square ruled in the grid's green — a solid frame and the dashed cross — and
// 写 in the blue ink of everything the learner does. No red: the red pen is
// the teacher's, for what is new or wrong. The maskable one (Android crops it
// to any shape) keeps the square inside the middle 80%; the favicon drops the
// cross, which would be noise at 16px.
//
//   node scripts/build-icons.mjs
//
// Writes public/icons/*.png with the Chromium Playwright brings. Run it again
// only when the design changes; the PNGs are committed.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// The light theme's tokens (src/styles.css): an icon has no dark mode.
const PAPER = '#fafbf8';
const GRID = '#a4c7b1';
const INK = '#1e4a8a';

const font = readFileSync('public/fonts/wenkai.ttf').toString('base64');

/** One icon: the square's inset, the glyph's size and the rule weights, all as shares of the side. */
const ICONS = [
  { name: 'icon-512.png', size: 512, inset: 0.12, glyph: 0.6, cross: true },
  { name: 'icon-192.png', size: 192, inset: 0.12, glyph: 0.6, cross: true },
  { name: 'apple-touch-icon.png', size: 180, inset: 0.12, glyph: 0.6, cross: true },
  { name: 'icon-maskable-512.png', size: 512, inset: 0.2, glyph: 0.46, cross: true },
  { name: 'favicon-64.png', size: 64, inset: 0.06, glyph: 0.78, cross: false },
];

function page({ size, inset, glyph, cross }) {
  const s = size;
  const i = s * inset;
  const side = s - 2 * i;
  const frame = Math.max(1.5, s * 0.022);
  const dash = Math.max(1, s * 0.01);
  const c = s / 2;
  return `<!doctype html><html><head><style>
    @font-face { font-family: WenKai; src: url(data:font/ttf;base64,${font}); }
    html, body { margin: 0; background: ${PAPER}; }
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${PAPER}"/>
    ${
      cross
        ? `<g stroke="${GRID}" stroke-width="${dash}" stroke-dasharray="${dash * 3} ${dash * 2.4}">
            <line x1="${i}" y1="${c}" x2="${s - i}" y2="${c}"/>
            <line x1="${c}" y1="${i}" x2="${c}" y2="${s - i}"/>
          </g>`
        : ''
    }
    <rect x="${i}" y="${i}" width="${side}" height="${side}" rx="${s * 0.03}" fill="none"
      stroke="${GRID}" stroke-width="${frame}"/>
    <text id="g" x="${c}" y="${c}" font-family="WenKai" font-size="${s * glyph}" fill="${INK}"
      stroke="${INK}" stroke-width="${s * 0.01}" stroke-linejoin="round"
      >写</text>
  </svg></body></html>`;
}

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const p = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await p.setContent(page(icon));
    await p.evaluate(() => document.fonts.ready);
    // Centred on its ink rather than its em box, so 写 sits in the middle of the square.
    await p.evaluate(({ size, glyph }) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${size * glyph}px WenKai`;
      const m = ctx.measureText('写');
      const g = document.getElementById('g');
      g.setAttribute('x', String(size / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2));
      g.setAttribute('y', String(size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2));
    }, { size: icon.size, glyph: icon.glyph });
    await p.screenshot({ path: `public/icons/${icon.name}`, omitBackground: false });
    await p.close();
    console.log(`public/icons/${icon.name}`);
  }
} finally {
  await browser.close();
}
