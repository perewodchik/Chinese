import type { Library } from '../data/types';
import type { CaptionCue, VideoLookup } from '../../shared/videos';
import { alignPinyin } from './reading';
import { segment, writerHints } from './segment';
import { isHanzi } from './text';
import { wordIndex } from './vocab';

/**
 * A video being studied: watched outside the app, worked on inside it.
 *
 * The method is the one 尚雯婕 made famous — write down what is said, check
 * it, learn it, say it — scaled to a beginner: a part of a video at a time,
 * the pinyin written by hand in a paper notebook. So what the app keeps is the
 * transcript (with the pinyin the notebook is checked against), how the
 * video is split into sittings, and a record of what was done with it. How
 * well it fits is never kept: it is worked out from the transcript and what
 * is known today, so a video that was hard in September is easier in November
 * without anyone touching it.
 */

export interface VideoLine {
  /** seconds from the start of the video */
  at: number;
  end: number;
  zh: string;
  /** one syllable per Han character, spaced: "wǒ shì pèi qí" */
  py: string;
  en?: string;
  /** who says it, where Claude could tell */
  who?: string;
  /** Claude's doubt about the caption, where it looked mis-transcribed */
  doubt?: string;
  /** words the captions' own pinyin grouped that no dictionary has — names, mostly (乔治) */
  words?: string[];
}

/**
 * Where the text came from — and so how far to trust it:
 * - `captions` — a track the channel made
 * - `captions-auto` — YouTube's speech recognition
 * - `pasted` — typed or pasted in, or from a subtitle file
 * - `waiting` — nothing yet: YouTube would not give it to the server the
 *   video was added from, and the next device that can fetch it will
 * - `none` — the video has no Chinese captions at all (the text is burned
 *   into the picture): it has to be pasted in
 */
export type VideoTextFrom = 'captions' | 'captions-auto' | 'pasted' | 'waiting' | 'none';

export type VideoStatus = 'want' | 'working' | 'done' | 'shelved';

export const VIDEO_STATUSES: Array<{ id: VideoStatus; label: string }> = [
  { id: 'want', label: 'Want to watch' },
  { id: 'working', label: 'Working on it' },
  { id: 'done', label: 'Done' },
  { id: 'shelved', label: 'Put aside' },
];

/** A run of lines worked on in one sitting: `from` inclusive, `to` exclusive. */
export interface VideoPart {
  from: number;
  to: number;
}

/**
 * What the learner says about a video, by hand — and what the app fills in
 * when something it saw shows it.
 */
export interface VideoMarks {
  /** times a whole part was played through, or ticked as watched */
  watched: number;
  /** 1–5, how much of it made sense the last time it was watched */
  understood?: number;
  /** the pinyin was written out and checked, or ticked as written */
  written?: boolean;
  /** the new words were taken, or ticked as done */
  words?: boolean;
  /** it can be said out loud */
  said?: boolean;
}

/** How a notebook check was marked: from a syllable at a time down to one tap. */
export type MarkWay = 'detailed' | 'quick' | 'lines' | 'overall';

export const MARK_WAYS: Array<{ id: MarkWay; label: string; blurb: string }> = [
  { id: 'detailed', label: 'Detailed', blurb: 'Tap what you got wrong and type what you wrote.' },
  { id: 'quick', label: 'Quick', blurb: 'Tap what you got wrong.' },
  { id: 'lines', label: 'By line', blurb: 'Right, nearly or wrong, a line at a time.' },
  { id: 'overall', label: 'Overall', blurb: 'One tap for the whole part.' },
];

/**
 * One syllable marked wrong in the notebook.
 *
 * `syl` is the syllable's place in its line; an extra syllable — written in
 * the notebook, not in the video — sits *before* syllable `syl` (or at the
 * end, with `syl` equal to the line's length). A line marked missed as a
 * whole has `line` and `whole`.
 */
export interface SylMark {
  line: number;
  syl: number;
  /** what the notebook says, as typed; empty for a gap; absent in a quick check */
  wrote?: string;
  extra?: boolean;
  whole?: boolean;
}

export type LineMark = 'right' | 'close' | 'wrong';

