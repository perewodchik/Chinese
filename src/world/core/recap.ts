/**
 * "Last time…" (§13 Q3): after a day away a learner forgets both the plot
 * and the words. On opening the game after twelve real hours or more, a
 * small card: 兔儿爷's two or three English lines on what is going on, and
 * the Chinese words of the last session as chips to hear and tap.
 *
 * The save keeps the last session's words (`lastWords`, at most eight):
 * each finished talk adds its situation words and the key words of its
 * hints, newest last.
 */

import { story, type JournalContent } from './journal';
import { whatNow } from './quests';
export { LAST_WORDS, rememberWords } from './save';
import type { Scene, WorldSave } from './types';

export const RECAP_AFTER_MS = 12 * 60 * 60 * 1000;
const HAN = /^[㐀-鿿]+$/;

/** The words a talk teaches: its situation words, then its hints' key words — at most four. */
export function wordsOfScene(scene: Pick<Scene, 'words' | 'nodes'>): string[] {
  const out: string[] = [];
  for (const w of scene.words ?? []) out.push(w.w);
  for (const n of scene.nodes) if (n.hint?.word) out.push(n.hint.word);
  return [...new Set(out.filter((w) => HAN.test(w)))].slice(0, 4);
}

export interface Recap {
  /** 兔儿爷's lines, English */
  lines: string[];
  /** the words to hear again, newest first */
  words: string[];
}

/** What the card says: where the story stood, what is next, the words of last time. Null when there is nothing to recall yet. */
export function recapOf(s: WorldSave, content: JournalContent): Recap | null {
  const chapters = story(s, content);
  const last = chapters.at(-1)?.entries.at(-1)?.past;
  const now = whatNow(s, content.quests);
  const lines: string[] = [];
  if (last) lines.push(`Last time: ${last.charAt(0).toLowerCase()}${last.slice(1)}`);
  if (now) lines.push(`Next: ${now}`);
  const words = [...s.lastWords].reverse().slice(0, 5);
  if (words.length) lines.push(words.length > 1 ? 'And a few words from last time:' : 'And a word from last time:');
  return lines.length ? { lines, words } : null;
}

/** Whether to show it: a save last changed at least twelve hours ago (wall clock). */
export const isAway = (s: WorldSave, now: number) => s.updatedAt > 0 && now - s.updatedAt >= RECAP_AFTER_MS;
