/**
 * The game's own pinyin input (concept §11): type `nihao` or `ni3hao3`, pick
 * 你好 from the row above the field.
 *
 * Candidates come from the app's word lists and characters — HSK 1–2 first,
 * then the rest, commonest first within a band. What is typed may be:
 *   - plain or with tone numbers (`ni3hao3`, `ni hao`), a tone number
 *     narrowing the choice;
 *   - `v` or `ü` for ü (`nv3`, `lü4`);
 *   - with an erhua `r` (`nar` → 哪儿 first);
 *   - unfinished: the last syllable may be only begun (`nih` → 你好).
 *
 * A candidate says how many typed syllables it uses. Picking one that uses
 * fewer than all (你 from `nihao`) leaves the rest in the field — `rest`.
 */

import type { Library } from '../../data/types';
import { toneOf } from '../../domain/drill';
import { isSyllable, splitRun, toneless } from './dialogue/normalize';

export interface Typed {
  /** toneless, ü as v, erhua dropped */
  s: string;
  tone?: number;
  er?: boolean;
  /** only the start of a syllable (the last one typed) */
  partial?: boolean;
  /** what was typed for it, to give back what is left */
  raw: string;
}

/** Every syllable, for telling a begun syllable from nonsense. */
const ALL = (() => {
  const initials = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
  const finals = ['a', 'o', 'e', 'i', 'u', 'v', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng', 've', 'van', 'vn', 'er'];
  const out: string[] = [];
  for (const i of initials) for (const f of finals) if (isSyllable(i + f)) out.push(i + f);
  return out;
})();

const begins = (piece: string) => ALL.some((s) => s.startsWith(piece));

/** One run of letters (no digits, no spaces): whole syllables, or all but a begun last one. */
function splitLetters(run: string, last: boolean): Typed[] | null {
  const whole = splitRun(run);
  const withEr = (parts: string[], raw: string): Typed[] => {
    // splitRun drops an erhua r; give it back as a mark on the syllable.
    let at = 0;
    return parts.map((s) => {
      const hasR = raw.slice(at + s.length, at + s.length + 1) === 'r' && !isSyllable(raw.slice(at, at + s.length + 1)) && s !== 'er';
      const len = s.length + (hasR ? 1 : 0);
      const t: Typed = { s, raw: raw.slice(at, at + len), ...(hasR ? { er: true } : {}) };
      at += len;
      return t;
    });
  };
  if (whole) return withEr(whole, run);
  if (!last) return null;
  for (let cut = run.length - 1; cut >= 0; cut--) {
    const head = run.slice(0, cut);
    const tail = run.slice(cut);
    if (!begins(tail)) continue;
    const parts = head ? splitRun(head) : [];
    if (parts) return [...withEr(parts, head), { s: tail, partial: true, raw: tail }];
  }
  return null;
}

/** What was typed, as syllables — or null when it is not pinyin at all. */
export function parseTyped(input: string): Typed[] | null {
  const words = toneless(input.trim()).replace(/ü/g, 'v').split(/[\s']+/).filter(Boolean);
  if (!words.length) return null;
  const out: Typed[] = [];
  for (let wi = 0; wi < words.length; wi++) {
    // Tone numbers end syllables: ni3hao3 → ni 3 · hao 3.
    const chunks = words[wi]!.match(/[a-zv]+[1-5]?|[1-5]/g);
    if (!chunks || chunks.join('') !== words[wi]) return null;
    for (let ci = 0; ci < chunks.length; ci++) {
      const m = /^([a-zv]*)([1-5])?$/.exec(chunks[ci]!)!;
      const letters = m[1]!;
      const tone = m[2] ? Number(m[2]) : undefined;
      if (!letters) return null;
      // na3r: an r after a tone number is the erhua of the syllable before.
      const prev = out.at(-1);
      if (letters === 'r' && tone === undefined && prev && !prev.er && ci > 0) {
        out[out.length - 1] = { ...prev, er: true, raw: prev.raw + 'r' };
        continue;
      }
      const last = wi === words.length - 1 && ci === chunks.length - 1 && tone === undefined;
      const parts = splitLetters(letters, last);
      if (!parts) return null;
      if (tone !== undefined) {
        const end = parts.at(-1)!;
        parts[parts.length - 1] = { ...end, tone, raw: end.raw + String(tone) };
      }
      out.push(...parts);
    }
  }
  return out;
}

interface Entry {
  text: string;
  syl: string[];
  tones: number[];
  /** marked reading, as the data writes it */
  py: string;
  hsk: number;
  /** 0 a syllabus word, 1 a word only a character's entry knows, 2 a character off the lists */
  source: 0 | 1 | 2;
  rank: number;
}

export interface ImeIndex {
  entries: Entry[];
  byFirst: Map<string, Entry[]>;
}

function toEntry(text: string, py: string, hsk: number, source: Entry['source'], rank: number): Entry | null {
  const syl: string[] = [];
  const tones: number[] = [];
  for (const p of py.trim().split(/\s+/)) {
    const bare = toneless(p).replace(/[1-5]/g, '');
    if (bare === 'r' && syl.length) continue; // the 儿 of 哪儿
    if (!bare) continue;
    syl.push(bare);
    tones.push(toneOf(p));
  }
  return syl.length ? { text, syl, tones, py: py.replace(/ /g, ''), hsk: hsk || 9, source, rank } : null;
}

export function buildIme(lib: Pick<Library, 'words' | 'characters'>): ImeIndex {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  lib.words.forEach((w, i) => {
    const e = toEntry(w.w, w.py, w.hsk, 0, i);
    if (e) entries.push(e);
    seen.add(w.w);
  });
  // Words the lists leave out but the characters' entries know — 你好 is one.
  const charBand = new Map(lib.characters.map((c) => [c.c, c.hsk]));
  lib.characters.forEach((c, ci) => {
    c.words.forEach((w, wi) => {
      if (seen.has(w.w) || !w.p) return;
      seen.add(w.w);
      const band = w.hsk ?? Math.max(...[...w.w].map((ch) => charBand.get(ch) ?? 9));
      const e = toEntry(w.w, w.p, band, 1, ci * 10 + wi);
      if (e) entries.push(e);
    });
  });
  for (const c of lib.characters) {
    if (seen.has(c.c)) continue;
    c.py.forEach((p, k) => {
      const e = toEntry(c.c, p, c.hsk, 2, c.freq + k * 10000);
      if (e) entries.push(e);
    });
  }
  const byFirst = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byFirst.get(e.syl[0]!) ?? [];
    list.push(e);
    byFirst.set(e.syl[0]!, list);
  }
  return { entries, byFirst };
}

export interface Candidate {
  text: string;
  py: string;
  hsk: number;
  /** typed syllables it uses, from the front */
  uses: number;
}

const fits = (t: Typed, syl: string, tone: number) =>
  (t.partial ? syl.startsWith(t.s) : syl === t.s) && (t.tone === undefined || t.tone === tone || (t.tone === 5 && tone === 5));

/**
 * How many typed syllables an entry takes up, and how: 0 all of them and
 * no more, 1 all of them and the word goes on (`nih` → 你好), 2 only the
 * first few. -1 when it does not fit.
 */
function fit(e: Entry, typed: Typed[]): { kind: number; uses: number } | null {
  const n = typed.length;
  const k = Math.min(n, e.syl.length);
  for (let i = 0; i < k; i++) if (!fits(typed[i]!, e.syl[i]!, e.tones[i]!)) return null;
  // A begun syllable in the middle of a word cannot be.
  if (k < n && typed.slice(0, k).some((t) => t.partial)) return null;
  if (e.syl.length === n) return { kind: 0, uses: n };
  if (e.syl.length > n) return typed.at(-1)!.partial || n > 0 ? { kind: 1, uses: n } : null;
  return typed[k - 1]!.partial ? null : { kind: 2, uses: k };
}

export function candidates(input: string, ime: ImeIndex, limit = 12): Candidate[] {
  const typed = parseTyped(input);
  if (!typed?.length) return [];
  const first = typed[0]!;
  const pool = first.partial ? ime.entries.filter((e) => e.syl[0]!.startsWith(first.s)) : (ime.byFirst.get(first.s) ?? []);
  const er = typed.some((t) => t.er);
  const scored: Array<{ e: Entry; kind: number; uses: number }> = [];
  for (const e of pool) {
    const f = fit(e, typed);
    if (f) scored.push({ e, ...f });
  }
  scored.sort(
    (a, b) =>
      a.kind - b.kind ||
      b.uses - a.uses ||
      // `nar`: 哪儿 before 哪.
      Number(er && !a.e.text.endsWith('儿')) - Number(er && !b.e.text.endsWith('儿')) ||
      Number(a.e.hsk > 2) - Number(b.e.hsk > 2) ||
      a.e.hsk - b.e.hsk ||
      a.e.source - b.e.source ||
      a.e.rank - b.e.rank,
  );
  const out: Candidate[] = [];
  const shown = new Set<string>();
  for (const { e, uses } of scored) {
    if (shown.has(e.text)) continue;
    shown.add(e.text);
    out.push({ text: e.text, py: e.py, hsk: e.hsk, uses });
    if (out.length >= limit) break;
  }
  return out;
}

/** What stays in the field after picking a candidate that used `uses` syllables. */
export function rest(input: string, uses: number): string {
  const typed = parseTyped(input);
  if (!typed) return input;
  return typed
    .slice(uses)
    .map((t) => t.raw)
    .join('');
}
