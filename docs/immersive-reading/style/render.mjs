// Renders the style studies to JPEG: node docs/immersive-reading/style/render.mjs <out dir> [name filter]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/home/user/Chinese/');
const { chromium } = require('playwright');
const { studies } = await import(new URL('./art.mjs?' + Date.now(), import.meta.url));
const [out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
for (const { name, svg } of studies) {
  if (only && !name.includes(only)) continue;
  await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 86 });
  console.log(name);
}
await b.close();
