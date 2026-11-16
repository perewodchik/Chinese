import { parseResponse, toText, tryParse } from './parse';
import type { GeneratedText } from './text';

/**
 * A book file read back in (T9): the JSON a book's "Save the texts as a file"
 * writes — `{ name, texts: [...] }` — or Claude's answer in the same shape,
 * fenced or bare. A way to pass a book between learners without the
 * catalogue, and a way home when Claude answered with a file.
 */
export interface BookFile {
  name: string;
  texts: Array<Omit<GeneratedText, 'id' | 'createdAt' | 'read'>>;
}

export const IMPORTED = 'Imported file';

/** Its texts, measured against the characters known now; or what is wrong with it. */
export function bookFromFile(raw: string, known: readonly string[], fallbackName: string): BookFile | { error: string } {
  const parsed = parseResponse(raw);
  if (!parsed.drafts.length) return { error: 'There are no texts in this file. A book file is the JSON a book’s “Save the texts as a file” makes.' };
  const whole = tryParse(raw)?.value as { name?: unknown } | undefined;
  const name = typeof whole?.name === 'string' && whole.name.trim() ? whole.name.trim().slice(0, 80) : fallbackName;
  const plan = { basis: [...known], met: [], supplement: '' };
  return { name, texts: parsed.drafts.map((draft) => toText({ draft, spec: null }, plan, IMPORTED)) };
}
