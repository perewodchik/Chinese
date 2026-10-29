/**
 * Renders a scene module's pictures to JPEG through Chromium:
 *   node scripts/texts/art/render.mjs <scenes.mjs> <out dir>
 * The module exports `pictures`: [{ name, svg }].
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [scenes, out] = process.argv.slice(2);
const { pictures } = await import(pathToFileURL(resolve(scenes)).href);
const require = createRequire(`${process.env.GROOT ?? process.cwd()}/`);
const { chromium } = require('playwright');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
for (const { name, svg } of pictures) {
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 });
  console.log(`${out}/${name}.jpg`);
}
await browser.close();
