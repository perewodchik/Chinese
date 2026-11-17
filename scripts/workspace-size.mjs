/**
 * How big each account's workspace is, by part (R8, step 1): texts, the
 * schedule, activity, videos and the rest — what to move out of the one
 * document first, before the 4.5 MB a request may carry on Vercel is near.
 *
 *   node scripts/workspace-size.mjs .data/local.db
 *   node scripts/workspace-size.mjs my-export.json      (Account › Your data › Download a copy)
 *
 * Reads a local SQLite file or a downloaded copy only: never the deployed
 * site's database.
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const source = process.argv[2];
if (!source) {
  console.error('Give a local .db file or a downloaded copy (.json).');
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1).padStart(8)} KB`;
const size = (v) => Buffer.byteLength(JSON.stringify(v ?? null));

function report(name, doc) {
  const total = size(doc);
  console.log(`\n${name}: ${kb(total)} in all`);
  const parts = Object.entries(doc)
    .map(([k, v]) => [k, size(v)])
    .sort((a, b) => b[1] - a[1]);
  for (const [k, n] of parts.slice(0, 12)) console.log(`  ${k.padEnd(14)} ${kb(n)}  ${Math.round((n / total) * 100)}%`);
  const texts = Array.isArray(doc.texts) ? doc.texts : [];
  if (texts.length) {
    const biggest = texts.map((t) => [t.titleZh || t.title, size(t)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  ${texts.length} texts; the largest: ${biggest.map(([t, n]) => `${t} ${(n / 1024).toFixed(0)} KB`).join(', ')}`);
  }
}

if (source.endsWith('.json')) {
  const copy = JSON.parse(readFileSync(source, 'utf8'));
  report(source, copy.workspace?.document ?? copy.workspace ?? copy);
} else {
  const db = new DatabaseSync(source, { readOnly: true });
  const rows = db.prepare('SELECT u.username, w.document FROM workspaces w JOIN users u ON u.id = w.user_id').all();
  for (const r of rows) report(r.username, JSON.parse(r.document));
}
