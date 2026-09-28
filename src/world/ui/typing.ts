/**
 * The pure parts of the input bar (E3): where the pinyin being typed is in
 * the field, what picking a candidate leaves, which chips a hint step gives,
 * and which input mode a device starts in.
 */

import { candidates, rest, type Candidate, type ImeIndex } from '../core/ime';
import type { Hint, InputMode } from '../core/types';

/** The field as hanzi already chosen (`head`) and the pinyin still being typed at its end (`tail`). */
export function splitField(value: string): { head: string; tail: string } {
  const m = /[a-zA-ZüÜ][a-zA-ZüÜ0-9' ]*$/.exec(value);
  if (!m) return { head: value, tail: '' };
  // Spaces inside the pinyin belong to it (`ni hao`); a space before it does not.
  return { head: value.slice(0, m.index), tail: m[0].trimEnd() };
}

/** Candidates for the pinyin at the end of the field (none when there is none). */
export function fieldCandidates(value: string, ime: ImeIndex | null, limit = 12): Candidate[] {
  const { tail } = splitField(value);
  if (!ime || !tail) return [];
  return candidates(tail, ime, limit);
}

/** The field after picking `c`: its hanzi in place of the syllables it used, the rest still pinyin. */
export function pickCandidate(value: string, c: Candidate): string {
  const { head, tail } = splitField(value);
  return head + c.text + rest(tail, c.uses);
}

export interface Chip {
  text: string;
  /** the key word of the hint, shown stronger */
  key?: boolean;
}

/**
 * The chips for a hint step (concept §9, "What do I say?"): 1 the key word,
 * 2 the frame with the word in its gap, cut into chips, 3 the whole sentence.
 */
export function hintChips(hint: Hint | undefined, step: number): Chip[] {
  if (!hint || step < 1) return [];
  if (step === 1) return [{ text: hint.word, key: true }];
  if (step === 2) {
    const [before = '', after = ''] = hint.frame.split(/_{2,}/);
    return [
      ...(before ? [{ text: before }] : []),
      { text: hint.word, key: true },
      ...(after ? [{ text: after }] : []),
    ];
  }
  return [{ text: hint.full, key: true }];
}

/**
 * The mode to open in: this device's own choice first, else the save's,
 * never voice where the browser cannot listen.
 */
export function startMode(device: string | null, saved: InputMode, canListen: boolean): InputMode {
  const want: InputMode = device === 'voice' || device === 'keyboard' ? device : saved;
  return want === 'voice' && !canListen ? 'keyboard' : want;
}
