/**
 * Reading passages, and the plan that produces them.
 *
 * The point is not to have something to read — there is plenty to read. It is
 * that a text built out of what you know, reaching a little past it, is the one
 * place where knowing three hundred characters *feels* like three hundred
 * characters, and the one place where the three hundred and first arrives
 * inside a sentence instead of on a flashcard.
 *
 * Nothing here talks to an API. A plan turns into a prompt you paste into
 * Claude yourself, and Claude's answer is pasted back; the app's job is to
 * decide what to ask for, and to be very good at reading what comes back.
 */

export type TextLength = 'short' | 'medium' | 'long';

export const LENGTHS: Array<{
  id: TextLength;
  label: string;
  sentences: string;
  /** what the prompt asks for */
  range: [number, number];
}> = [
  { id: 'short', label: 'Short', sentences: '4–6 sentences', range: [4, 6] },
  { id: 'medium', label: 'Medium', sentences: '8–12 sentences', range: [8, 12] },
  { id: 'long', label: 'Long', sentences: '14–20 sentences', range: [14, 20] },
];

/**
 * How far out of the comfort zone a passage goes.
 *
 * One dial, not two. "How hard are the sentences" and "how rare is the
 * vocabulary" are the same question asked twice: a passage that reaches for
 * HSK 5 words is not going to say them in five-character sentences. So the
 * level says how far past what I can already read this one should go, and the
 * writer decides what that means for both.
 */
export type Level = 'comfort' | 'edge' | 'stretch' | 'beyond';

export const LEVELS: Array<{
  id: Level;
  label: string;
  blurb: string;
  /** the instruction the prompt carries */
  brief: string;
}> = [
  {
    id: 'comfort',
    label: 'Comfortable',
    blurb: 'Inside what I know, plainly said.',
    brief:
      'Stay close to home. Sentences of 4 to 10 characters, one idea each, no subordinate clauses, everyday words only. Anything new should be among the most common characters I have not met yet — the ones I would run into next anyway. The kind of passage I can read aloud on the first try.',
  },
  {
    id: 'edge',
    label: 'A step past',
    blurb: 'Everyday Chinese, a little further.',
    brief:
      'Ordinary written Chinese. Sentences of 6 to 14 characters, joined with 和 / 也 / 但是 / 因为 and the like. Anything new can be a common everyday character just past my list, and the words built from it should be ones I would actually use this month.',
  },
  {
    id: 'stretch',
    label: 'Stretch',
    blurb: 'Longer sentences, less common words.',
    brief:
      'Make me work a little. Sentences of 8 to 20 characters, with 的 modifying clauses, 了 / 过 / 着 used properly, and time and place stated the Chinese way rather than the English way. Reach further for vocabulary where the topic wants it — less common characters, up to the stretch ceiling.',
  },
  {
    id: 'beyond',
    label: 'Well beyond',
    blurb: 'Whatever the subject really needs.',
    brief:
      'Natural adult Chinese: multi-clause sentences, 把 / 被 where they belong, set phrases and a rhythm a native reader would not correct. Take whatever vocabulary the topic really needs, up to the stretch ceiling, including words I have no chance of guessing — you are going to gloss them for me anyway.',
  },
];

/** What the passage is, as a piece of writing. */
export type Genre =
  | 'story'
  | 'dialogue'
  | 'diary'
  | 'letter'
  | 'description'
  | 'news'
  | 'howto'
  | 'legend';

export const GENRES: Array<{ id: Genre; label: string; brief: string }> = [
  { id: 'story', label: 'Story', brief: 'a small story with a beginning and an end' },
  {
    id: 'dialogue',
    label: 'Dialogue',
    brief: 'a conversation between two people, one turn per line',
  },
  { id: 'diary', label: 'Diary', brief: 'a diary entry written in the first person' },
  { id: 'letter', label: 'Letter', brief: 'a short letter or message to a friend' },
  {
    id: 'description',
    label: 'Description',
    brief: 'a description of a place, a person or a routine',
  },
  { id: 'news', label: 'News', brief: 'a short plain news item, told factually' },
  { id: 'howto', label: 'How-to', brief: 'simple instructions, step by step' },
  { id: 'legend', label: 'Legend', brief: 'a folk tale or legend, retold simply' },
];