/** The five answers to "how much of it did you get?", best first. */
export const OVERALL: Array<{ id: number; label: string; share: number }> = [
  { id: 4, label: 'All of it', share: 1 },
  { id: 3, label: 'Most', share: 0.8 },
  { id: 2, label: 'About half', share: 0.5 },
  { id: 1, label: 'A little', share: 0.2 },
  { id: 0, label: 'Hardly any', share: 0 },
];

/** One notebook check of one part, as it was marked. Every check is kept. */
export interface DictationCheck {
  id: string;
  /** which part, by its place in `parts` when it was checked */
  part: number;
  at: number;
  way: MarkWay;
  /** syllables in the part */
  total: number;
  /** syllables right, sandhi forgiven; for `overall`, the share times the total, rounded */
  right: number;
  marks?: SylMark[];
  lines?: Record<number, LineMark>;
  overall?: number;
}

/** A question asked of Claude about the video, and the answer, kept. */
export interface VideoAsk {
  id: string;
  part: number;
  q: string;
  a: string;
  at: number;
}

export interface Video {
  /** `yt:<videoId>` for YouTube, so the same video is never on the shelf twice */
  id: string;
  source: { kind: 'youtube'; videoId: string } | { kind: 'other'; url?: string };
  title: string;
  channel?: string;
  seconds?: number;
  description?: string;
  added: number;
  updatedAt: number;
  lines: VideoLine[];
  textFrom: VideoTextFrom;
  parts: VideoPart[];
  status: VideoStatus;
  marks: VideoMarks;
  checks: DictationCheck[];
  asks: VideoAsk[];
  /** Claude's study pack for each part, by part number */
  packs: Record<number, VideoPack>;
  /** new words waved off with ✕ on the strip: not wanted from this video */
  skipped: string[];
}

/* ------------------------------------------------------------ the pack */

export type WordVerdict = 'learn_now' | 'later' | 'skip';

export interface PackWord {
  w: string;
  py: string;
  en: string;
  hsk: number | 'off-list';
  lines: number[];
  verdict: WordVerdict;
}

export interface PackSentence {
  zh: string;
  py: string;
  en: string;
}

/**
 * What Claude made of one part: everything the video page shows beyond the
 * transcript. Line numbers are the notebook's — 1 is the part's first line.
 */
export interface VideoPack {
  at: number;
  /** by notebook line number */
  lines: Record<number, { py?: string; en?: string; who?: string; doubt?: string }>;
  sandhi: Array<{ n: number; heard: string; why: string }>;
  words: PackWord[];
  senses: Array<{ w: string; en: string; lines: number[] }>;
  grammar: Array<{ pattern: string; lines: number[]; explain: string; example?: PackSentence }>;
  notes: Array<{ text: string; lines: number[] }>;
  listening: Array<{ n: number; why: string }>;
  questions: Array<{ q: PackSentence; answer: PackSentence; lines: number[] }>;
  retell?: { zh: string; en: string; words: string[] };
  extra: { sentences: PackSentence[]; topic?: string };
  level?: { verdict: string; why: string };
}

/* ---------------------------------------------------------- addresses */

/**
 * The video in a YouTube link, whichever shape the link has: watch pages with
 * a playlist and an index on the end, youtu.be, shorts, embeds, or a bare id.
 */
export function youTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export const videoKey = (youTube: string) => `yt:${youTube}`;

/** The playlist in a YouTube link — `list=` on a watch or playlist page — or null. Mixes (RD…) are not playlists anyone made. */
export function playlistIdOf(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(url.hostname)) return null;
  const list = url.searchParams.get('list');
  return list && /^[A-Za-z0-9_-]{10,64}$/.test(list) && !list.startsWith('RD') ? list : null;
}

export const thumbnailOf = (v: Pick<Video, 'source'>) =>
  v.source.kind === 'youtube' ? `https://i.ytimg.com/vi/${v.source.videoId}/mqdefault.jpg` : null;

export const watchUrl = (v: Pick<Video, 'source'>, at?: number) =>
  v.source.kind === 'youtube'
    ? `https://www.youtube.com/watch?v=${v.source.videoId}${at ? `&t=${Math.floor(at)}s` : ''}`
    : v.source.url ?? null;

