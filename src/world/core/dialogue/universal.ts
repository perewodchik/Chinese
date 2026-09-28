/**
 * The things you can say in any conversation (prompt §4.4), without the
 * script listing them: ask again, ask slower, ask what a word means, say you
 * do not understand, and the polite words.
 *
 * Asking (repeat, slower, explain, simpler) is checked before the scene's
 * own intents — 再说一遍 never answers a question. The polite words are
 * checked after them: 你好，请问地铁站在哪儿？ is a question about the
 * subway that happens to start with 你好.
 */

import type { Expect } from '../types';
import type { Lexicon } from './lexicon';
import { matchIntent } from './match';
import { hanziOnly, type Normalized } from './normalize';

export type AskIntent = 'repeat' | 'slower' | 'simpler';
export type PoliteIntent = 'hello' | 'thanks' | 'bye' | 'sorry';

const ASK: Expect[] = [
  { intent: 'repeat', match: [['再说一遍', '再说一次', '再说一下', '重复一下', '再来一遍']] },
  { intent: 'slower', match: [['慢一点', '慢一点儿', '慢点', '慢点儿', '慢慢说', '说慢点']] },
  { intent: 'simpler', match: [['听不懂', '不懂', '不明白', '听不明白', '没听懂']] },
];

const POLITE: Expect[] = [
  { intent: 'hello', match: [['你好', '您好', '你们好', '早上好', '晚上好']] },
  { intent: 'thanks', match: [['谢谢', '多谢', '谢谢你', '谢谢您']] },
  { intent: 'bye', match: [['再见', '拜拜', '明天见']] },
  { intent: 'sorry', match: [['对不起', '不好意思']] },
];

export function askIntent(input: Normalized, lex: Lexicon): AskIntent | null {
  return (matchIntent(ASK, input, lex)?.expect.intent as AskIntent | undefined) ?? null;
}

export function politeIntent(input: Normalized, lex: Lexicon): PoliteIntent | null {
  return (matchIntent(POLITE, input, lex)?.expect.intent as PoliteIntent | undefined) ?? null;
}

/** The polite reply an NPC gives, and whether it ends the talk. */
export const POLITE_REPLY: Record<PoliteIntent, { zh: string; en: string; end?: boolean }> = {
  hello: { zh: '你好！', en: 'Hello!' },
  thanks: { zh: '不客气！', en: "You're welcome!" },
  bye: { zh: '再见！', en: 'Goodbye!', end: true },
  sorry: { zh: '没关系！', en: "It's all right!" },
};

const ASK_HANZI = /^(?:请问)?(.+?)(?:是)?(?:什么|啥)意思(?:呢|啊|呀)?$/;
const ASK_HANZI_FRONT = /^(?:请问)?什么是(.+?)(?:呢|啊|呀)?$/;
const MEANING = ['shen', 'me', 'yi', 'si'];

/**
 * "X是什么意思？" → X. For typed pinyin (`fujin shi shenme yisi`) the word is
 * found among `known` — the words this NPC and this scene can explain — by
 * its sound.
 */
export function explainWord(input: Normalized, lex: Lexicon, known: readonly string[]): string | null {
  if (input.kind === 'hanzi') {
    const zh = input.hanzi;
    const m = ASK_HANZI.exec(zh) ?? ASK_HANZI_FRONT.exec(zh);
    // Strip quote marks left in the middle: “附近”是什么意思
    const w = m?.[1] ? hanziOnly(m[1]) : '';
    return w || null;
  }
  if (input.kind !== 'pinyin') return null;
  const s = input.syllables;
  const at = s.length - MEANING.length;
  if (at < 1 || MEANING.some((x, i) => s[at + i] !== x)) return null;
  let word = s.slice(0, at);
  if (word.at(-1) === 'shi' && word.length > 1) word = word.slice(0, -1);
  if (word[0] === 'qing' && word[1] === 'wen' && word.length > 2) word = word.slice(2);
  for (const k of known) {
    const syl = lex.syllables(k);
    if (syl.length === word.length && syl.every((x, i) => x === word[i])) return k;
  }
  // Unknown word typed as pinyin: hand the pinyin back, the companion takes it from there.
  return word.join('');
}
