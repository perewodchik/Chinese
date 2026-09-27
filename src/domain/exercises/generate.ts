import type { Library } from '../../data/types';
import { TIER_WEIGHT, type Tier } from '../grading';
import { charId, wordId, type ItemId } from '../ids';
import type { Skill } from '../memory';
import { segment } from '../segment';
import { distractors, gist, hanziOnly, itemInfo, sentenceFor, tonesOf, type ItemInfo } from './items';
import type { Rng } from './rng';

/**
 * The exercises, as data: what is on the card and what counts as right.
 *
 * Every generator takes one item and returns a card, or null when the item
 * lacks what the card needs — a photo, a native recording, a sentence whose
 * other characters are all known. The chooser at the bottom only ever picks
 * among cards that came back, so an exercise never appears half-built.
 *
 * The components that draw them are in src/features/exercises; they report
 * how it went (right, slips, time), and the host turns that into a grade with
 * `checkedRating` — or, for the self-graded card, `selfRating`.
 */

/** What one side of a card shows: any of hanzi, pinyin, English, a photo, a sound. */
export interface Face {
  hanzi?: string;
  py?: string;
  en?: string;
  /** a photo's src */
  picture?: string;
  /** text whose native recording plays */
  audio?: string;
}

export interface Option {
  id: string;
  face: Face;
}

export type ExerciseKind =
  | 'pick-meaning'
  | 'pick-hanzi'
  | 'pick-picture'
  | 'pick-listen'
  | 'pick-measure'
  | 'pick-cloze'
  | 'pick-which'
  | 'swipe'
  | 'tiles-word'
  | 'tiles-sentence'
  | 'tiles-listen'
  | 'tiles-reverse'
  | 'tiles-parts'
  | 'tones'
  | 'type-pinyin'
  | 'type-hanzi'
  | 'type-meaning'
  | 'type-dictation'
  | 'speak'
  | 'recall'
  | 'write'
  | 'match';

interface Base {
  kind: ExerciseKind;
  /** the items graded by this card; one, except for a match board */
  ids: ItemId[];
  skill: Skill;
  tier: Tier;
  /** what a right answer is worth to the scheduler */
  weight: number;
  /** one line of instruction over the card */
  ask: string;
}

export type Exercise =
  | (Base & {
      kind: 'pick-meaning' | 'pick-hanzi' | 'pick-picture' | 'pick-listen' | 'pick-measure' | 'pick-cloze' | 'pick-which';
      prompt: Face;
      /** for a gap: the sentence either side of it */
      gap?: { before: string; after: string; en: string };
      options: Option[];
      answer: string;
      /** what is shown once it is settled */
      reveal: Face;
      say: string;
    })
  | (Base & { kind: 'swipe'; prompt: Face; shown: Face; truth: boolean; reveal: Face; say: string })
  | (Base & {
      kind: 'tiles-word' | 'tiles-sentence' | 'tiles-listen' | 'tiles-reverse' | 'tiles-parts';
      prompt: Face;
      tiles: string[];
      answer: string[];
      /** whether the order matters: it does, except for a character's parts */
      ordered: boolean;
      reveal: Face;
      say: string;
    })
  | (Base & { kind: 'tones'; text: string; syllables: Array<{ py: string; bare: string; tone: number }>; gloss: string; say: string })
  | (Base & {
      kind: 'type-pinyin' | 'type-hanzi' | 'type-meaning' | 'type-dictation';
      prompt: Face;
      expect: string;
      /** for a meaning: the definition every sense of which is accepted */
      def?: string;
      reveal: Face;
      say: string;
    })
  | (Base & { kind: 'speak'; text: string; py: string; gloss: string })
  | (Base & { kind: 'recall'; text: string; py: string; gloss: string; question: 'meaning' | 'sound'; example: { zh: string; en: string } | null })
  | (Base & { kind: 'write'; char: string; py: string; gloss: string })
  | (Base & { kind: 'match'; mode: 'meaning' | 'pinyin' | 'listen' | 'picture'; pairs: Array<{ id: ItemId; left: Face; right: Face; say: string }> });

export interface ExerciseContext {
  lib: Library;
  /** characters that may appear un-glossed: learned, or being learned right now */
  known: ReadonlySet<string>;
  /** where wrong answers come from */
  pool: ItemInfo[];
  /** texts with a native recording */
  native: ReadonlySet<string>;
  rng: Rng;
}