/* --------------------------------------------------- captions to lines */

const HAN = /[㐀-鿿]/;
const TONE_MARKED = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
/** A caption line that is pinyin: letters, marks, spaces and light punctuation, with a tone mark somewhere. */
const PINYIN_LINE = /^[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s'’·,.!?;:，。！？、-]+$/;
/** Noise auto captions and some channels put in: [音乐], (笑), ♪. */
const NOISE = /\[[^\]]*\]|（[^）]*）|\([^)]*\)|【[^】]*】|[♪♫]/g;

export interface SplitCue {
  zh: string;
  py?: string;
  en?: string;
}

/**
 * One caption as its Chinese, its pinyin and its English, for the channels
 * that put all three in one caption: `我是佩奇 / wǒ shì pèi qí / I am Peppa`.
 */
export function splitCue(text: string): SplitCue {
  const parts = text
    .split(/\n|\s\/\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  const zh: string[] = [];
  const py: string[] = [];
  const en: string[] = [];
  for (const p of parts) {
    if (HAN.test(p)) zh.push(p);
    else if (PINYIN_LINE.test(p) && TONE_MARKED.test(p)) py.push(p);
    else en.push(p);
  }
  return {
    zh: zh.join(' ').replace(NOISE, '').replace(/\s+/g, ' ').trim(),
    py: py.length ? py.join(' ') : undefined,
    en: en.length ? en.join(' ') : undefined,
  };
}

/**
 * The pinyin of a line, one syllable per Han character.
 *
 * With the caption's own pinyin, that is laid over the characters (the reader
 * does the same with a writer's pinyin). Without it, each word the cut finds
 * is read as the syllabus reads it — 行 in 银行 and in 不行 come out right —
 * and a character in no word takes its commonest reading.
 */
export function linePinyin(zh: string, lib: Library, captionPy?: string): string {
  if (captionPy) return alignPinyin({ zh, py: captionPy }, lib).join(' ');
  const index = wordIndex(lib);
  const out: string[] = [];
  for (const t of segment(zh, lib)) {
    if (!t.word) continue;
    const chars = [...t.text].filter(isHanzi);
    if (!chars.length) continue;
    const reading = lib.byWord.get(t.text)?.py ?? index.get(t.text)?.p;
    const cut = reading ? alignPinyin({ zh: t.text, py: reading }, lib) : null;
    if (cut && cut.length === chars.length && cut.every(Boolean)) out.push(...cut);
    else for (const c of chars) out.push(lib.byChar.get(c)?.py[0] ?? '?');
  }
  return out.join(' ');
}

/**
 * Words the transcript itself shows to be words, though no dictionary has
 * them: the names. Those the captions' pinyin grouped, and any pair or three
 * of characters that keeps coming back together and whose characters hardly
 * appear any other way — 佩奇 is said twenty times and 佩 never without 奇.
 * Cut out whole, a name is left out of what is new instead of being counted
 * as two strange characters.
 */
export function transcriptWords(lines: ReadonlyArray<Pick<VideoLine, 'zh' | 'words'>>, lib: Library): Set<string> {
  const out = new Set<string>();
  for (const l of lines) for (const w of l.words ?? []) out.add(w);
  const chars = new Map<string, number>();
  const runs = new Map<string, number>();
  for (const l of lines) {
    const han = [...l.zh];
    for (let i = 0; i < han.length; i++) {
      if (!isHanzi(han[i]!)) continue;
      chars.set(han[i]!, (chars.get(han[i]!) ?? 0) + 1);
      for (const k of [2, 3]) {
        const run = han.slice(i, i + k);
        if (run.length === k && run.every(isHanzi)) runs.set(run.join(''), (runs.get(run.join('')) ?? 0) + 1);
      }
    }
  }
  const index = wordIndex(lib);
  for (const [run, n] of runs) {
    if (n < 3 || lib.byWord.has(run) || index.has(run)) continue;
    // Everyday words side by side (我是) are a phrase, however often they come.
    if ([...run].every((c) => (lib.byWord.get(c)?.hsk ?? 99) <= 2)) continue;
    if ([...run].every((c) => n >= 0.8 * (chars.get(c) ?? 0))) out.add(run);
  }
  return out;
}

/** The syllables of a line, one per Han character. */
export const syllablesOf = (line: Pick<VideoLine, 'py'>) => line.py.split(' ').filter(Boolean);

export const hanOf = (zh: string) => [...zh].filter(isHanzi);

/** The English captions that overlap a line most, joined. */
function englishFor(at: number, end: number, english: CaptionCue[]): string | undefined {
  const hits = english.filter((e) => Math.min(end, e.end) - Math.max(at, e.at) > Math.min(0.4, (e.end - e.at) / 2));
  const text = hits.map((h) => h.text.replace(/\n/g, ' ')).join(' ').trim();
  return text || undefined;
}

/**
 * Captions made into the lines of a transcript. Cues with no Chinese in them
 * (music, a title card in English) are left out; the English track, where
 * there is one, is matched to each line by time.
 */
export function linesFromCues(cues: CaptionCue[], lib: Library, english: CaptionCue[] | null = null): VideoLine[] {
  const out: VideoLine[] = [];
  for (const c of cues) {
    const split = splitCue(c.text);
    if (!HAN.test(split.zh)) continue;
    const line: VideoLine = { at: c.at, end: Math.max(c.end, c.at + 0.5), zh: split.zh, py: linePinyin(split.zh, lib, split.py) };
    const words = split.py ? writerHints(split.zh, split.py, lib).filter((w) => !lib.byWord.has(w)) : [];
    if (words.length) line.words = words;
    const en = split.en ?? (english ? englishFor(c.at, c.end, english) : undefined);
    if (en) line.en = en;
    out.push(line);
  }
  return out;
}

/** Seconds as "1:05" — or "00:02.8" to a tenth, for a prompt. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Pasted text as lines: an SRT or VTT file (times kept), or plain text, a
 * line of Chinese per line — with its pinyin and English on the lines after
 * it, if they are there.
 */
export function linesFromText(raw: string, lib: Library): VideoLine[] {
  const text = raw.replace(/\r/g, '').replace(/^﻿/, '').trim();
  const timed = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;
  if (timed.test(text)) {
    const cues: CaptionCue[] = [];
    for (const block of text.split(/\n\s*\n/)) {
      const rows = block.split('\n');
      const i = rows.findIndex((r) => timed.test(r));
      if (i < 0) continue;
      const [a, b] = rows[i]!.split('-->').map((t) => seconds(t.trim().split(/\s/)[0]!));
      const body = rows.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
      if (body) cues.push({ at: a!, end: b!, text: body });
    }
    return linesFromCues(cues, lib);
  }
  // Plain text: a Chinese line starts a line of the transcript; the lines
  // after it that are not Chinese are its pinyin and English.
  const cues: CaptionCue[] = [];
  let current: string[] | null = null;
  const flush = () => {
    if (current) cues.push({ at: 0, end: 0, text: current.join('\n') });
  };
  for (const row of text.split('\n').map((r) => r.trim()).filter(Boolean)) {
    if (HAN.test(row)) {
      flush();
      // A paragraph of prose becomes a line per sentence.
      const sentences = row.match(/[^。！？!?]+[。！？!?]?/g) ?? [row];
      for (const s of sentences.slice(0, -1)) cues.push({ at: 0, end: 0, text: s.trim() });
      current = [sentences[sentences.length - 1]!.trim()];
    } else if (current) current.push(row);
  }
  flush();
  return linesFromCues(cues, lib);
}

/** "00:01:02,500" or "01:02.5" as seconds. */
const seconds = (t: string) =>
  t
    .replace(',', '.')
    .split(':')
    .reduce((acc, part) => acc * 60 + Number(part), 0);

/* -------------------------------------------------------------- parts */

/** About this many lines make a sitting: twenty-odd minutes with a notebook. */
export const PART_SIZE = 25;

/**
 * The lines cut into sittings of about `size`, each cut made at the longest
 * pause near where it falls — so a part ends where the video draws breath,
 * not mid-exchange. Short videos are one part.
 */
export function autoParts(lines: Array<Pick<VideoLine, 'at' | 'end'>>, size = PART_SIZE): VideoPart[] {
  const n = lines.length;
  if (n <= size + Math.floor(size / 2)) return [{ from: 0, to: n }];
  const count = Math.round(n / size);
  const cuts: number[] = [];
  for (let k = 1; k < count; k++) {
    const aim = Math.round((n * k) / count);
    let best = aim;
    let gap = -1;
    // Near the aim only: a pause three lines off is worth it, a part half the size of the others is not.
    for (let i = Math.max(1, aim - 3); i <= Math.min(n - 1, aim + 3); i++) {
      const g = lines[i]!.at - lines[i - 1]!.end;
      if (g > gap) {
        gap = g;
        best = i;
      }
    }
    cuts.push(best);
  }
  const bounds = [0, ...cuts, n];
  return bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1]! }));
}