export interface TextLine {
  zh: string;
  py: string;
  en: string;
  /** the same sentence in traditional characters, when it was asked for */
  zht?: string;
  /** this sentence starts a new paragraph */
  p?: boolean;
  /** for a comprehension question: the answer the writer had in mind */
  a?: string;
}

export interface TextWord {
  w: string;
  py: string;
  d: string;
  /** built from one of this text's new characters */
  isNew?: boolean;
}

/** A grammar point the passage was written to show. */
export interface GrammarNote {
  point: string;
  /** the sentence from the passage that shows it */
  zh: string;
  en: string;
}

/* ------------------------------------------------------------- HSK bands */

/**
 * The bands a passage can be pitched at. HSK 3.0 has nine, but 7 to 9 is one
 * exam and one syllabus band in the library, so it is one choice here too.
 */
export const HSK_BANDS: Array<{ id: number; label: string }> = [
  { id: 1, label: 'HSK 1' },
  { id: 2, label: 'HSK 2' },
  { id: 3, label: 'HSK 3' },
  { id: 4, label: 'HSK 4' },
  { id: 5, label: 'HSK 5' },
  { id: 6, label: 'HSK 6' },
  { id: 7, label: 'HSK 7–9' },
];

export const hskLabel = (band: number) =>
  HSK_BANDS.find((b) => b.id === band)?.label ?? `HSK ${band}`;

export const clampBand = (n: number) => Math.min(7, Math.max(1, Math.round(n) || 1));

/**
 * How a passage is put together.
 *
 * `flow` is prose that runs on — paragraphs, sentences leaning on the one
 * before. `units` is the textbook shape: short self-contained exchanges or
 * steps, each readable on its own.
 */
export type Structure = 'flow' | 'units';

export const STRUCTURES: Array<{ id: Structure; label: string; brief: string }> = [
  {
    id: 'flow',
    label: 'Flowing',
    brief:
      'Continuous prose in one to three paragraphs. Let sentences lean on each other — pronouns, 就 / 还 / 所以, a time phrase carried over — the way a real paragraph does. Do not write one isolated fact per line.',
  },
  {
    id: 'units',
    label: 'In parts',
    brief:
      'Short self-contained units — dialogue exchanges, steps or small scenes — each readable on its own. Start a new paragraph for each unit.',
  },
];

/**
 * What the new-character number means.
 *
 * `soft`: roughly this many, the writer chooses. `strict`: the words and
 * characters in the spec's include list must all appear, and the number is
 * whatever they come to plus a little.
 */
export type VocabMode = 'soft' | 'strict';

export const VOCAB_MODES: Array<{ id: VocabMode; label: string; blurb: string }> = [
  { id: 'soft', label: 'About this many', blurb: 'A target — Claude picks what the topic needs' },
  { id: 'strict', label: 'Must include', blurb: 'Every word on your list appears in the passage' },
];

/** Which script the passage is written in, beside the simplified it is always checked against. */
export type Script = 'simplified' | 'both';

/* --------------------------------------------------------------- the plan */

/**
 * One passage, as it is asked for.
 *
 * `newCount` is a budget, not a list. Which characters get taught is the
 * writer's decision — asking for "about six new ones" and letting the passage
 * choose them is what lets it be *about* something, instead of being six
 * characters with a story wrapped round them. The app finds out what was new
 * when the answer comes back, which is early enough to print it.
 */
export interface TextSpec {
  /** t1, t2 … — how a passage in the answer is matched back to its brief */
  id: string;
  topic: string;
  length: TextLength;
  level: Level;
  genre: Genre;
  /**
   * Roughly how many characters it should introduce — a density target, not a
   * cap. Characters inside words at or under the HSK band are part of the
   * level; they count towards this, but the passage is not twisted to avoid
   * them.
   */
  newCount: number;
  questions: boolean;
  /** the band the vocabulary is pitched at */
  hsk: number;
  /** the highest band a stretch word may come from */
  ceiling: number;
  structure: Structure;
  vocabMode: VocabMode;
  /** words or characters to work in — required under `strict`, suggestions under `soft` */
  include: string;
}

