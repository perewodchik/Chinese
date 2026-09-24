import type { Library } from '../data/types';
import type { CollectionWord } from './collection';
import {
  arrayOf,
  asLine,
  balancedEnd,
  fences,
  pick,
  spans,
  tryParse,
  type Bag,
  type Route,
} from './parse';
import { hanziIn, type TextLine } from './text';
import { wordIndex } from './vocab';

/**
 * Collections written to order.
 *
 * A ready-made set answers "what is in HSK 2". It cannot answer "I am seeing a
 * doctor on Thursday about my stomach" — that list does not exist until
 * somebody who knows the situation writes it, and the useful version comes
 * with more than a gloss: what the word is really for, what it goes with, and
 * the sentence you will actually say.
 *
 * It works the way the reading passages do: the app writes a brief, you take
 * it to Claude, and the answer is pasted back and checked. What comes back is
 * a collection like any other — its characters go on practice sheets — with
 * the words themselves kept beside it, explained.
 */

export type ListStep = 'describe' | 'prompt' | 'paste';

export const LIST_STEPS: Array<{ id: ListStep; label: string; hint: string }> = [
  { id: 'describe', label: 'Describe', hint: 'What it is for' },
  { id: 'prompt', label: 'Prompt', hint: 'Copy it into Claude' },
  { id: 'paste', label: 'Paste back', hint: 'Bring the words home' },
];

export const LIST_SIZES = [10, 15, 20, 30, 40];

export type ListLang = 'en' | 'ru';

export const LIST_LANGS: Array<{ id: ListLang; label: string; name: string }> = [
  { id: 'en', label: 'English', name: 'English' },
  { id: 'ru', label: 'Русский', name: 'Russian' },
];

/**
 * The highest band the list may reach for. 0 is no ceiling — the situation
 * decides — and 7 stands for 7–9, the way the syllabus groups them.
 */
export const CEILINGS: Array<{ id: number; label: string }> = [
  { id: 0, label: 'Whatever it needs' },
  { id: 1, label: 'Up to HSK 1' },
  { id: 2, label: 'Up to HSK 2' },
  { id: 3, label: 'Up to HSK 3' },
  { id: 4, label: 'Up to HSK 4' },
  { id: 5, label: 'Up to HSK 5' },
  { id: 6, label: 'Up to HSK 6' },
  { id: 7, label: 'Up to HSK 7–9' },
];

export const hskLabel = (band: number | null) =>
  band === null ? 'beyond HSK' : band >= 7 ? 'HSK 7–9' : `HSK ${band}`;

/**
 * A list being written, kept between visits.
 *
 * Saved to the account for the same reason the reading session is: the middle
 * step happens in another tab, and sometimes on another device.
 */
export interface WordListPlan {
  id: string;
  name: string;
  createdAt: number;
  /** the topic, or the situation to get ready for, in your own words */
  request: string;
  /** how many entries to ask for */
  size: number;
  /** the highest HSK band to reach for; 0 for no ceiling */
  ceiling: number;
  /** allow short set phrases alongside single words */
  phrases: boolean;
  /** the language the explanations are written in */
  lang: ListLang;
  /** what you pasted back, kept so a reload does not lose it */
  response: string;
  step: ListStep;
  copiedAt?: number;
}

export const emptyListPlan = (id: string, at: number): WordListPlan => ({
  id,
  name: 'New word list',
  createdAt: at,
  request: '',
  size: 20,
  ceiling: 0,
  phrases: true,
  lang: 'en',
  response: '',
  step: 'describe',
});

export const LIST_IDEAS = [
  'Seeing a doctor about a stomach ache',
  'Renting a flat and talking to the landlord',
  'A job interview at a Chinese company',
  'Ordering food and asking what is in it',
  'Opening a bank account',
  'Taking a taxi and giving directions',
  'Small talk with colleagues at lunch',
  'Complaining politely at a hotel reception',
  'Buying a SIM card and a phone plan',
  'Talking about my hobbies',
  'Reading the signs at a train station',
  'Saying how I feel, and why',
  'Weather, seasons and what to wear',
  'Moving house and everything in it',
];

/* ----------------------------------------------------------------- prompt */

const FENCE = '```';

const list = (items: string[]) => items.map((s) => `- ${s}`).join('\n');

function ceilingBrief(ceiling: number): string {
  if (!ceiling) {
    return 'Whatever the situation really needs. Do not leave out the word I will actually hear just because it is advanced — I would rather learn one hard word I need than three easy ones I do not.';
  }
  const band = hskLabel(ceiling);
  return `Stay at ${band} and below wherever you can. If the situation cannot be handled without a harder word, include it, but no more than two or three of those, and give their band honestly.`;
}

