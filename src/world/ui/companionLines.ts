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

/**
 * What did they say?: the English of every line of their turn — all they
 * said since your last reply, in order, another speaker's line with their
 * name before it — and on its own line after it the script's note (`why`),
 * or, at a key line with no note, where it is pinned. With neither, nothing
 * is added (prompt §11 R1: Why? is no longer a button of its own).
 */
export function translateAnswer(turn: Line | readonly Line[], why: string | undefined, nameOf: (speaker: string) => string | null = () => null): string {
  const lines = Array.isArray(turn) ? (turn as readonly Line[]) : [turn as Line];
  const first = lines[0]?.speaker;
  const en = lines
    .map((l) => {
      const who = l.speaker !== first ? nameOf(l.speaker) : null;
      return `${who ? `${who}: ` : ''}“${l.en}”`;
    })
    .join('\n');
  const key = lines.some((l) => l.key);
  const note = why ?? (key ? 'A key line — it is pinned to your tasks. Tap the hard words, or ask someone “……是什么意思？”.' : undefined);
  return note ? `${en}\n${note}` : en;
}

/** Their turn: every line said since your last reply (the chime of a speaker box included). */
export function turnOf<T extends { who: 'npc' | 'you'; line?: Line }>(history: readonly T[]): Line[] {
  const out: Line[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i]!;
    if (s.who === 'you') break;
    if (s.line) out.unshift(s.line);
  }
  return out;
}

/** Translate, word by word, for a whole turn: each word once, in the order said. */
export function glossTurn(turn: readonly Line[], lex: Lexicon): Gloss[] {
  const out: Gloss[] = [];
  for (const l of turn) for (const g of glossLine(l, lex)) if (!out.some((o) => o.w === g.w)) out.push(g);
  return out;
}

/** Help me answer: what he says as the next hint step shows above the field. */
export function hintAnswer(step: number): string {
  return step <= 1
    ? 'The word you want is above the field — tap it.'
    : step === 2
      ? 'Here is how it goes — tap the chips above the field.'
      : 'That is the whole answer, above the field. Tap it and send.';
}

/** Words worth keeping from a line: only the ones with a hanzi in them. */
export const keepable = (glosses: readonly Gloss[]): Gloss[] => glosses.filter((g) => /\p{Script=Han}/u.test(g.w));

// ------------------------------------------------------------ the options

/** where you are when you tap him */
export type CompanionPhase = 'walk' | 'heard' | 'reply';

/** No talk: walking. A talk with somebody's line to go on: heard. A talk with no line yet: reply. */
export const phaseOf = (talking: boolean, line: Line | undefined): CompanionPhase => (!talking ? 'walk' : line ? 'heard' : 'reply');

export type OptionId = 'translate' | 'hint' | 'now' | 'learned';
/** a pixel icon (`PixelIcon`) — never an emoji */
export type OptionIcon = 'ask' | 'hint' | 'now' | 'star';

export interface CompanionCtx {
  phase: CompanionPhase;
  /** reply mode with a hint step left */
  canHint: boolean;
  /** the last talk left words to look at and keep */
  learned: boolean;
}

export interface CompanionOption {
  id: OptionId;
  icon: OptionIcon;
  label: string;
  run: () => void;
}

/** Things you ask him, in English, short enough for a 375px row. */
export const OPTIONS: Record<OptionId, { icon: OptionIcon; label: string }> = {
  translate: { icon: 'ask', label: 'What did they say?' },
  hint: { icon: 'hint', label: 'Help me answer' },
  now: { icon: 'now', label: 'What now?' },
  learned: { icon: 'star', label: 'What did I learn?' },
};

/** at most this many at once: one row that never scrolls */
export const MAX_OPTIONS = 3;

/** Which options, in order, fit the moment — the ones that do not apply are left out. */
export function optionIds(ctx: CompanionCtx): OptionId[] {
  const hint: OptionId[] = ctx.canHint ? ['hint'] : [];
  const ids: OptionId[] =
    ctx.phase === 'walk'
      ? ['now', ...(ctx.learned ? (['learned'] as OptionId[]) : [])]
      : ctx.phase === 'heard'
        ? ['translate', ...hint, 'now']
        : [...hint, 'now'];
  return ids.slice(0, MAX_OPTIONS);
}

/**
 * The options for the moment, each with what it does. One with no action
 * given is left out too — nothing is ever shown disabled.
 */
export function companionOptions(ctx: CompanionCtx, actions: Partial<Record<OptionId, () => void>>): CompanionOption[] {
  return optionIds(ctx).flatMap((id) => {
    const run = actions[id];
    return run ? [{ id, ...OPTIONS[id], run }] : [];
  });
}
