import { parseResponse } from './parse';
import { isHanzi, type GeneratedText, type GrammarNote, type TextLine, type TextWord } from './text';

/**
 * A pasted text explained by the learner's own chat with Claude (T4): the
 * prompt to copy, and the answer brought back and laid over the text.
 *
 * The Chinese is the learner's and is never taken from the answer: each line
 * of the answer is matched to a line of the text by its characters, and only
 * its English (and pinyin, when given) is kept. A line Claude changed is
 * named, and keeps what it had.
 */

const FENCE = '```';

/** What an explanation adds to a text; everything else of it stays as it was. */
export type Explanation = Pick<GeneratedText, 'lines' | 'vocab' | 'questions' | 'grammar' | 'note' | 'title' | 'model'>;

export const EXPLAINED = 'explained';

export function explainPrompt(text: Pick<GeneratedText, 'lines' | 'title' | 'titleZh' | 'basis'>): string {
  const known = text.basis.length ? text.basis.join('') : '(none yet)';
  const lines = text.lines.map((l, i) => `${i + 1}. ${l.zh}`).join('\n');
  return [
    `I am learning Chinese from English. Below is a Chinese text I want to read, one sentence a line. Please explain it for me.`,
    ``,
    `Do not change the Chinese: copy each sentence's "zh" exactly as it is here, in the same order, one entry per line — even if you think a character is a typo (say so in the note instead).`,
    ``,
    `The characters of this text I already know: ${known}`,
    ``,
    `Give me:`,
    `- each line's pinyin with tone marks, word by word, and a natural English translation;`,
    `- an English title;`,
    `- the words in it worth learning: any word with a character I do not know yet, up to 30, in the order they come, with pinyin and a short English meaning;`,
    `- 2 to 4 grammar points the text shows, each with its sentence from the text and that sentence in English;`,
    `- 3 short questions in simple Chinese about what happens, with pinyin, English and a short answer in Chinese;`,
    `- one line of advice: what to watch for when reading it.`,
    ``,
    `Reply with one ${FENCE}json block and nothing else, shaped like this:`,
    ``,
    `${FENCE}json`,
    `{`,
    `  "title": "A day in the park",`,
    `  "lines": [`,
    `    { "zh": "小明今天很高兴。", "py": "Xiǎo Míng jīntiān hěn gāoxìng.", "en": "Xiao Ming is very happy today." }`,
    `  ],`,
    `  "vocab": [ { "w": "高兴", "py": "gāoxìng", "d": "happy, glad" } ],`,
    `  "grammar": [ { "point": "很 + adjective as the predicate", "zh": "小明今天很高兴。", "en": "Xiao Ming is very happy today." } ],`,
    `  "questions": [ { "zh": "小明今天怎么样？", "py": "Xiǎo Míng jīntiān zěnmeyàng?", "en": "How is Xiao Ming today?", "a": "他很高兴。" } ],`,
    `  "note": "Watch 了 at the ends of sentences: it marks a change."`,
    `}`,
    FENCE,
    ``,
    `The text${text.titleZh ? ` (${text.titleZh})` : ''}:`,
    ``,
    lines,
  ].join('\n');
}

/** A sentence as compared: its characters and nothing else, so a space or a different comma is no change. */
const bare = (s: string) => [...s].filter(isHanzi).join('');

export interface ExplainResult {
  /** what to lay over the text, or null when the answer could not be used */
  patch: Explanation | null;
  /** lines given their English, of the text's */
  matched: number;
  total: number;
  /** the text's lines (1-based) the answer had no matching sentence for */
  missing: number[];
  problems: string[];
}

export function explanationOf(text: GeneratedText, raw: string): ExplainResult {
  const total = text.lines.length;
  const parsed = parseResponse(raw);
  const draft = parsed.drafts[0];
  if (!draft) return { patch: null, matched: 0, total, missing: [], problems: parsed.problems.length ? parsed.problems : ['No answer found in what was pasted.'] };

  // Each of the answer's sentences, by its characters, the first of each kept.
  const byChars = new Map<string, TextLine>();
  for (const l of draft.lines) if (!byChars.has(bare(l.zh))) byChars.set(bare(l.zh), l);

  const missing: number[] = [];
  const lines = text.lines.map((l, i) => {
    const got = byChars.get(bare(l.zh));
    if (!got || !got.en) {
      missing.push(i + 1);
      return l;
    }
    return { ...l, en: got.en, py: got.py || l.py };
  });
  const matched = total - missing.length;
  const problems: string[] = [];
  if (!matched) {
    return {
      patch: null,
      matched,
      total,
      missing,
      problems: ['None of its sentences are the text’s own: Claude changed the Chinese, or this is the answer for another text.'],
    };
  }
  if (missing.length) problems.push(`Line${missing.length === 1 ? '' : 's'} ${missing.join(', ')} came back changed or without English, and keep what they had.`);

  const inText = bare(text.lines.map((l) => l.zh).join(''));
  const vocab: TextWord[] = draft.vocab
    .filter((w) => w.w && inText.includes(bare(w.w)))
    .map((w) => ({ w: w.w, py: w.py, d: w.d, isNew: [...w.w].some((c) => isHanzi(c) && !text.basis.includes(c)) }));
  const grammar: GrammarNote[] = draft.grammar.filter((g) => g.point);
  return {
    patch: {
      lines,
      // The dictionary's list stays when the answer brought none.
      vocab: vocab.length ? vocab : text.vocab,
      questions: draft.questions,
      grammar,
      note: draft.note || text.note,
      // A Chinese title keeps its place; the English one is what was missing.
      title: draft.title && draft.title !== 'Untitled' && text.titleZh ? draft.title : text.title,
      model: EXPLAINED,
    },
    matched,
    total,
    missing,
    problems,
  };
}

/** Whether a text's lines carry English: what decides, between two copies of it, which explanation is kept. */
export const isExplained = (t: Pick<GeneratedText, 'lines'>) => t.lines.some((l) => l.en);
