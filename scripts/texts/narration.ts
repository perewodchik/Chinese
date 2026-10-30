/**
 * A text read aloud on a voice service's own site, brought back as one
 * recording and cut into its sentences.
 *
 * The learner copies the text's narrator script (src/domain/narration.ts:
 * every sentence followed by the same long pause) into MiniMax's Text to
 * Speech, reads it with the free credits there, and sends the recording back —
 * a downloaded MP3, or a screen recording when the site will not let a phone
 * download. This finds the long pauses, cuts the recording at them, one piece
 * a sentence, and keeps each piece as that sentence's reading in the voice
 * given, the way the home computer's voices are kept: the website then plays
 * the text in that voice, line by line.
 *
 * Needs ffmpeg.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GeneratedText } from '../../src/domain/text';

export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male';
}

/** What cutting a recording needs of an account. */
export interface RecordingAccount {
  where: string;
  read(): Promise<{ revision: number; document: unknown }>;
  putRecording(voice: VoiceInfo, text: string, mp3: Uint8Array): Promise<void>;
}

/** A stretch of silence in the recording, in seconds. */
export interface Silence {
  start: number;
  end: number;
}

/**
 * Where each sentence is: the n-1 longest silences between the first sound
 * and the last are the pauses the script put between sentences. Silence
 * before the first sentence and after the last is not a cut.
 */
export function cutsFor(silences: Silence[], duration: number, n: number): { pieces: Array<[number, number]>; shortestCut: number; longestKept: number } {
  const lead = silences.find((s) => s.start <= 0.05);
  const tail = silences.find((s) => s.end >= duration - 0.05);
  const from = lead ? lead.end : 0;
  const to = tail ? tail.start : duration;
  const inner = silences.filter((s) => s !== lead && s !== tail && s.start > from && s.end < to);
  if (inner.length < n - 1) {
    throw new Error(`The recording has ${inner.length + 1} stretches of speech between its pauses and the text has ${n} sentences: was the whole script read, with its pauses?`);
  }
  const byLength = [...inner].sort((a, b) => b.end - b.start - (a.end - a.start));
  const cuts = byLength.slice(0, n - 1).sort((a, b) => a.start - b.start);
  const kept = byLength.slice(n - 1);
  const pieces: Array<[number, number]> = [];
  let at = from;
  for (const c of cuts) {
    pieces.push([at, c.start]);
    at = c.end;
  }
  pieces.push([at, to]);
  const len = (s: Silence) => s.end - s.start;
  return { pieces, shortestCut: cuts.length ? Math.min(...cuts.map(len)) : Infinity, longestKept: kept.length ? Math.max(...kept.map(len)) : 0 };
}

function parse(log: string) {
  const silences: Silence[] = [];
  let open: number | null = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const t = Math.max(0, Number(m[2]));
    if (m[1] === 'start') open = t;
    else if (open !== null) {
      silences.push({ start: open, end: t });
      open = null;
    }
  }
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  if (open !== null) silences.push({ start: open, end: duration });
  return { silences, duration };
}

/** Runs ffmpeg quietly; what went wrong, if it did. */
function ffmpeg(args: string[]) {
  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    throw new Error(`ffmpeg could not cut the recording: ${(err as Error).message.split('\n')[0]}`);
  }
}

/** The silences ffmpeg hears in a recording, and its length. ffmpeg tells these on stderr. */
function listen(file: string) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'silencedetect=noise=-40dB:d=0.3', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.error) throw new Error('ffmpeg is not on this machine.');
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${(r.stderr ?? '').split('\n').filter(Boolean).pop() ?? ''}`);
  return parse(r.stderr ?? '');
}

/** The recording cut into one MP3 a sentence, a little room left on each side. */
export function cut(file: string, n: number): { pieces: Array<{ mp3: Uint8Array; from: number; to: number }>; shortestCut: number; longestKept: number } {
  const probe = listen(file);
  const { pieces, shortestCut, longestKept } = cutsFor(probe.silences, probe.duration, n);
  const dir = mkdtempSync(join(tmpdir(), 'hanzi-narration-'));
  try {
    const out = pieces.map(([from, to], i) => {
      const a = Math.max(0, from - 0.12);
      const b = Math.min(probe.duration, to + 0.22);
      const mp3 = join(dir, `${i}.mp3`);
      ffmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', file, '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
      return { mp3: new Uint8Array(readFileSync(mp3)), from: a, to: b };
    });
    return { pieces: out, shortestCut, longestKept };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The sentences a text's narrator script read, in its order — the same filter as narratorScript. */
export const sentencesOf = (text: Pick<GeneratedText, 'lines'>) => text.lines.map((l) => l.zh.trim()).filter(Boolean);

/** A voice's id from its name: "Serene" → minimax-serene. */
export const voiceId = (name: string, service = 'minimax') =>
  `${service}-${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voice'}`;

/** Cuts one text's recording and keeps each sentence's piece in the voice. */
export async function narrate(
  account: RecordingAccount,
  o: { textId: string; file: string; voice: VoiceInfo; dryRun?: boolean; say: (line: string) => void },
) {
  const { document } = await account.read();
  const texts = (document as { texts?: GeneratedText[] } | null)?.texts ?? [];
  const text = texts.find((t) => t.id === o.textId);
  if (!text) throw new Error(`No text ${o.textId} on ${account.where}.`);
  const sentences = sentencesOf(text);
  const { pieces, shortestCut, longestKept } = cut(o.file, sentences.length);
  o.say(`${text.titleZh || text.title}: ${sentences.length} sentences; pauses cut at ${shortestCut.toFixed(2)} s and longer, the longest pause kept inside a sentence ${longestKept.toFixed(2)} s.`);
  if (shortestCut < 0.8 || longestKept > shortestCut * 0.8) {
    o.say('The pauses between sentences are not clearly longer than the pauses inside them: check the pieces before trusting them.');
  }
  for (const [i, s] of sentences.entries()) {
    const p = pieces[i]!;
    o.say(`  ${i + 1}. ${(p.to - p.from).toFixed(1)} s  ${s}`);
    if (!o.dryRun) await account.putRecording(o.voice, s, p.mp3);
  }
  if (!o.dryRun) o.say(`Kept as “${o.voice.name}” on ${account.where}: Listen offers it on this text.`);
}
