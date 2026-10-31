import type { Library } from '../data/types';
import { segment } from './segment';
import type { GeneratedText } from './text';

/**
 * A text the learner wrote themselves, to be read aloud in Voices and perhaps
 * kept in Read.
 *
 * Cut into sentences where Chinese ends one (。！？ and a closing quote after
 * them, or a new line), so the narrator's reading lights a line at a time.
 */
export function sentencesOf(raw: string): string[] {
  const out: string[] = [];
  for (const para of raw.split(/\n+/)) {
    const parts = para.trim().match(/[^。！？!?]+(?:[。！？!?]+[”’」』"）)]*)?/g) ?? [];
    for (const p of parts) if (p.trim()) out.push(p.trim());
  }
  return out;
}

/**
 * The pinyin of a sentence, a word at a time as a writer would give it: each
 * word's syllabus reading, else its characters' first readings; punctuation
 * kept as it is.
 */
export function pinyinOf(zh: string, lib: Library): string {
  return segment(zh, lib)
    .map((t) => {
      if (!t.word) return t.text.trim();
      const listed = lib.byWord.get(t.text)?.py;
      return listed || [...t.text].map((c) => lib.byChar.get(c)?.py[0] ?? c).join('');
    })
    .filter(Boolean)
    .join(' ')
    .replace(/ ([，。！？、；：,.!?;:”’」』）)])/g, '$1');
}

/**
 * The text in Read made from it: the sentences with their pinyin, no English
 * (nobody wrote one) and nothing to teach — words, notes and questions can be
 * added later the way any text's are.
 */
export function ownTextForRead(title: string, lines: string[], lib: Library): Omit<GeneratedText, 'id' | 'createdAt' | 'read'> {
  return {
    // Nobody wrote an English title for a Chinese one.
    title: /\p{Script=Han}/u.test(title) ? 'My own text' : title,
    titleZh: title,
    topic: 'My own text',
    length: lines.length <= 6 ? 'short' : lines.length <= 12 ? 'medium' : 'long',
    level: 'comfort',
    genre: 'story',
    model: 'own',
    lines: lines.map((zh, i) => ({ zh, py: pinyinOf(zh, lib), en: '', ...(i === 0 ? { p: true } : {}) })),
    vocab: [],
    questions: [],
    grammar: [],
    note: '',
    teach: [],
    glosses: {},
    basis: [],
  };
}