export type PlanStep = 'plan' | 'prompt' | 'paste';

export const PLAN_STEPS: Array<{ id: PlanStep; label: string; hint: string }> = [
  { id: 'plan', label: 'Plan', hint: 'What to write, and what to teach' },
  { id: 'prompt', label: 'Prompt', hint: 'Copy it into Claude' },
  { id: 'paste', label: 'Paste back', hint: 'Bring the answer home' },
];

/**
 * A writing session, kept between visits.
 *
 * This survives a reload on purpose: the whole workflow involves leaving the
 * app, pasting a prompt into Claude, and coming back some minutes later. A
 * plan that evaporated while you were away would make the feature unusable.
 */
export interface TextPlan {
  id: string;
  name: string;
  createdAt: number;
  /** an existing set to add to, or null to start a new one */
  setId: string | null;
  /** the characters counted as known — what has been marked learned, and nothing else */
  basis: string[];
  /** how many of them were asked for; the basis is the commonest that many */
  basisCount: number;
  /** characters earlier texts already taught: fair to reuse, not new */
  met: string[];
  /**
   * Characters the writer may use as though known, beyond the learned list —
   * a collection being studied this week, say. Counted as known when the
   * answer comes back, so they are never reported as new.
   */
  supplement: string;
  /** simplified only, or simplified with a traditional version of every line */
  script: Script;
  specs: TextSpec[];
  /** what you pasted back, kept so a reload does not lose Claude's answer */
  response: string;
  step: PlanStep;
  /** when the prompt was last copied, for the "waiting for you" line */
  copiedAt?: number;
}

/* -------------------------------------------------------------- the texts */

/** A named session of texts — the collection a batch lands in. */
export interface TextSet {
  id: string;
  name: string;
  createdAt: number;
  note?: string;
  /**
   * The reading order, by text id, once somebody has rearranged it. Texts not
   * listed (added since) follow in the order they were written.
   */
  order?: string[];
}

export interface GeneratedText {
  id: string;
  /** the session it belongs to */
  setId?: string;
  /** English title */
  title: string;
  /** the same title in Chinese */
  titleZh: string;
  topic: string;
  length: TextLength;
  level: Level;
  genre: Genre;
  /** the band and stretch ceiling it was written for, when the brief said */
  hsk?: number;
  ceiling?: number;
  /** the writer's own count of distinct characters per band, kept to compare with ours */
  hskReported?: Record<string, number>;
  createdAt: number;
  model: string;
  lines: TextLine[];
  /** words worth knowing, the new ones flagged */
  vocab: TextWord[];
  /** comprehension questions, if they were asked for */
  questions: TextLine[];
  /** what the passage was written to demonstrate */
  grammar: GrammarNote[];
  /** a line from the teacher: what to watch for here */
  note: string;
  /** every character in it that was new to you, in order of appearance */
  teach: string[];
  /** what the writer said about those, for the ones the library cannot gloss */
  glosses: Record<string, { py: string; d: string }>;
  /** the characters the writer was allowed to assume you could already read */
  basis: string[];
  /** true once you have read it */
  read: boolean;
  /**
   * How many times it has been read, and when last.
   *
   * A passage read once is a passage you decoded; a passage read three times
   * over a fortnight is a passage you can read. Re-reading the same text is one
   * of the few interventions that reliably moves reading *speed* rather than
   * vocabulary, and it costs nothing to write down.
   */
  reads?: number;
  lastReadAt?: number;
}

export const TOPICS = [
  'A day at home',
  'Ordering in a restaurant',
  'Meeting a new neighbour',
  'Taking the train',
  'Talking about the weather',
  'At the market',
  'My family',
  'Learning Chinese',
  'A phone call with a friend',
  'Going to the doctor',
  'Renting a flat',
  'A weekend in the mountains',
  'Buying clothes',
  'Work and study',
  'Cooking dinner',
  'Losing something on the bus',
  'A cat that will not come inside',
  'The first day of a new job',
  'Tea, and how to make it badly',
  'A river and what lives beside it',
];