/** The characters and words of HSK 1–`band`: the pool wrong answers are drawn from. */
export function distractorPool(lib: Library, band = 2): ItemInfo[] {
  const out: ItemInfo[] = [];
  for (const c of lib.characters) if (c.hsk <= band) out.push(itemInfo(lib, charId(c.c))!);
  for (const w of lib.words) if (w.hsk <= band) {
    const info = itemInfo(lib, wordId(w.w));
    if (info) out.push(info);
  }
  return out.filter(Boolean);
}

const TIER_OF: Record<ExerciseKind, Tier> = {
  'pick-meaning': 'pick',
  'pick-hanzi': 'pick',
  'pick-picture': 'pick',
  'pick-listen': 'pick',
  'pick-measure': 'pick',
  'pick-cloze': 'pick',
  'pick-which': 'pick',
  swipe: 'pick',
  'tiles-word': 'build',
  'tiles-sentence': 'build',
  'tiles-listen': 'build',
  'tiles-reverse': 'build',
  'tiles-parts': 'build',
  tones: 'build',
  match: 'build',
  'type-pinyin': 'type',
  'type-hanzi': 'type',
  'type-meaning': 'type',
  'type-dictation': 'type',
  speak: 'type',
  recall: 'type',
  write: 'type',
};

const base = (kind: ExerciseKind, item: ItemInfo, skill: Skill, ask: string) => ({
  ids: [item.id],
  skill,
  tier: TIER_OF[kind],
  weight: TIER_WEIGHT[TIER_OF[kind]],
  ask,
});

const answerFace = (x: ItemInfo): Face => ({ hanzi: x.text, py: x.py, en: x.gloss, audio: x.text });

/* ------------------------------------------------------------ the generators */

type Make = (ctx: ExerciseContext, item: ItemInfo, skill: Skill) => Exercise | null;

function pickOptions(ctx: ExerciseContext, item: ItemInfo, face: (x: ItemInfo) => Face, n = 3, among?: ItemInfo[]) {
  const wrong = distractors(ctx.lib, item, n, among ?? ctx.pool, ctx.rng.shuffle);
  if (wrong.length < 2) return null;
  return ctx.rng.shuffle([item, ...wrong]).map((x) => ({ id: x.text, face: face(x) }));
}