/** The lines of one part. */
export const partLines = (v: Pick<Video, 'lines' | 'parts'>, part: number) => {
  const p = v.parts[part] ?? { from: 0, to: v.lines.length };
  return v.lines.slice(p.from, p.to);
};

/* ------------------------------------------------------------- making */

export function videoFromLookup(found: VideoLookup, lib: Library, now: number): Video {
  const lines = found.chinese ? linesFromCues(found.chinese.cues, lib, found.english) : [];
  return {
    id: videoKey(found.videoId),
    source: { kind: 'youtube', videoId: found.videoId },
    title: found.title || 'A video',
    channel: found.channel || undefined,
    seconds: found.seconds || undefined,
    description: found.description || undefined,
    added: now,
    updatedAt: now,
    lines,
    // A "Chinese" track can turn out to hold English (channels mislabel them): no lines, no text.
    textFrom: found.chinese && lines.length ? found.chinese.source : 'none',
    parts: autoParts(lines),
    status: 'want',
    marks: { watched: 0 },
    checks: [],
    asks: [],
    packs: {},
    skipped: [],
  };
}

/** A video known only by its link (and a playlist's title for it): YouTube would not say more to this server. */
export function waitingVideo(youTube: string, now: number, known: { title?: string; seconds?: number } = {}): Video {
  return {
    id: videoKey(youTube),
    source: { kind: 'youtube', videoId: youTube },
    title: known.title || 'A YouTube video',
    seconds: known.seconds || undefined,
    added: now,
    updatedAt: now,
    lines: [],
    textFrom: 'waiting',
    parts: [],
    status: 'want',
    marks: { watched: 0 },
    checks: [],
    asks: [],
    packs: {},
    skipped: [],
  };
}