/**
 * A topic nobody in this session has taken yet.
 *
 * Two passages about the market in one evening is not variety, and it is what
 * a plain random pick gives you roughly one time in five.
 */
export function pickTopic(used: ReadonlySet<string>): string {
  const free = TOPICS.filter((t) => !used.has(t));
  const pool = free.length ? free : TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const HANZI = /[一-鿿]/;

export const isHanzi = (c: string) => HANZI.test(c);

/** Every distinct hanzi in a string, in order of first appearance. */
export function hanziIn(s: string): string[] {
  const seen = new Set<string>();
  for (const ch of s) if (HANZI.test(ch)) seen.add(ch);
  return [...seen];
}

export interface Coverage {
  /** distinct characters in the text */
  total: number;
  /** ...that were in the basis */
  known: number;
  /** ...that were not, in order of appearance: everything new */
  fresh: string[];
  /** 0-1 */
  ratio: number;
}

/**
 * How much of a text you could already read, and what the rest was.
 *
 * Worth computing rather than taking on trust. The writer says which
 * characters it set out to teach; this counts what it actually used, which is
 * the number that decides whether the passage is readable — and the list that
 * decides what goes on the practice sheets.
 */
export function coverageOf(
  text: Pick<GeneratedText, 'lines' | 'questions'>,
  known: ReadonlySet<string>,
): Coverage {
  const seen = new Set<string>();
  const fresh: string[] = [];
  const scan = (s: string) => {
    for (const ch of s) {
      if (!HANZI.test(ch) || seen.has(ch)) continue;
      seen.add(ch);
      if (!known.has(ch)) fresh.push(ch);
    }
  };
  text.lines.forEach((l) => scan(l.zh));
  text.questions.forEach((q) => scan(q.zh));

  const total = seen.size || 1;
  return {
    total: seen.size,
    known: seen.size - fresh.length,
    fresh,
    ratio: (seen.size - fresh.length) / total,
  };
}

export const textCharCount = (t: Pick<GeneratedText, 'lines'>) =>
  t.lines.reduce((n, l) => n + [...l.zh].filter((c) => HANZI.test(c)).length, 0);

export const sentenceRange = (l: TextLength): [number, number] =>
  LENGTHS.find((x) => x.id === l)?.range ?? [8, 12];

export const lengthLabel = (l: TextLength) =>
  LENGTHS.find((x) => x.id === l)?.label ?? 'Medium';

export const levelLabel = (l: Level) => LEVELS.find((x) => x.id === l)?.label ?? 'A step past';

export const genreLabel = (g: Genre) => GENRES.find((x) => x.id === g)?.label ?? 'Story';

export interface Shelf {
  /** each session's texts, by set id, in reading order */
  bySet: Map<string, GeneratedText[]>;
  /** texts with no session that still exists, newest first */
  loose: GeneratedText[];
}

/**
 * Texts as the shelf shows them. Inside a session, reading order: the passage
 * written first is the one to read first. Texts outside any session stay
 * newest first, which is how a shelf works.
 */
export function shelve(texts: GeneratedText[], sets: TextSet[]): Shelf {
  const known = new Set(sets.map((s) => s.id));
  const bySet = new Map<string, GeneratedText[]>();
  const loose: GeneratedText[] = [];
  for (const t of texts) {
    if (t.setId && known.has(t.setId)) {
      const list = bySet.get(t.setId);
      if (list) list.push(t);
      else bySet.set(t.setId, [t]);
    } else {
      loose.push(t);
    }
  }
  const orders = new Map(sets.map((s) => [s.id, s.order ?? []]));
  for (const [id, list] of bySet) {
    const rank = new Map((orders.get(id) ?? []).map((t, i) => [t, i]));
    list.sort((a, b) => {
      const ra = rank.get(a.id) ?? Infinity;
      const rb = rank.get(b.id) ?? Infinity;
      return ra !== rb ? ra - rb : a.createdAt - b.createdAt;
    });
  }
  return { bySet, loose };
}