const MAKE: Partial<Record<ExerciseKind, Make>> = {
  'pick-meaning': (ctx, item) => {
    const options = pickOptions(ctx, item, (x) => ({ en: x.gloss }));
    return options && {
      ...base('pick-meaning', item, 'recognise', 'What does it mean?'),
      kind: 'pick-meaning',
      prompt: { hanzi: item.text },
      options,
      answer: item.text,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'pick-hanzi': (ctx, item) => {
    const options = pickOptions(ctx, item, (x) => ({ hanzi: x.text }));
    return options && {
      ...base('pick-hanzi', item, 'recognise', 'Which one is it?'),
      kind: 'pick-hanzi',
      prompt: { en: item.gloss },
      options,
      answer: item.text,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'pick-picture': (ctx, item) => {
    if (!item.picture) return null;
    // Wrong answers need photos of their own, and different ones.
    const among = ctx.pool.filter((x) => x.picture && x.picture !== item.picture);
    const options = pickOptions(ctx, item, (x) => ({ hanzi: x.text }), 3, among);
    return options && {
      ...base('pick-picture', item, 'recognise', 'Which word is this?'),
      kind: 'pick-picture',
      prompt: { picture: item.picture },
      options,
      answer: item.text,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'pick-listen': (ctx, item, skill) => {
    if (!ctx.native.has(item.text)) return null;
    const options = pickOptions(ctx, item, (x) => ({ hanzi: x.text }));
    return options && {
      ...base('pick-listen', item, skill === 'sound' ? 'sound' : 'recognise', 'Listen. Which one was it?'),
      kind: 'pick-listen',
      prompt: { audio: item.text },
      options,
      answer: item.text,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'pick-measure': (ctx, item) => {
    const right = item.cl[0];
    if (item.kind !== 'word' || !right) return null;
    const common = ['个', '本', '张', '只', '条', '件', '杯', '家', '位', '辆', '双', '块'];
    const wrong = ctx.rng.sample(common.filter((c) => !item.cl.includes(c)), 2);
    return {
      ...base('pick-measure', item, 'recognise', 'Which measure word goes with it?'),
      kind: 'pick-measure',
      prompt: { hanzi: item.text, en: item.gloss },
      gap: { before: '一', after: item.text, en: `one ${item.gloss}` },
      options: ctx.rng.shuffle([right, ...wrong]).map((c) => ({ id: c, face: { hanzi: c } })),
      answer: right,
      reveal: { hanzi: `一${right}${item.text}`, py: `${ctx.lib.byChar.get(right)?.py[0] ?? ''} …`, en: `one ${item.gloss}` },
      say: `一${right}${item.text}`,
    };
  },

  'pick-cloze': (ctx, item) => {
    const s = sentenceFor(ctx.lib, item, ctx.known);
    if (!s) return null;
    const at = s.zh.indexOf(item.text);
    const wrong = distractors(ctx.lib, item, 2, ctx.pool, ctx.rng.shuffle);
    if (wrong.length < 2) return null;
    return {
      ...base('pick-cloze', item, 'recognise', 'Fill the gap.'),
      kind: 'pick-cloze',
      prompt: {},
      gap: { before: s.zh.slice(0, at), after: s.zh.slice(at + item.text.length), en: s.en },
      options: ctx.rng.shuffle([item, ...wrong]).map((x) => ({ id: x.text, face: { hanzi: x.text } })),
      answer: item.text,
      reveal: { hanzi: s.zh, py: s.py, en: s.en },
      say: s.zh,
    };
  },

  'pick-which': (ctx, item) => {
    if (item.kind !== 'char') return null;
    const inside = ctx.pool.filter(
      (x) => x.kind === 'word' && x.chars.length > 1 && x.chars.includes(item.text) && x.chars.every((c) => c === item.text || ctx.known.has(c)),
    );
    if (!inside.length) return null;
    const right = ctx.rng.pick(inside);
    const others = ctx.rng.sample(ctx.pool.filter((x) => x.kind === 'word' && x.chars.length > 1 && !x.chars.includes(item.text) && x.gloss !== right.gloss), 3);
    if (others.length < 3) return null;
    return {
      ...base('pick-which', item, 'recognise', `Which of these is written with ${item.text}?`),
      kind: 'pick-which',
      prompt: { hanzi: item.text },
      options: ctx.rng.shuffle([right, ...others]).map((x) => ({ id: x.text, face: { en: x.gloss } })),
      answer: right.text,
      reveal: answerFace(right),
      say: right.text,
    };
  },

  swipe: (ctx, item) => {
    const truth = ctx.rng.next() < 0.5;
    const other = truth ? item : distractors(ctx.lib, item, 1, ctx.pool, ctx.rng.shuffle)[0];
    if (!other) return null;
    const prompt: Face = item.picture ? { picture: item.picture } : { en: item.gloss };
    return {
      ...base('swipe', item, 'recognise', 'Do these go together?'),
      kind: 'swipe',
      prompt,
      shown: { hanzi: other.text },
      truth,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'tiles-word': (ctx, item) => {
    if (item.chars.length < 2) return null;
    const lookAlikes = item.chars.flatMap((c) => ctx.lib.byChar.get(c)?.conf.slice(0, 1) ?? []);
    const spare = ctx.rng.sample(ctx.pool.filter((x) => x.kind === 'char' && !item.chars.includes(x.text)), 2).map((x) => x.text);
    const extra = [...new Set([...lookAlikes, ...spare])].filter((c) => !item.chars.includes(c)).slice(0, 2);
    return {
      ...base('tiles-word', item, 'recognise', 'Build the word.'),
      kind: 'tiles-word',
      prompt: { en: item.gloss, audio: ctx.native.has(item.text) ? item.text : undefined },
      tiles: ctx.rng.shuffle([...item.chars, ...extra]),
      answer: item.chars,
      ordered: true,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  'tiles-sentence': (ctx, item) => sentenceTiles(ctx, item, 'tiles-sentence'),
  'tiles-listen': (ctx, item) => sentenceTiles(ctx, item, 'tiles-listen'),

  'tiles-reverse': (ctx, item) => {
    const s = sentenceFor(ctx.lib, item, ctx.known);
    if (!s) return null;
    const words = englishWords(s.en);
    if (words.length < 3 || words.length > 9) return null;
    const others = ctx.pool
      .flatMap((x) => x.ex.slice(0, 1))
      .flatMap((x) => englishWords(x.en))
      .filter((w) => !words.includes(w));
    const extra = ctx.rng.sample([...new Set(others)], 2);
    return {
      ...base('tiles-reverse', item, 'recognise', 'Put it into English.'),
      kind: 'tiles-reverse',
      prompt: { hanzi: s.zh, audio: ctx.native.has(s.zh) ? s.zh : undefined },
      tiles: ctx.rng.shuffle([...words, ...extra]),
      answer: words,
      ordered: true,
      reveal: { hanzi: s.zh, py: s.py, en: s.en },
      say: s.zh,
    };
  },

  'tiles-parts': (ctx, item) => {
    if (item.kind !== 'char') return null;
    const e = ctx.lib.byChar.get(item.text);
    if (!e || e.parts.length !== 2) return null;
    const partsElsewhere = [...new Set(ctx.pool.filter((x) => x.kind === 'char').flatMap((x) => ctx.lib.byChar.get(x.text)?.parts ?? []))].filter(
      (p) => !e.parts.includes(p) && [...p].length === 1,
    );
    const extra = ctx.rng.sample(partsElsewhere, 3);
    if (extra.length < 2) return null;
    return {
      ...base('tiles-parts', item, 'write', 'Which two parts is it made of?'),
      kind: 'tiles-parts',
      prompt: { py: item.py, en: item.gloss },
      tiles: ctx.rng.shuffle([...e.parts, ...extra]),
      answer: e.parts,
      ordered: false,
      reveal: answerFace(item),
      say: item.text,
    };
  },

  tones: (_ctx, item, skill) => {
    const syllables = tonesOf(item.py);
    if (!syllables.length || syllables.length > 4) return null;
    return {
      ...base('tones', item, skill === 'sound' ? 'sound' : 'recognise', syllables.length > 1 ? 'Mark the tone of each syllable.' : 'Which tone?'),
      kind: 'tones',
      text: item.text,
      syllables,
      gloss: item.gloss,
      say: item.text,
    };
  },

  'type-pinyin': (_ctx, item, skill) => ({
    ...base('type-pinyin', item, skill === 'sound' ? 'sound' : 'recognise', 'Type the pinyin, tones and all.'),
    kind: 'type-pinyin',
    prompt: { hanzi: item.text },
    expect: item.py,
    reveal: answerFace(item),
    say: item.text,
  }),

  'type-hanzi': (ctx, item) => ({
    ...base('type-hanzi', item, 'recognise', 'Type it in characters.'),
    kind: 'type-hanzi',
    prompt: { en: item.gloss, audio: ctx.native.has(item.text) ? item.text : undefined },
    expect: item.text,
    reveal: answerFace(item),
    say: item.text,
  }),

  'type-meaning': (_ctx, item) => ({
    ...base('type-meaning', item, 'recognise', 'Type what it means, in English.'),
    kind: 'type-meaning',
    prompt: { hanzi: item.text },
    expect: item.gloss,
    def: item.def,
    reveal: answerFace(item),
    say: item.text,
  }),

  'type-dictation': (ctx, item) => {
    const s = sentenceFor(ctx.lib, item, ctx.known);
    if (!s || !ctx.native.has(s.zh)) return null;
    return {
      ...base('type-dictation', item, 'recognise', 'Listen, and type the whole sentence.'),
      kind: 'type-dictation',
      prompt: { audio: s.zh },
      expect: s.zh,
      reveal: { hanzi: s.zh, py: s.py, en: s.en },
      say: s.zh,
    };
  },

  speak: (_ctx, item) =>
    item.kind === 'char'
      ? { ...base('speak', item, 'sound', 'Say it out loud.'), kind: 'speak', text: item.text, py: item.py, gloss: item.gloss }
      : null,

  recall: (ctx, item, skill) => {
    const s = sentenceFor(ctx.lib, item, ctx.known);
    return {
      ...base('recall', item, skill, skill === 'sound' ? 'How is it said? Say it, then look.' : 'What does it mean? Answer, then look.'),
      weight: 1,
      kind: 'recall',
      text: item.text,
      py: item.py,
      gloss: item.def,
      question: skill === 'sound' ? 'sound' : 'meaning',
      example: s ? { zh: s.zh, en: s.en } : null,
    };
  },

  write: (ctx, item) =>
    item.kind === 'char' && ctx.lib.strokes[item.text]?.m
      ? { ...base('write', item, 'write', 'Write it from memory.'), weight: 1, kind: 'write', char: item.text, py: item.py, gloss: item.gloss }
      : null,
};

function englishWords(en: string): string[] {
  return en
    .replace(/[.!?,;:"“”]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceTiles(ctx: ExerciseContext, item: ItemInfo, kind: 'tiles-sentence' | 'tiles-listen'): Exercise | null {
  const s = sentenceFor(ctx.lib, item, ctx.known);
  if (!s) return null;
  if (kind === 'tiles-listen' && !ctx.native.has(s.zh)) return null;
  const words = segment(hanziOnly(s.zh), ctx.lib)
    .map((t) => t.text)
    .filter((t) => hanziOnly(t));
  if (words.length < 3 || words.length > 8) return null;
  const extra = distractors(ctx.lib, item, 2, ctx.pool, ctx.rng.shuffle)
    .map((x) => x.text)
    .filter((t) => !words.includes(t));
  return {
    ...base(kind, item, 'recognise', kind === 'tiles-listen' ? 'Listen, and build what you heard.' : 'Build the sentence.'),
    kind,
    prompt: kind === 'tiles-listen' ? { audio: s.zh } : { en: s.en, audio: undefined },
    tiles: ctx.rng.shuffle([...words, ...extra]),
    answer: words,
    ordered: true,
    reveal: { hanzi: s.zh, py: s.py, en: s.en },
    say: s.zh,
  };
}

/* ------------------------------------------------------------ what fits */

/** Which exercises can ask about which skill, for which kind of item. */
const FOR: Record<Skill, Partial<Record<'char' | 'word', ExerciseKind[]>>> = {
  recognise: {
    char: ['pick-meaning', 'pick-hanzi', 'pick-which', 'swipe', 'tiles-sentence', 'tiles-reverse', 'pick-cloze', 'type-meaning', 'type-hanzi', 'recall'],
    word: [
      'pick-meaning',
      'pick-hanzi',
      'pick-picture',
      'pick-listen',
      'pick-measure',
      'pick-cloze',
      'swipe',
      'tiles-word',
      'tiles-sentence',
      'tiles-listen',
      'tiles-reverse',
      'tones',
      'type-pinyin',
      'type-hanzi',
      'type-meaning',
      'type-dictation',
      'recall',
    ],
  },
  sound: { char: ['pick-listen', 'tones', 'type-pinyin', 'speak', 'recall'] },
  write: { char: ['tiles-parts', 'write'] },
  use: {},
};

/** Every card that can be made for this item and skill right now. */
export function candidates(ctx: ExerciseContext, item: ItemInfo, skill: Skill): Exercise[] {
  const out: Exercise[] = [];
  for (const kind of FOR[skill][item.kind] ?? []) {
    const ex = MAKE[kind]?.(ctx, item, skill);
    if (ex) out.push(ex);
  }
  return out;
}

export function makeExercise(ctx: ExerciseContext, item: ItemInfo, skill: Skill, kind: ExerciseKind): Exercise | null {
  if (!FOR[skill][item.kind]?.includes(kind)) return null;
  return MAKE[kind]?.(ctx, item, skill) ?? null;
}

const TYPED: ReadonlySet<ExerciseKind> = new Set(['type-pinyin', 'type-hanzi', 'type-meaning', 'type-dictation']);

export type Stage = 'easy' | 'normal' | 'hard' | 'review';

/**
 * The card to put in front of the learner for one item and skill.
 *
 * In a lesson the stage says the tier outright. In review it follows how
 * established the item is — a pick while it is young, tiles or tones while it
 * settles, a real recall (or, now and then, something typed) once it holds —
 * and Hard mode moves every card a tier up and prefers the typed form. The
 * last two kinds shown are avoided, so a session never becomes ten picture
 * picks in a row.
 */
export function chooseExercise(
  ctx: ExerciseContext,
  item: ItemInfo,
  skill: Skill,
  opts: { stage: Stage; stability?: number | null; hard?: boolean; recent?: readonly ExerciseKind[]; avoid?: readonly ExerciseKind[] },
): Exercise {
  const avoid = new Set(opts.avoid ?? []);
  const all = candidates(ctx, item, skill).filter((e) => !avoid.has(e.kind));
  const recent = new Set((opts.recent ?? []).slice(-2));
  const s = opts.stability ?? 0;
  const hard = Boolean(opts.hard);

  let tiers: Tier[];
  if (opts.stage === 'easy') tiers = hard ? ['build'] : ['pick'];
  else if (opts.stage === 'normal') tiers = hard ? ['type'] : ['build'];
  else if (opts.stage === 'hard') tiers = ['type'];
  else if (s < 2) tiers = hard ? ['build', 'type'] : ['pick', 'build'];
  else if (s < 21) tiers = hard ? ['type'] : ['build', 'type'];
  else tiers = ['type'];

  const fits = (e: Exercise) => {
    if (!tiers.includes(e.tier)) return false;
    // Typing is Hard mode's, and the lesson's last card's — and an old
    // friend's now and then; otherwise the type tier is recall, speaking
    // and writing.
    if (TYPED.has(e.kind)) return hard || opts.stage === 'hard' || (opts.stage === 'review' && s >= 21 && ctx.rng.next() < 0.35);
    if (opts.stage === 'hard' && e.kind === 'recall') return false;
    return true;
  };

  let pool = all.filter((e) => fits(e) && !recent.has(e.kind));
  if (!pool.length) pool = all.filter(fits);
  if (!pool.length && opts.stage === 'hard') pool = all.filter((e) => e.tier === 'type' && e.kind !== 'recall');
  if (!pool.length) pool = all.filter((e) => e.kind === 'recall' || e.kind === 'write');
  if (!pool.length) pool = all;
  // Hard mode takes the typed form when there is one.
  if (hard) {
    const typed = pool.filter((e) => TYPED.has(e.kind));
    if (typed.length) pool = typed;
  }
  return pool.length ? ctx.rng.pick(pool) : MAKE.recall!(ctx, item, skill)!;
}

/* ------------------------------------------------------------ match boards */

/**
 * A board of pairs to match, for several items at once — the fastest way
 * through a handful of young items, and the way a lesson starts and ends.
 * The pairing is whatever every item on the board has: photos if all have
 * one (and different ones), sounds if all have a native recording, and
 * otherwise meaning or pinyin.
 */
export function makeMatch(ctx: ExerciseContext, items: ItemInfo[], prefer?: 'meaning' | 'pinyin' | 'listen' | 'picture'): Exercise | null {
  const board = items.filter((x, i) => items.findIndex((y) => y.gloss === x.gloss || y.text === x.text) === i).slice(0, 6);
  if (board.length < 3) return null;
  const pictures = new Set(board.map((x) => x.picture));
  const modes: Array<'meaning' | 'pinyin' | 'listen' | 'picture'> = ['meaning', 'pinyin'];
  if (board.every((x) => x.picture) && pictures.size === board.length) modes.push('picture');
  if (board.every((x) => ctx.native.has(x.text))) modes.push('listen');
  const mode = prefer && modes.includes(prefer) ? prefer : ctx.rng.pick(modes);
  const right = (x: ItemInfo): Face =>
    mode === 'meaning' ? { en: x.gloss } : mode === 'pinyin' ? { py: x.py } : mode === 'listen' ? { audio: x.text } : { picture: x.picture! };
  return {
    kind: 'match',
    ids: board.map((x) => x.id),
    skill: 'recognise',
    tier: 'build',
    weight: TIER_WEIGHT.build,
    ask: mode === 'listen' ? 'Match each sound to its characters.' : mode === 'picture' ? 'Match each photo to its word.' : mode === 'pinyin' ? 'Match the characters to their pinyin.' : 'Match the pairs.',
    mode,
    pairs: board.map((x) => ({ id: x.id, left: { hanzi: x.text }, right: right(x), say: x.text })),
  };
}

export { gist };
