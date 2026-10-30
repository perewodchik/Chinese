import type { GeneratedText } from './text';

/**
 * A text as a script for a voice service's own site (MiniMax's Text to
 * Speech): what is pasted there, read aloud with its free credits, and the
 * recording brought back.
 *
 * Every sentence is followed by the same long pause, longer than any pause
 * inside a sentence. That pause is what cuts the recording back into
 * sentences afterwards (scripts/texts/narration.ts), so each line of the text
 * gets its own reading and the page can follow along line by line.
 *
 * A sound tag goes where the sentence itself says the sound happens — 笑了,
 * 哈哈 — and nowhere else: a sigh the text does not mention is a sound the
 * learner hears without reading.
 */

/** Seconds of silence after every sentence: the mark the recording is cut at. */
export const NARRATION_PAUSE = 1.5;

const SOUNDS: Array<[RegExp, string]> = [
  [/哈哈|大笑/, '(laughs)'],
  [/笑/, '(chuckle)'],
  [/叹气/, '(sighs)'],
  [/打喷嚏|阿嚏/, '(sneezes)'],
  [/咳/, '(coughs)'],
];

/** The sound a sentence says it makes, as the service's tag, if any. */
export function soundOf(zh: string): string | null {
  for (const [re, tag] of SOUNDS) if (re.test(zh)) return tag;
  return null;
}

/** The script: one sentence a line, its sound after it, the pause after that. */
export function narratorScript(text: Pick<GeneratedText, 'lines'>, pause = NARRATION_PAUSE): string {
  return text.lines
    .map((l) => l.zh.trim())
    .filter(Boolean)
    .map((zh) => {
      const sound = soundOf(zh);
      return `${zh}${sound ? ` ${sound}` : ''} <#${pause}#>`;
    })
    .join('\n');
}