const SHAPE = `{
  "title": "At the doctor's",
  "titleZh": "看病",
  "note": "Most clinics in China make you register (挂号) before you see anyone …",
  "words": [
    {
      "w": "挂号",
      "py": "guà hào",
      "d": "to register (at a hospital)",
      "hsk": 5,
      "explain": "The first thing you do at a Chinese hospital: you pay a small fee at the 挂号 window, or in an app, for a slot with a department. 挂号费 is that fee.",
      "examples": [
        { "zh": "我想挂一个内科的号。", "py": "wǒ xiǎng guà yí gè nèi kē de hào.", "tr": "I'd like to register for internal medicine." },
        { "zh": "你挂号了吗？", "py": "nǐ guà hào le ma?", "tr": "Have you registered?" }
      ]
    }
  ]
}`;

/**
 * The brief, as markdown for a person to paste into Claude.
 *
 * The inventory goes in so the examples can be written round the new word in
 * characters that are already mine — an example sentence with four other
 * unknowns in it does not show the word, it hides it.
 */
export function buildListPrompt(plan: WordListPlan, known: string[]): string {
  const lang = LIST_LANGS.find((l) => l.id === plan.lang)?.name ?? 'English';
  const out: string[] = [];

  out.push(`# ${plan.name.trim() || 'Chinese vocabulary'} — ${plan.size} entries`);
  out.push('');
  out.push(
    'You are my Chinese teacher. I am learning Mandarin on the HSK syllabus (the 2026 word lists), and I want the vocabulary for one particular thing — chosen by you, explained properly, and shown in use. I will learn to read these words and practise writing their characters by hand.',
  );
  out.push('');

  out.push('## What I need it for');
  out.push('');
  out.push(plan.request.trim() || 'Everyday life — the words I would need most often.');
  out.push('');

  out.push('## What to give me');
  out.push('');
  out.push(
    list([
      `**How many:** ${plan.size} entries.`,
      `**Level:** ${ceilingBrief(plan.ceiling)}`,
      plan.phrases
        ? '**Kinds:** mostly single words. Up to a quarter may be short set phrases or chunks said as one piece (请问, 怎么办, 我想要…) where the situation is really carried by them. No full sentences as entries — those belong in the examples.'
        : '**Kinds:** single words only — no phrases, no sentences.',
      '**Order:** the order I should learn them in — the ones I cannot manage without first.',
      `**Language:** every explanation, meaning and translation in ${lang}.`,
    ]),
  );
  out.push('');

  if (known.length) {
    out.push(`## What I can already read — ${known.length} characters`);
    out.push('');
    out.push(known.join(''));
    out.push('');
    out.push(
      'Use this for two things. Do not spend entries on words I obviously know already — though a word built only out of characters I know can still be new to me as a word, and is fair to include. And write the example sentences round the new word in characters from this list wherever you can, so the word is the only thing in the sentence I have to work out.',
    );
    out.push('');
  }

  out.push('## For each entry');
  out.push('');
  out.push(
    list([
      '`w` — the word, in simplified characters.',
      '`py` — pinyin with tone marks, lower case, syllables of one word kept together (`guà hào`), no punctuation.',
      `\`d\` — a short meaning, a few words, in ${lang}.`,
      '`hsk` — its band on the 2026 HSK word lists as a number, 1 to 6, 7 for bands 7–9, or null if it is not on them. Be honest: I check these.',
      `\`explain\` — two to four sentences in ${lang}: what it means exactly, how it is used in this situation, what it goes with, whether it is spoken or written, polite or blunt — and the mistake a learner makes with it, or how it differs from the near-synonym I might reach for instead.`,
      `\`examples\` — two or three sentences using it the way I would need to in this situation, each as \`zh\`, \`py\` and \`tr\` (a natural ${lang} translation of the whole sentence). Keep everything around the word simple.`,
    ]),
  );
  out.push('');
  out.push(
    list([
      `\`title\` — a short name for the list, in ${lang}. \`titleZh\` — the same in Chinese.`,
      `\`note\` — three to five sentences in ${lang} about the situation itself: how it usually goes in China, what I will be asked, what to say first, what would surprise a foreigner.`,
    ]),
  );
  out.push('');

  out.push('## What to send back');
  out.push('');
  out.push(
    'One JSON code block and nothing else — no commentary before it, none after it. I paste it straight back into my app, so the shape matters more than the prose:',
  );
  out.push('');
  out.push(`${FENCE}json`);
  out.push(SHAPE);
  out.push(FENCE);
  out.push('');
  out.push(
    'Before you answer, read the list back: every example has to contain its word, every pinyin has to match its characters, and no word should appear twice.',
  );

  return out.join('\n');
}

/* ------------------------------------------------------------------ parse */

export interface DraftList {
  title: string;
  titleZh: string;
  note: string;
  words: CollectionWord[];
}

export interface ListParse {
  list: DraftList;
  route: Route;
  problems: string[];
}

