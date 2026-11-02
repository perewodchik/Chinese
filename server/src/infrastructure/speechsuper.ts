import { createHash } from 'node:crypto';
import type { EvalResult, SpeechSuperKeys, Strictness, SyllableEval } from '../../../shared/speechEval';
import { EvaluatorRefused } from './iflytek';

/**
 * SpeechSuper's pronunciation assessment for Mandarin, over plain HTTP: one
 * multipart POST carrying the request (signed with SHA-1 over the app key, a
 * timestamp and the secret) and the recording as a WAV, answered with JSON.
 *
 *   POST https://api.speechsuper.com/sent.eval.promax.cn
 *
 * sent.eval.promax.cn scores up to 400 characters: per character the tone
 * (and the tone it sounded like), each phone 0–100 with what it sounded like,
 * the tone it takes here after sandhi, pauses, left-out characters; for the
 * whole, rhythm, speed and whether the voice rose or fell at the end.
 * refPinyin gives each character's reading, for the ones it would otherwise
 * read another way (卡 in 皮卡丘 is ka3, not qia3); slack is how forgiving.
 */

const BASE = 'https://api.speechsuper.com';
const CORE = 'sent.eval.promax.cn';
const USER = 'hanzi';

/** How forgiving the service is, and below what a syllable's part counts as wrong. */
const SLACK: Record<Strictness, number> = { easy: 1, common: 0, hard: -1 };
const WRONG_BELOW: Record<Strictness, number> = { easy: 45, common: 60, hard: 75 };

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

/** The request the service takes: connect and start, both signed. */
export function requestOf(keys: SpeechSuperKeys, o: { text: string; pinyin?: string[]; strictness: Strictness }, now = Date.now()) {
  const timestamp = String(now);
  const { appKey: applicationId, secretKey } = keys;
  return {
    connect: {
      cmd: 'connect',
      param: { sdk: { version: 16777472, source: 9, protocol: 2 }, app: { applicationId, sig: sha1(applicationId + timestamp + secretKey), timestamp } },
    },
    start: {
      cmd: 'start',
      param: {
        app: { applicationId, sig: sha1(applicationId + timestamp + USER + secretKey), userId: USER, timestamp },
        audio: { audioType: 'wav', sampleRate: 16000, channel: 1, sampleBytes: 2 },
        request: {
          coreType: CORE,
          refText: o.text,
          ...(o.pinyin?.length ? { refPinyin: o.pinyin.join(' ') } : {}),
          slack: SLACK[o.strictness],
          tokenId: `t${timestamp}`,
        },
      },
    },
  };
}

