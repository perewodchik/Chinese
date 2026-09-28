/**
 * Renders every line the scripts can say, in each speaker's voice, to
 * `public/world/voice/<key>.mp3` (prompt G2), through the local voice worker
 * (`scripts/voices/speak.py`, the Qwen voices of the app's voice pack).
 * Resumable: a clip already there is not made again. Writes `index.json`,
 * the keys that exist, so the page never asks for a missing file.
 *
 *   npx tsx scripts/world/build-voices.ts [--dry]
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { DEFAULT_MISSES, DONT_KNOW, explanationLine, NOT_CHINESE } from '../../src/world/core/dialogue/scripted';
import { POLITE_REPLY } from '../../src/world/core/dialogue/universal';
import { allCalls } from '../../src/world/core/ride';
import type { DistrictContent } from '../../src/world/core/types';
import { voiceKey, voiceOf, type VoiceId } from '../../src/world/core/voice';
import { checkContent, readLibrary } from './check-content';

export const VOICE_OUT = 'public/world/voice';

export interface Clip {
  key: string;
  voice: VoiceId;
  text: string;
}

/** Every (voice, text) a script can make someone say: lines, simpler lines, and each person's stock replies. */
export function clipsOf(districts: readonly DistrictContent[]): Clip[] {
  const cards = new Map(districts.flatMap((d) => d.npcs).map((n) => [n.id, n]));
  const out = new Map<string, Clip>();
  const add = (speaker: string, text: string) => {
    const voice = voiceOf(speaker, cards);
    if (!voice || !text.trim()) return;
    const key = voiceKey(voice, text);
    out.set(key, { key, voice, text });
  };
  for (const d of districts) {
    for (const s of d.scenes) {
      for (const n of s.nodes) {
        const who = n.speaker ?? s.npc ?? 'companion';
        add(who, n.say);
        if (n.simpler) add(who, n.simpler);
      }
      if (!s.npc) continue;
      const card = cards.get(s.npc);
      for (const m of card?.misses?.length ? card.misses : DEFAULT_MISSES) add(s.npc, m);
      for (const r of Object.values(POLITE_REPLY)) add(s.npc, r.zh);
      add(s.npc, NOT_CHINESE.zh);
      add(s.npc, DONT_KNOW.zh);
      for (const [w, e] of Object.entries(card?.explains ?? {})) add(s.npc, explanationLine(w, e));
      for (const w of s.words ?? []) add(s.npc, explanationLine(w.w, w.explain));
    }
  }
  // the train's calls, in the announcer's voice
  for (const c of allCalls()) add('announcer', c);
  return [...out.values()];
}

async function render(clips: Clip[]): Promise<number> {
  const todo = clips.filter((c) => !existsSync(join(VOICE_OUT, `${c.key}.mp3`)));
  if (!todo.length) return 0;
  const py = spawn('.cache/tts-venv/bin/python', ['scripts/voices/speak.py'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: py.stdout });
  const waiting = new Map<string, (a: { mp3?: string; error?: string }) => void>();
  lines.on('line', (l) => {
    try {
      const a = JSON.parse(l) as { id: string; mp3?: string; error?: string };
      waiting.get(a.id)?.(a);
      waiting.delete(a.id);
    } catch {
      /* not an answer */
    }
  });
  let made = 0;
  for (const c of todo) {
    const answer = await new Promise<{ mp3?: string; error?: string }>((resolve) => {
      waiting.set(c.key, resolve);
      py.stdin.write(JSON.stringify({ id: c.key, text: c.text, voice: c.voice, mode: 'conversation' }) + '\n');
    });
    if (answer.mp3) {
      writeFileSync(join(VOICE_OUT, `${c.key}.mp3`), Buffer.from(answer.mp3, 'base64'));
      made++;
      console.log(`${made}/${todo.length} ${c.voice} ${c.text}`);
    } else console.log(`skip ${c.voice} ${c.text}: ${answer.error}`);
  }
  py.stdin.end();
  return made;
}

export function writeIndex() {
  const keys = existsSync(VOICE_OUT) ? readdirSync(VOICE_OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort() : [];
  writeFileSync(join(VOICE_OUT, 'index.json'), JSON.stringify(keys) + '\n');
  return keys.length;
}

async function main() {
  const clips = clipsOf(checkContent('content/world', readLibrary()).districts);
  mkdirSync(VOICE_OUT, { recursive: true });
  if (process.argv.includes('--dry')) {
    const missing = clips.filter((c) => !existsSync(join(VOICE_OUT, `${c.key}.mp3`)));
    console.log(`${clips.length} clips, ${missing.length} to make`);
    return;
  }
  await render(clips);
  console.log(`${writeIndex()} clips in ${VOICE_OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
