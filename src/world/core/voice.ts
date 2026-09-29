/**
 * Who says a line in which voice (prompt G2, concept §12): each person's card
 * names one of the designed voices of the app's voice pack; 兔儿爷 and the
 * spirits have their own. The player's own thoughts and signs are silent.
 * Every line a script can say is rendered ahead of time to
 * `public/world/voice/<key>.mp3`, the key made from the voice and the text.
 */

import type { NpcCard } from './types';

/** the voice pack's designed voices (scripts/voices/voices.json) */
export const VOICES = ['wang', 'xiaoyu', 'chen', 'zhiyuan', 'wei'] as const;
export type VoiceId = (typeof VOICES)[number];

/** Where a line says the player's name (X2): `{name}，你来了！` */
export const NAME_SLOT = '{name}';
const SLOT = /\{name\}[，,、]?\s*/g;

/** The line as the voice renders it — the name left out, since a clip cannot know it. */
export function spoken(text: string): string {
  return text.includes(NAME_SLOT) ? text.replace(LEAD, '').replace(SLOT, '') : text;
}
/** 「谢谢你，{name}。」 without a name is 「谢谢你。」 */
const LEAD = /[，,、]\s*\{name\}/g;

/** The line as shown: the player's name in its slot, or the slot dropped while it is unknown. */
export function withName(text: string, name: string): string {
  if (!text.includes(NAME_SLOT)) return text;
  return name ? text.split(NAME_SLOT).join(name) : text.replace(LEAD, '').replace(SLOT, '');
}

/** A hint that says the player's name (「我叫{name}。」) says theirs, or a stand-in before it is known. */
export function hintWithName<H extends { word: string; frame: string; full: string }>(hint: H, name: string): H {
  const n = name || '大卫';
  return { ...hint, word: withName(hint.word, n), frame: withName(hint.frame, n), full: withName(hint.full, n) };
}

const isVoice = (v: string | undefined): v is VoiceId => !!v && (VOICES as readonly string[]).includes(v);

/** 兔儿爷 and the spirits, who have no cards */
const OTHERS: Record<string, VoiceId> = {
  companion: 'zhiyuan',
  announcer: 'xiaoyu',
  shishizi: 'wei',
  jiuweihu: 'xiaoyu',
  menshen: 'chen',
  qilin: 'wei',
  pixiu: 'zhiyuan',
  nianshou: 'chen',
  long: 'wei',
  'echo-boy': 'xiaoyu',
};

/** The voice a speaker is heard in, or null for the silent ones (the hero, signs, anyone without a voice). */
export function voiceOf(speaker: string, cards: ReadonlyMap<string, NpcCard> | readonly NpcCard[]): VoiceId | null {
  if (speaker === 'hero' || speaker === 'sign') return null;
  if (OTHERS[speaker]) return OTHERS[speaker];
  const card = cards instanceof Map ? cards.get(speaker) : (cards as readonly NpcCard[]).find((c) => c.id === speaker);
  return isVoice(card?.voice) ? card.voice : null;
}

/** The file name of a line in a voice: 16 hex digits of FNV-1a over both, the same in the build and the page. */
export function voiceKey(voice: string, text: string): string {
  const s = `${voice}|${text}`;
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    b ^= b >>> 13;
  }
  return a.toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