/** The last check of each part, by part. */
export function latestChecks(v: Pick<Video, 'checks'>): Map<number, DictationCheck> {
  const out = new Map<number, DictationCheck>();
  for (const c of v.checks) {
    const had = out.get(c.part);
    if (!had || c.at > had.at) out.set(c.part, c);
  }
  return out;
}

/** The first check of each part, by part: what the latest is measured against. */
export function firstChecks(v: Pick<Video, 'checks'>): Map<number, DictationCheck> {
  const out = new Map<number, DictationCheck>();
  for (const c of v.checks) {
    const had = out.get(c.part);
    if (!had || c.at < had.at) out.set(c.part, c);
  }
  return out;
}

/** The part to carry on with: the first one never checked, else the last. */
export function nextPart(v: Pick<Video, 'checks' | 'parts'>): number {
  const checked = latestChecks(v);
  for (let i = 0; i < v.parts.length; i++) if (!checked.has(i)) return i;
  return Math.max(0, v.parts.length - 1);
}

/** The last time anything was done with the video: a check, a question, a mark. */
export const touchedAt = (v: Pick<Video, 'checks' | 'asks' | 'updatedAt'>) =>
  Math.max(v.updatedAt, ...v.checks.map((c) => c.at), ...v.asks.map((a) => a.at));

/* ------------------------------------------------------------ reading */

