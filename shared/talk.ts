/**
 * Talking with Claude out loud: what the page and the server exchange, and
 * what Claude is told.
 *
 * Claude is reached through the learner's own subscription, never through a
 * paid API key, in one of two ways. On the home computer the server runs
 * Claude Code headless (`claude -p`), which is signed in to the subscription.
 * Anywhere else — the Vercel site — the learner carries the prompt to their
 * own Claude chat and pastes the answer back. The instructions below serve
 * both, so the conversation is the same whichever way it travels.
 *
 * Types, constants and pure functions only: nothing here may import from the
 * app or the server.
 */

export type TalkLevel = 'hsk1' | 'hsk2' | 'hsk3';
export const TALK_LEVELS: readonly TalkLevel[] = ['hsk1', 'hsk2', 'hsk3'];

/** One turn so far, as text. The learner's are what speech recognition wrote down. */
export interface TalkLine {
  who: 'tutor' | 'learner';
  text: string;
}

export interface TalkRequest {
  /** the conversation so far, oldest first; empty to have Claude open it */
  lines: TalkLine[];
  level: TalkLevel;
}

/** Claude's turn. */
export interface TalkReply {
  hanzi: string;
  /** one syllable per Han character, tone marks, spaces between */
  pinyin: string;
  english: string;
}

/**
 * Whether the server can reach Claude by itself.
 *
 * - `ready`: Claude Code is here and signed in to a subscription
 * - `signed-out`: Claude Code is here but has never been signed in
 * - `api-key`: signed in with an API key, which is billed per word — refused,
 *   because the whole point is to use the subscription already paid for
 * - `missing`: no Claude Code on this server (Vercel, or not installed)
 */
export type ClaudeState = 'ready' | 'signed-out' | 'api-key' | 'missing';

export interface TalkVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
}

export interface TalkStatusResponse {
  claude: { state: ClaudeState };
  /** voices the server can read any sentence with; none where it has no local model */
  voices: TalkVoice[];
}

/** A conversation longer than this is cut to its last lines: enough context, and a prompt that stays small. */
export const TALK_MAX_LINES = 40;
export const TALK_LINE_MAX_CHARS = 300;

const LEVEL_WORDS: Record<TalkLevel, string> = {
  hsk1: 'HSK 1 — about 300 of the commonest words: greetings, numbers, family, food, time, 是/有/在/想/喜欢',
  hsk2: 'HSK 2 — about 500 common words; simple past with 了 and 过, comparisons with 比, 因为…所以…',
  hsk3: 'HSK 3 — about 1000 words; everyday opinions and plans, 虽然…但是…, 把 sentences',
};

/** Who Claude is in the conversation, and how it answers. Shared by both routes to Claude. */
export function tutorInstructions(level: TalkLevel): string {
  return [
    'You are a friendly Mandarin conversation partner for someone learning Chinese, who is practising speaking out loud.',
    'Everything you write in Chinese is read aloud to them by a text-to-speech voice, and they answer by speaking.',
    '',
    'How to talk:',
    `- Simplified Chinese only, at the learner's level: ${LEVEL_WORDS[level]}. Short, natural sentences.`,
    '- One or two sentences a turn. Usually end with a simple question that keeps the conversation going.',
    '- Opening the conversation: greet them and ask about one everyday topic (food, the weekend, family, the weather, hobbies, work or study).',
    "- The learner's lines come from speech recognition, so they can contain wrong characters that sound like the right ones (是/十, 买/卖, 他/她). Work out what they most likely meant and answer that; do not point out the recognition mistakes.",
    '- If you cannot tell what they meant, ask them simply, in Chinese, to say it again.',
    '- No emoji, no markdown, no pinyin or English inside the Chinese.',
  ].join('\n');
}

const PINYIN_RULE =
  'its pinyin with tone marks, one syllable per Chinese character separated by spaces, no punctuation (你好吗？ → nǐ hǎo ma)';

/** Claude's answer as structured output, for the headless route. */
export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    hanzi: { type: 'string', description: 'your turn, in Chinese characters' },
    pinyin: { type: 'string', description: PINYIN_RULE.replace(/^its/, 'the same text in') },
    english: { type: 'string', description: 'a natural English translation' },
  },
  required: ['hanzi', 'pinyin', 'english'],
  additionalProperties: false,
} as const;

const who = (l: TalkLine) => (l.who === 'tutor' ? 'You' : 'Learner');

/** The message for one headless turn: the whole conversation so far, since each call starts fresh. */
export function turnPrompt(lines: readonly TalkLine[]): string {
  if (!lines.length) return 'Open the conversation.';
  return [
    'The conversation so far (Learner = what speech recognition heard them say):',
    '',
    ...lines.map((l) => `${who(l)}: ${l.text}`),
    '',
    'Write your next turn.',
  ].join('\n');
}

/** Three plain lines, for the copy-and-paste route, where there is no schema to lean on. */
const THREE_LINES = [
  'Answer every turn in exactly three lines and nothing else:',
  'line 1 — your turn in Chinese characters',
  `line 2 — ${PINYIN_RULE}`,
  'line 3 — an English translation',
].join('\n');

/**
 * What to paste into the Claude chat the first time: the instructions, and
 * whatever has been said already. After that only each new line goes over,
 * since the chat remembers the rest.
 */
export function relayOpening(level: TalkLevel, lines: readonly TalkLine[]): string {
  return [
    tutorInstructions(level),
    '',
    THREE_LINES,
    '',
    lines.length ? turnPrompt(lines) : 'Open the conversation now.',
  ].join('\n');
}

/** What the learner has said since Claude last spoke, for a Claude chat that already has the instructions. */
export function relayTurn(lines: readonly TalkLine[]): string {
  return lines.map((l) => `${who(l)}: ${l.text}`).join('\n');
}

const HAN = /[㐀-鿿]/;
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
/** "Line 1:", "1.", "Chinese:", "**Pinyin**:" and the like, which chats add unasked */
const LABEL = /^(?:\*\*)?(?:line\s*\d|\d[.)]|chinese|hanzi|characters|pinyin|english|translation)(?:\*\*)?\s*[:：—–-]?\s*(?:\*\*)?\s*/i;

/**
 * Claude's answer as pasted back, however it came: the JSON the headless
 * route asks for, or the three lines the chat was asked for, with whatever
 * labels, bullets or code fences the chat added anyway. Null when there is no
 * Chinese in it at all.
 */
export function parseReply(raw: string): TalkReply | null {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  if (text.startsWith('{')) {
    try {
      const v = JSON.parse(text) as Partial<TalkReply>;
      if (typeof v.hanzi === 'string' && HAN.test(v.hanzi)) {
        return { hanzi: v.hanzi.trim(), pinyin: String(v.pinyin ?? '').trim(), english: String(v.english ?? '').trim() };
      }
    } catch {
      // Not JSON after all; read it as lines.
    }
  }
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>*-]+/, '').replace(LABEL, '').trim())
    .filter(Boolean);
  const hanzi = lines.find((l) => HAN.test(l));
  if (!hanzi) return null;
  const rest = lines.filter((l) => !HAN.test(l));
  const pinyin = rest.find((l) => TONE_MARK.test(l)) ?? '';
  const english = rest.find((l) => l !== pinyin) ?? '';
  return { hanzi, pinyin, english };
}
