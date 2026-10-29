/**
 * Pictures for the paragraphs of the texts on a shelf, drawn by Gemini.
 *
 * The writer of a text (/story, /add-text) describes what each paragraph
 * shows, in `pictures: [{ para, prompt }]`. This draws each description that
 * has no picture yet, makes it small enough for a phone, sends it to the
 * account's server, and writes its key and size into the text — the way a
 * device saves, so an iPad open at the time keeps its own changes.
 *
 * A story's characters have to look the same from one chapter to the next,
 * and a painter given only words draws a new Pikachu every time. So every
 * picture is drawn with the two nearest pictures already drawn in the same
 * reading session beside it — the paragraph before, the chapter before — and
 * asked to keep the characters as they are there.
 *
 *   GEMINI_API_KEY          the key, from Google AI Studio (also read from .env)
 *   GEMINI_IMAGE_MODEL      the model, gemini-2.5-flash-image unless set
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PICTURE_MAX_BYTES } from '../../shared/api';
import { picturesOf, type TextPicture } from '../../src/domain/pictures';
import type { GeneratedText, TextSet } from '../../src/domain/text';

type Doc = Record<string, unknown>;

/** What drawing needs of an account: its workspace, and somewhere to keep pictures. */
export interface PictureAccount {
  where: string;
  read(): Promise<{ revision: number; document: unknown }>;
  write(baseRevision: number, document: Doc): Promise<boolean>;
  getPicture(key: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
  putPicture(key: string, mime: string, bytes: Uint8Array): Promise<void>;
}

/** The look of every picture, unless --style says otherwise. */
export const HOUSE_STYLE =
  'A soft watercolour illustration for a children’s picture book: warm light, gentle colours, clean simple shapes, a calm uncluttered background.';

const RULES = 'No text, letters, numbers, speech bubbles or captions anywhere in the picture. Landscape, 4:3.';

/** The words sent with one paragraph's description. */
export function promptFor(prompt: string, style: string, references: number): string {
  return [
    style,
    references
      ? `The ${references === 1 ? 'picture' : 'pictures'} above ${references === 1 ? 'is an earlier page' : 'are earlier pages'} of the same book: keep every character who appears again looking exactly the same — face, colours, clothes, proportions — and keep the same style.`
      : '',
    `Draw this scene: ${prompt}`,
    RULES,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** One description still to draw, and where it goes. */
export interface Job {
  textId: string;
  title: string;
  setId?: string;
  para: number;
  prompt: string;
}

/**
 * What is left to draw on these texts, in reading order: oldest text first,
 * then paragraph by paragraph — so the pictures a later one is drawn beside
 * already exist.
 */
export function jobsOf(texts: GeneratedText[], o: { redo?: boolean } = {}): Job[] {
  return [...texts]
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((t) =>
      (t.pictures ?? [])
        .filter((p) => o.redo || !p.key)
        .map((p) => ({ textId: t.id, title: t.titleZh || t.title, setId: t.setId, para: p.para, prompt: p.prompt })),
    );
}

/**
 * The drawn pictures nearest to a job, at most `n`: earlier paragraphs of the
 * same text, nearest first, then the texts before it in the same session,
 * last paragraph first. Those are the pages a reader has just seen.
 */
export function referencesFor(job: Job, texts: GeneratedText[], n = 2): string[] {
  const own = texts.find((t) => t.id === job.textId);
  const earlier = (own?.pictures ?? []).filter((p) => p.key && p.para < job.para).sort((a, b) => b.para - a.para);
  const before = job.setId
    ? texts
        .filter((t) => t.setId === job.setId && t.id !== job.textId && own && t.createdAt < own.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .flatMap((t) => (t.pictures ?? []).filter((p) => p.key).sort((a, b) => b.para - a.para))
    : [];
  return [...earlier, ...before].map((p) => p.key!).slice(0, n);
}

/**
 * The text with these descriptions for its paragraphs, for a text already on
 * the shelf. A paragraph whose description is unchanged keeps its drawing; a
 * new description is drawn afresh.
 */
export function withDescribed(text: GeneratedText, described: Array<{ para: number; prompt: string }>): GeneratedText {
  const had = new Map((text.pictures ?? []).map((p) => [p.para, p]));
  const pictures = picturesOf(described).map((d) => {
    const old = had.get(d.para);
    return old && old.prompt === d.prompt ? old : d;
  });
  return { ...text, pictures };
}

/** The text with a drawn picture put in for one paragraph. */
export function withDrawn(text: GeneratedText, para: number, drawn: Required<Pick<TextPicture, 'key' | 'w' | 'h' | 'at'>>): GeneratedText {
  const pictures = (text.pictures ?? []).map((p) => (p.para === para ? { para, prompt: p.prompt, ...drawn } : p));
  return { ...text, pictures: picturesOf(pictures) };
}

/* ------------------------------------------------------------ the bytes */

/** Width and height of a JPEG, PNG or WebP, read from its header; null when it is none of them. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const u32 = (i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
  const le16 = (i: number) => b[i]! | (b[i + 1]! << 8);
  const le24 = (i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32(16), h: u32(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      // Start of frame: every SOFn but DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: u16(i + 5), w: u16(i + 7) };
      }
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (b.length > 30 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    const kind = String.fromCharCode(...b.slice(12, 16));
    if (kind === 'VP8X') return { w: le24(24) + 1, h: le24(27) + 1 };
    if (kind === 'VP8 ') return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

const mimeOf = (b: Uint8Array) =>
  b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : String.fromCharCode(...b.slice(8, 12)) === 'WEBP' ? 'image/webp' : '';

/** The widest a picture is kept: a phone's column at 3x is about this, an iPad's at 2x a little more. */
const KEEP_WIDTH = 1024;

/**
 * The picture as a JPEG no wider than KEEP_WIDTH, by whichever tool this
 * machine has: sips on the Mac, ImageMagick or ffmpeg elsewhere. With none,
 * the picture as it came, if the server will take it.
 */
export function shrink(bytes: Uint8Array): { mime: string; bytes: Uint8Array } {
  const dir = mkdtempSync(join(tmpdir(), 'hanzi-picture-'));
  try {
    const src = join(dir, mimeOf(bytes) === 'image/png' ? 'in.png' : 'in.img');
    const out = join(dir, 'out.jpg');
    writeFileSync(src, bytes);
    const tools: Array<[string, string[]]> = [
      ['sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', String(KEEP_WIDTH), src, '--out', out]],
      ['magick', [src, '-resize', `${KEEP_WIDTH}x${KEEP_WIDTH}>`, '-quality', '80', '-strip', out]],
      ['convert', [src, '-resize', `${KEEP_WIDTH}x${KEEP_WIDTH}>`, '-quality', '80', '-strip', out]],
      ['ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', `scale='min(${KEEP_WIDTH},iw)':-2`, '-q:v', '4', out]],
    ];
    for (const [tool, args] of tools) {
      try {
        execFileSync(tool, args, { stdio: 'ignore' });
        const small = new Uint8Array(readFileSync(out));
        if (imageSize(small)) return { mime: 'image/jpeg', bytes: small };
      } catch {
        // not on this machine, or it could not read the picture: the next one
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const mime = mimeOf(bytes);
  if (!mime || bytes.length > PICTURE_MAX_BYTES) {
    throw new Error('No sips, ImageMagick or ffmpeg here to make the picture small enough for the site.');
  }
  return { mime, bytes };
}

/* ------------------------------------------------------------ the painter */

export interface Painter {
  model: string;
  paint(text: string, references: Array<{ mime: string; bytes: Uint8Array }>): Promise<Uint8Array>;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A refusal no later picture of this run would get past: no quota, a bad key. The run stops on it. */
export class PainterUnavailable extends Error {}

/**
 * What a 429 means: a quota of nothing (the free tier gives the image models
 * none) or one used up for hours is the end of this run; a minute's limit is
 * worth waiting out.
 */
function quotaGone(message: string): string | null {
  if (/limit: 0\b/.test(message) && /free_tier/.test(message)) {
    return 'This Gemini key’s free tier draws no pictures: turn on billing for its project in Google AI Studio (aistudio.google.com → Billing), then run this again.';
  }
  const wait = /retry in (?:(\d+)h)?(?:(\d+)m)?/.exec(message);
  if (wait && (Number(wait[1] ?? 0) > 0 || Number(wait[2] ?? 0) > 5)) {
    return `This Gemini key’s quota is used up for now (it says to retry in ${wait[1] ? `${wait[1]}h ` : ''}${wait[2] ?? 0}m).`;
  }
  return null;
}

/** Gemini, through its REST API. Null when there is no key. */
export function geminiFromEnv(env: NodeJS.ProcessEnv): Painter | null {
  const key = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim();
  if (!key) return null;
  const model = env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return {
    model,
    async paint(text, references) {
      const body = {
        contents: [
          {
            role: 'user',
            parts: [
              ...references.map((r) => ({ inline_data: { mime_type: r.mime, data: Buffer.from(r.bytes).toString('base64') } })),
              { text },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:3' } },
      };
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
        });
        const answer = (await res.json().catch(() => null)) as GeminiAnswer | null;
        const message = answer?.error?.message ?? res.statusText;
        if (res.status === 429) {
          const gone = quotaGone(message);
          if (gone) throw new PainterUnavailable(gone);
        }
        if (res.status === 400 && /API key/i.test(message)) throw new PainterUnavailable(`Gemini refused the key: ${message}`);
        if (res.status === 401 || res.status === 403) throw new PainterUnavailable(`Gemini refused the key: ${message}`);
        // Busy or rate-limited for a moment: wait and ask again, a few times.
        if ((res.status === 429 || res.status >= 500) && attempt < 4) {
          await pause(attempt * 15_000);
          continue;
        }
        if (!res.ok) throw new Error(`Gemini said ${res.status}: ${message.split('\n')[0]}`);
        const parts = answer?.candidates?.[0]?.content?.parts ?? [];
        const image = parts.find((p) => p.inlineData?.data ?? p.inline_data?.data);
        const data = image?.inlineData?.data ?? image?.inline_data?.data;
        if (data) return new Uint8Array(Buffer.from(data, 'base64'));
        const why =
          answer?.promptFeedback?.blockReason ??
          answer?.candidates?.[0]?.finishReason ??
          parts.map((p) => p.text).filter(Boolean).join(' ') ??
          'no picture';
        throw new Error(`Gemini drew nothing (${why || 'no picture'}).`);
      }
    },
  };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiAnswer {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/* ------------------------------------------------------------ the run */

const isDoc = (v: unknown): v is Doc => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const textsOf = (doc: Doc) => (Array.isArray(doc.texts) ? (doc.texts as GeneratedText[]) : []);

export interface IllustrateOptions {
  /** a reading session, by id or name */
  set?: string;
  /** only these texts */
  textIds?: string[];
  /** draw again what is drawn already */
  redo?: boolean;
  style?: string;
  dryRun?: boolean;
  say: (line: string) => void;
}

/**
 * Draws what is left to draw, one picture at a time, saving each into the
 * workspace as soon as it is kept: a run stopped halfway keeps what it drew,
 * and running it again draws only the rest.
 */
export async function illustrate(account: PictureAccount, painter: Painter | null, o: IllustrateOptions) {
  const { document } = await account.read();
  if (!isDoc(document)) throw new Error(`${account.where} has never saved anything.`);
  const sets = Array.isArray(document.sets) ? (document.sets as TextSet[]) : [];
  const set = o.set ? sets.find((s) => s.id === o.set || s.name.trim() === o.set!.trim()) : null;
  if (o.set && !set) throw new Error(`No reading session “${o.set}”. There are: ${sets.map((s) => `“${s.name}”`).join(', ')}.`);
  const chosen = textsOf(document).filter((t) => (!set || t.setId === set.id) && (!o.textIds || o.textIds.includes(t.id)));
  const jobs = jobsOf(chosen, { redo: o.redo });
  if (!jobs.length) {
    o.say(`Nothing to draw: ${chosen.some((t) => t.pictures?.length) ? 'every picture is drawn' : 'no text here describes any pictures'}.`);
    return { drawn: 0, failed: 0 };
  }
  if (o.dryRun || !painter) {
    if (!painter) o.say('GEMINI_API_KEY is not set, so nothing can be drawn yet. What would be:');
    for (const j of jobs) o.say(`${j.title} ¶${j.para + 1}: ${j.prompt}`);
    return { drawn: 0, failed: 0 };
  }

  o.say(`${jobs.length} picture${jobs.length === 1 ? '' : 's'} to draw with ${painter.model}, for ${account.where}.`);
  const cache = new Map<string, { mime: string; bytes: Uint8Array }>();
  const fetchRef = async (key: string) => {
    if (!cache.has(key)) {
      const got = await account.getPicture(key);
      if (got) cache.set(key, got);
    }
    return cache.get(key) ?? null;
  };

  let drawn = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      // The newest workspace each time: the pictures drawn a moment ago are references now.
      const { document: now } = await account.read();
      const texts = isDoc(now) ? textsOf(now) : [];
      const refs = (await Promise.all(referencesFor(job, texts).map(fetchRef))).filter((r) => r !== null);
      const painted = await painter.paint(promptFor(job.prompt, o.style || HOUSE_STYLE, refs.length), refs);
      const small = shrink(painted);
      const size = imageSize(small.bytes);
      if (!size) throw new Error('The picture came back in a form this cannot read.');
      const key = createHash('sha256').update(small.bytes).digest('hex');
      await account.putPicture(key, small.mime, small.bytes);
      cache.set(key, small);
      await save(account, job, { key, w: size.w, h: size.h, at: Date.now() });
      drawn += 1;
      o.say(`${job.title} ¶${job.para + 1}: drawn, ${size.w}×${size.h}, ${Math.round(small.bytes.length / 1024)} KB`);
    } catch (err) {
      failed += 1;
      if (err instanceof PainterUnavailable) {
        o.say(err.message);
        failed = jobs.length - drawn;
        break;
      }
      o.say(`${job.title} ¶${job.para + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { drawn, failed };
}

/** One drawn picture into its text, on the revision just read; read again if a device saved in between. */
async function save(account: PictureAccount, job: Job, drawn: Required<Pick<TextPicture, 'key' | 'w' | 'h' | 'at'>>) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { revision, document } = await account.read();
    if (!isDoc(document)) throw new Error('The workspace is gone.');
    const texts = textsOf(document);
    if (!texts.some((t) => t.id === job.textId)) throw new Error('The text is no longer on the shelf.');
    const next = { ...document, texts: texts.map((t) => (t.id === job.textId ? withDrawn(t, job.para, drawn) : t)) };
    if (await account.write(revision, next)) return;
  }
  throw new Error('The workspace kept changing under this save; the picture is kept, run it again to put it in.');
}