type Loose = Record<string, unknown>;
const num = (v: unknown, or = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : or);
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * A stored video, read field by field — it may have been written by a newer
 * build, an older one, or half a sync. Null when it is not a video at all.
 */
export function videoFrom(raw: unknown): Video | null {
  const v = raw as Loose | null;
  if (!v || typeof v !== 'object' || typeof v.id !== 'string') return null;
  const src = v.source as Loose | undefined;
  const source: Video['source'] =
    src?.kind === 'youtube' && typeof src.videoId === 'string'
      ? { kind: 'youtube', videoId: src.videoId }
      : { kind: 'other', url: text(src?.url) || undefined };
  const lines = list(v.lines)
    .filter((l): l is Loose => !!l && typeof l === 'object' && typeof (l as Loose).zh === 'string')
    .map((l) => {
      const line: VideoLine = { at: num(l.at), end: num(l.end), zh: text(l.zh), py: text(l.py) };
      if (text(l.en)) line.en = text(l.en);
      if (text(l.who)) line.who = text(l.who);
      if (text(l.doubt)) line.doubt = text(l.doubt);
      const words = list(l.words).filter((w): w is string => typeof w === 'string');
      if (words.length) line.words = words;
      return line;
    });
  const parts = list(v.parts)
    .filter((p): p is Loose => !!p && typeof p === 'object')
    .map((p) => ({ from: num(p.from), to: num(p.to) }))
    .filter((p) => p.from >= 0 && p.to > p.from && p.to <= lines.length);
  const marks = (v.marks ?? {}) as Loose;
  const status = VIDEO_STATUSES.some((s) => s.id === v.status) ? (v.status as VideoStatus) : 'want';
  const stored = ['captions', 'captions-auto', 'pasted', 'waiting', 'none'].includes(v.textFrom as string)
    ? (v.textFrom as VideoTextFrom)
    : null;
  // Captions that yielded no Chinese line were not Chinese captions.
  const from: VideoTextFrom =
    stored === 'captions' || stored === 'captions-auto' ? (lines.length ? stored : 'none') : stored ?? (lines.length ? 'pasted' : 'waiting');
  return {
    id: v.id,
    source,
    title: text(v.title) || 'A video',
    channel: text(v.channel) || undefined,
    seconds: num(v.seconds) || undefined,
    description: text(v.description) || undefined,
    added: num(v.added),
    updatedAt: num(v.updatedAt, num(v.added)),
    lines,
    textFrom: from,
    parts: parts.length || !lines.length ? parts : autoParts(lines),
    status,
    marks: {
      watched: num(marks.watched),
      understood: typeof marks.understood === 'number' ? marks.understood : undefined,
      written: marks.written === true || undefined,
      words: marks.words === true || undefined,
      said: marks.said === true || undefined,
    },
    checks: list(v.checks).filter(
      (c): c is DictationCheck => !!c && typeof c === 'object' && typeof (c as Loose).id === 'string',
    ),
    asks: list(v.asks).filter((a): a is VideoAsk => !!a && typeof a === 'object' && typeof (a as Loose).id === 'string'),
    packs: v.packs && typeof v.packs === 'object' ? (v.packs as Record<number, VideoPack>) : {},
    skipped: list(v.skipped).filter((w): w is string => typeof w === 'string'),
  };
}

/**
 * The same video from two devices, as one: the later edit's fields, and every
 * check and question either side made.
 */
export function mergeVideo(a: Video, b: Video): Video {
  const [older, newer] = a.updatedAt > b.updatedAt ? [b, a] : [a, b];
  const byId = <T extends { id: string }>(x: T[], y: T[]) => [...new Map([...x, ...y].map((i) => [i.id, i])).values()];
  return {
    ...newer,
    lines: newer.lines.length ? newer.lines : older.lines,
    checks: byId(older.checks, newer.checks).sort((p, q) => p.at - q.at),
    asks: byId(older.asks, newer.asks).sort((p, q) => p.at - q.at),
    packs: { ...older.packs, ...newer.packs },
    skipped: [...new Set([...older.skipped, ...newer.skipped])],
    marks: { ...newer.marks, watched: Math.max(older.marks.watched, newer.marks.watched) },
  };
}
