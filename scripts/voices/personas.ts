/**
 * What each conversation partner sounds like, recorded once so it can be
 * heard anywhere.
 *
 *   npx tsx scripts/voices/personas.ts            every partner with a reference
 *   npx tsx scripts/voices/personas.ts chen lin   just these
 *
 * The partners talk live, on the Mac, through speak.py — which is no help on
 * the iPad, where choosing between them happens. So the lines each one says
 * on the Speaking page are made here, through that same worker and in the
 * same mode the conversation uses, and shipped as files in public/personas/:
 * what you hear there is what you will be talking to.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { greeting, PERSONA_LINES, PERSONAS } from '../../shared/personas';
import { localVoices } from '../../server/src/infrastructure/local-voices';

const ROOT = resolve(import.meta.dirname, '../..');
const DESIGN = join(ROOT, 'scripts/voices/design');
const OUT = join(ROOT, 'public/personas');

const name = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 12);

async function main() {
  const only = process.argv.slice(2);
  const ready = PERSONAS.filter(
    (p) =>
      (!only.length || only.includes(p.id)) &&
      ['.talk.wav', '.wav'].some((end) => existsSync(join(DESIGN, `${p.id}${end}`))),
  );
  const missing = PERSONAS.filter((p) => !ready.includes(p) && (!only.length || only.includes(p.id)));
  if (missing.length) console.log(`no reference yet for ${missing.map((p) => p.id).join(', ')} — design.py <id> talk`);

  const voices = localVoices({
    python: join(ROOT, '.cache/tts-venv/bin/python'),
    script: join(ROOT, 'scripts/voices/speak.py'),
    voices: ready.map(({ id, name: n, gender }) => ({ id, name: n, gender })),
    cwd: ROOT,
  });

  const indexFile = join(OUT, 'index.json');
  const index: Record<string, Array<{ zh: string; en: string; file: string }>> = existsSync(indexFile)
    ? (JSON.parse(readFileSync(indexFile, 'utf8')) as { lines: Record<string, Array<{ zh: string; en: string; file: string }>> }).lines
    : {};

  try {
    for (const p of ready) {
      const dir = join(OUT, p.id);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const lines = [greeting(p), ...PERSONA_LINES];
      index[p.id] = [];
      for (const line of lines) {
        const started = Date.now();
        try {
          // The worker already tries three temperatures; a line it gives up on
          // is asked for again, as a learner would ask again, a couple of times.
          let mp3: Uint8Array | null = null;
          for (let go = 0; go < 3 && !mp3; go++) mp3 = await voices.synthesize(line.zh, p.id, 'conversation').catch(() => null);
          if (!mp3) throw new Error('the model said nothing usable');
          const file = `${p.id}/${name(line.zh)}.mp3`;
          writeFileSync(join(OUT, file), mp3);
          index[p.id]!.push({ zh: line.zh, en: line.en, file });
          console.log(`  ${p.id}  ${line.zh}  ${((Date.now() - started) / 1000).toFixed(1)}s`);
        } catch (err) {
          console.log(`  ${p.id}  ${line.zh}  failed: ${(err as Error).message}`);
        }
      }
    }
  } finally {
    voices.close();
  }
  // Only partners that still exist, in the order the page shows them.
  const lines = Object.fromEntries(PERSONAS.filter((p) => index[p.id]?.length).map((p) => [p.id, index[p.id]]));
  writeFileSync(indexFile, JSON.stringify({ lines }, null, 1) + '\n');
}

void main();
