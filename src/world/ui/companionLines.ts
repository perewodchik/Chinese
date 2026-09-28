/**
 * What 兔儿爷 says (concept §9), in English, as plain functions of the
 * conversation and the save — the component only shows it.
 */

import type { Lexicon } from '../core/dialogue/lexicon';
import type { CompanionCue, Line } from '../core/dialogue/source';

/** after this long standing about during a quest, he says what now — once */
export const IDLE_MS = 60_000;

/** The one short line he says unasked when a turn brings a cue. */
export function cueLine(cue: CompanionCue): string {
  switch (cue.kind) {
    case 'hint':
      return cue.step === 1
        ? `Psst — the word you want is ${cue.text}.`
        : cue.step === 2
          ? `Try it like this: ${cue.text}`
          : `Say this, it works: ${cue.text}`;
    case 'not_chinese':
      return `They only speak Chinese. You could say: ${cue.text}`;
    case 'explain':
      return cue.en ? `${cue.word}${cue.py ? ` (${cue.py})` : ''} means “${cue.en}”. Ask someone else, or keep it.` : `Nobody here knows ${cue.word}. Tap it for the word card.`;
    case 'heard':
      return cue.text;
  }
}

/** He speaks up by himself only after two misunderstood lines in a row (§9). */
export const speaksUpAfterMisses = (misses: number, cue: CompanionCue | undefined) => misses >= 2 || cue?.kind === 'heard' || cue?.kind === 'not_chinese';

export interface Gloss {
  w: string;
  py: string;
  en: string;
}

/** Translate, word by word: each word of the line with its reading and a short meaning. */
export function glossLine(line: Line, lex: Lexicon): Gloss[] {
  const out: Gloss[] = [];
  const seen = new Set<string>();
  for (const w of lex.words(line.zh)) {
    if (seen.has(w)) continue;
    seen.add(w);
    const g = lex.gloss(w);
    out.push({ w, py: g?.py ?? '', en: g?.en ?? '' });
  }
  return out;
}

/** Why?: the script's own note, or a calm word that there is nothing special. */
export function whyText(why: string | undefined, line: Line | undefined): string {
  if (why) return why;
  if (!line) return 'Ask me when somebody says something.';
  if (line.key) return 'This is a key line — it is pinned in 📜. Tap the hard words, or ask someone “……是什么意思？”.';
  return 'Nothing tricky here — plain everyday Chinese.';
}