function asBand(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v.replace(/\D+/g, ' ').trim(), 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(7, Math.round(n));
}

function asWord(v: unknown): CollectionWord | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Bag;
  const w = pick(o, 'w', 'word', 'hanzi', 'zh', 'term', 'phrase', 'chinese');
  if (!w || !hanziIn(w).length) return null;
  return {
    w,
    py: pick(o, 'py', 'pinyin', 'p', 'reading'),
    d: pick(o, 'd', 'def', 'definition', 'meaning', 'gloss', 'en', 'english', 'tr', 'translation'),
    hsk: asBand(o.hsk ?? o.level ?? o.band),
    explain: pick(o, 'explain', 'explanation', 'usage', 'notes', 'note', 'comment'),
    examples: arrayOf(o, 'examples', 'example', 'sentences', 'uses')
      .map(asLine)
      .filter((l): l is TextLine => l !== null),
  };
}

const LIST_KEYS = ['words', 'entries', 'vocab', 'vocabulary', 'items', 'list'];

function harvest(v: unknown, into: DraftList, seen: Set<string>) {
  if (Array.isArray(v)) {
    v.forEach((x) => harvest(x, into, seen));
    return;
  }
  if (!v || typeof v !== 'object') return;
  const o = v as Bag;
  const key = LIST_KEYS.find((k) => Array.isArray(o[k]));
  if (key) {
    into.title ||= pick(o, 'title', 'name', 'titleEn');
    into.titleZh ||= pick(o, 'titleZh', 'title_zh', 'chineseTitle', 'zhTitle');
    into.note ||= pick(o, 'note', 'intro', 'overview', 'advice', 'situation');
    harvest(o[key], into, seen);
    return;
  }
  const word = asWord(o);
  if (word) {
    if (!seen.has(word.w)) {
      seen.add(word.w);
      into.words.push(word);
    }
    return;
  }
  for (const child of Object.values(o)) {
    if (child && typeof child === 'object') harvest(child, into, seen);
  }
}

/** Entries pulled out one at a time, for a reply that is not valid JSON end to end. */
function salvage(raw: string, into: DraftList, seen: Set<string>) {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{') continue;
    if (!/^\{\s*"(w|word)"\s*:/.test(raw.slice(i, i + 40))) continue;
    const end = balancedEnd(raw, i);
    const parsed = tryParse(end < 0 ? raw.slice(i) : raw.slice(i, end + 1));
    if (parsed) harvest(parsed.value, into, seen);
    if (end < 0) break;
    i = end;
  }
}

/**
 * Claude's answer, read as forgivingly as the passages are: the code block,
 * then the whole paste, then any JSON in it, and finally entry by entry.
 */
export function parseWordList(raw: string): ListParse {
  const list: DraftList = { title: '', titleZh: '', note: '', words: [] };
  if (!raw.trim()) return { list, route: 'none', problems: [] };

  const seen = new Set<string>();
  let route: Route = 'none';

  for (const block of fences(raw)) {
    const parsed = tryParse(block);
    if (!parsed) continue;
    const before = list.words.length;
    harvest(parsed.value, list, seen);
    if (list.words.length > before && route !== 'repaired') route = parsed.repaired ? 'repaired' : 'clean';
  }

  if (!list.words.length) {
    for (const c of [raw, ...spans(raw)]) {
      const parsed = tryParse(c);
      if (!parsed) continue;
      harvest(parsed.value, list, seen);
      if (list.words.length) {
        route = parsed.repaired ? 'repaired' : 'clean';
        break;
      }
    }
  }

  const problems: string[] = [];
  if (!list.words.length) {
    salvage(raw, list, seen);
    if (list.words.length) {
      route = 'salvaged';
      problems.push(
        'The reply was not valid JSON end to end, so the words were read out of it one at a time. Check them below before saving.',
      );
    }
  }
  if (!list.words.length) {
    problems.push('No words found. Paste Claude’s whole reply, including the ```json block — or ask it to send the JSON again.');
  }
  return { list, route, problems };
}

/**
 * The band the syllabus gives a word, where it has one.
 *
 * The library knows the ten thousand words of the 2026 lists and their bands,
 * and a few thousand more that its characters are read in; for those, its
 * answer beats the writer's memory of it. Everything else keeps what the
 * writer said.
 */
export function checkedBand(lib: Library, w: CollectionWord): { hsk: number | null; checked: boolean } {
  const known = lib.byWord.get(w.w) ?? wordIndex(lib).get(w.w);
  if (known) return { hsk: known.hsk, checked: true };
  return { hsk: w.hsk, checked: false };
}

/** Every distinct character in the words, in the order they are met. */
export const charsOfWords = (words: CollectionWord[]): string[] =>
  hanziIn(words.map((w) => w.w).join(''));
