import type { GeneratedText } from '../../domain/text';


/**
 * The parts of a text, as the strip at the top of the page names them.
 *
 * They are parts of one text, not steps: read it, write it out, hear it, take
 * the words worth having, answer the questions — in any order, as often as
 * you like. Each fills the line under its name as it is done, so coming back
 * to a text shows at a glance what is left of it. Listening counts as far as
 * the voice has got, and is done once the text has been heard to the end.
 *
 * Translating and dictation are there too, under More, and count for nothing:
 * they are ways of going over the text, not things to finish.
 */
export type PartId = 'read' | 'write' | 'listen' | 'words' | 'questions';
export type TabId = PartId | 'more';

export const PARTS: Array<{ id: PartId; han: string; label: string }> = [
  { id: 'read', han: '读', label: 'Text' },
  { id: 'write', han: '写', label: 'Write' },
  { id: 'words', han: '词', label: 'Words' },
  { id: 'questions', han: '问', label: 'Questions' },
  // Last: the bottom bar plays the reading while the text is read; the part is for listening again.
  { id: 'listen', han: '听', label: 'Listen' },
];

export const MORE = { id: 'more' as const, han: '更', label: 'More' };

const hanCount = (text: GeneratedText) => text.lines.reduce((n, l) => n + [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length, 0);

/** How far each part has got, from nothing (0) to done (1). */
export function partFill(text: GeneratedText, wordDone: (w: string) => boolean): Record<PartId, number> {
  const s = text.study ?? {};
  // A word counts once you know it or have put it on the list to learn: see useWordDone.
  const words = text.vocab.length ? text.vocab.filter((w) => wordDone(w.w)).length / text.vocab.length : 0;
  const answered = text.questions.length ? (s.answered ?? []).length / text.questions.length : 1;
  return {
    read: text.read ? 1 : 0,
    write: Math.min(1, (s.copied ?? 0) / (hanCount(text) || 1)),
    listen: s.listens || s.heard ? 1 : Math.min(1, (s.listened ?? 0) / (text.lines.length || 1)),
    words: Math.min(1, words),
    questions: Math.min(1, answered),
  };
}

/**
 * The parts a text has: no questions, no Questions; no word list, no Words to
 * count (the part is still there to read its grammar, but it is not a thing to
 * finish). Every text can be copied out, so Write is always there.
 */
export function partsOf(text: GeneratedText): typeof PARTS {
  return PARTS.filter((p) => (p.id !== 'questions' || text.questions.length > 0) && (p.id !== 'words' || text.vocab.length > 0));
}