/** 16 kHz 16-bit mono PCM with a WAV header. */
export function wav(pcm: Uint8Array): Uint8Array {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(16_000, 24);
  head.writeUInt32LE(32_000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  return new Uint8Array(Buffer.concat([head, pcm]));
}

/** Scores `pcm` (16 kHz, 16-bit, mono) as a reading of `text`. */
export async function evaluate(keys: SpeechSuperKeys, o: { text: string; pinyin?: string[]; pcm: Uint8Array; strictness: Strictness }): Promise<EvalResult> {
  const form = new FormData();
  form.append('text', JSON.stringify(requestOf(keys, o)));
  form.append('audio', new Blob([Buffer.from(wav(o.pcm))], { type: 'audio/wav' }), 'phrase.wav');
  let body: unknown;
  try {
    const res = await fetch(`${BASE}/${CORE}`, { method: 'POST', body: form, headers: { 'Request-Index': '0' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new EvaluatorRefused(`SpeechSuper answered ${res.status}.`, 'failed');
    body = await res.json();
  } catch (err) {
    if (err instanceof EvaluatorRefused) throw err;
    throw new EvaluatorRefused('SpeechSuper did not answer in time.', 'failed');
  }
  return parseAnswer(body, o.strictness);
}

/* ------------------------------------------------------------ the answer */

interface Phone {
  phone?: string;
  sound_like?: string;
  pronunciation?: number;
  category?: number;
  readType?: number;
}

interface Word {
  word?: string;
  rawpinyin?: string;
  readType?: number;
  tone_sound_like?: string;
  scores?: { overall?: number; tone?: number; tone_sound_like?: string };
  pause?: { type?: number };
  span?: { start?: number; end?: number };
  phonemes?: Phone[];
  normalized_syllables?: Array<{ tone?: string; tone_sandhi?: string; pinyin?: string; syllables?: string; phoneme_span?: number[] }>;
}

interface Answer {
  errId?: number;
  error?: string;
  result?: {
    overall?: number;
    pronunciation?: number;
    tone?: number;
    fluency?: number;
    integrity?: number;
    rhythm?: number;
    speed?: number;
    rear_tone?: string;
    warning?: Array<{ code?: number }>;
    words?: Word[];
  };
}

const toneNo = (t: string | undefined) => {
  const n = Number(/^tone([1-5])$/.exec(t ?? '')?.[1]);
  return n || undefined;
};
const n0 = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The scores and each syllable's faults, from SpeechSuper's answer; a part scored under the strictness's bar is wrong. */
export function parseAnswer(raw: unknown, strictness: Strictness): EvalResult {
  const a = (raw ?? {}) as Answer;
  if (a.error || a.errId || !a.result) {
    const message = a.error ?? 'no result';
    const keys = /sig|appkey|application|auth|licen[cs]e|expire|quota|permission/i.test(message);
    throw new EvaluatorRefused(`SpeechSuper: ${message}${a.errId ? ` (${a.errId})` : ''}`, keys ? 'keys' : 'failed');
  }
  const r = a.result;
  const bar = WRONG_BELOW[strictness];
  // readType, as SpeechSuper answers it (tried: a syllable left out of the
  // recording, one added to it, one said as another): on a word 0 said, 1
  // something extra said just before it, 2 not heard at all, 4 a word in the
  // recording that is not in the text (their own demo leaves those out); on a
  // phone 3 not heard, 6 said as another sound. A pause is marked after the
  // word before one left out, which is the gap, not a pause: so a pause counts
  // only between two words both said.
  const words = (r.words ?? []).filter((w) => w.readType !== 4);
  const syllables: SyllableEval[] = words.flatMap((w, wi) => {
    const parts = w.normalized_syllables?.length ? w.normalized_syllables : [{}];
    const chars = [...(w.word ?? '')];
    return parts.map((ns, j): SyllableEval => {
      const [p0, p1] = ns.phoneme_span ?? [0, (w.phonemes?.length ?? 1) - 1];
      const phones = (w.phonemes ?? []).slice(p0, (p1 ?? p0!) + 1);
      const initial = phones.find((p) => p.category === 0);
      const final = phones.find((p) => p.category === 1);
      const missed = w.readType === 2;
      const nextSaid = words[wi + 1] !== undefined && words[wi + 1]!.readType !== 2;
      const tone = toneNo(ns.tone) ?? Number(/(\d)$/.exec(w.rawpinyin ?? '')?.[1] ?? 5);
      const sandhi = toneNo(ns.tone_sandhi);
      const toneScore = n0(w.scores?.tone);
      const heard = toneNo(w.scores?.tone_sound_like ?? w.tone_sound_like);
      const wrongPhone = (p: Phone | undefined) => Boolean(p && (p.readType === 6 || n0(p.pronunciation) < bar));
      const like = (p: Phone | undefined) => (p && wrongPhone(p) && p.sound_like && p.sound_like !== '-' && p.sound_like !== p.phone ? p.sound_like : undefined);
      return {
        char: parts.length > 1 ? (ns.syllables ?? chars[j] ?? '') : (w.word ?? ''),
        symbol: parts.length > 1 && ns.pinyin ? `${ns.pinyin}${tone}` : (w.rawpinyin ?? ''),
        said: missed ? 'missed' : 'ok',
        initial: !missed && wrongPhone(initial),
        final: !missed && wrongPhone(final),
        tone: !missed && toneScore < bar,
        from: n0(w.span?.start) * 10,
        to: n0(w.span?.end) * 10,
        score: n0(w.scores?.overall),
        toneScore,
        ...(initial ? { initialScore: n0(initial.pronunciation) } : {}),
        ...(final ? { finalScore: n0(final.pronunciation) } : {}),
        ...(heard && !missed ? { heardTone: heard } : {}),
        ...(sandhi && sandhi !== tone ? { sandhi } : {}),
        ...(like(initial) ? { initialLike: like(initial) } : {}),
        ...(like(final) ? { finalLike: like(final) } : {}),
        ...(w.pause?.type === 1 && !missed && nextSaid && j === parts.length - 1 ? { pause: true } : {}),
        ...(w.readType === 1 && j === 0 ? { extraBefore: true } : {}),
      };
    });
  });
  const said = syllables.filter((s) => s.said === 'ok').length;
  return {
    by: 'speechsuper',
    total: n0(r.overall),
    tone: n0(r.tone),
    sounds: n0(r.pronunciation),
    fluency: n0(r.fluency),
    completeness: n0(r.integrity),
    rejected: said === 0 || /no speech/i.test(r.rear_tone ?? ''),
    syllables,
    rhythm: n0(r.rhythm),
    speed: n0(r.speed),
    ...(r.rear_tone === 'rise' || r.rear_tone === 'fall' ? { ending: r.rear_tone } : {}),
    ...(r.warning?.some((w) => w.code === 1002) ? { quiet: true } : {}),
  };
}
