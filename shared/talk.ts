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
 * Everything the learner asks for — how long a turn is, whether the grammar
 * is explained, the new words, what they might say next — is asked for in
 * that one turn and answered in it. Nothing here costs a second request.
 *
 * Types, constants and pure functions only: nothing here may import from the
 * app or the server.
 */

import { personaOf } from './personas';

export type TalkLevel = 'hsk1' | 'hsk2' | 'hsk3';
export const TALK_LEVELS: readonly TalkLevel[] = ['hsk1', 'hsk2', 'hsk3'];

export type TalkLength = 'short' | 'normal' | 'long';
export const TALK_LENGTHS: readonly TalkLength[] = ['short', 'normal', 'long'];

/**
 * How the voice reads a turn: four ways of being talked to. Shown as Guided,
 * Normal, Native and Skim — what the learner is choosing is how much help
 * they want, not which recording a clip came from.
 *
 * Most of the difference is in the *reading*. Breakdown asks for the sentence
 * a character at a time, with the pauses written into the text itself, so the
 * model articulates each one rather than running them together — a slowness
 * it performs, which a dragged recording is not.
 *
 * The rest of the difference is the speed the clip is played at, which was
 * once reserved for skimming on the grounds that dragging a reading is a poor
 * imitation of a slower one. It is, and it is also the only lever that works
 * every time: a model asked to read slowly obliges when it feels like it, and
 * a beginner who cannot follow a turn needs the next one slower, not an
 * explanation of why it is not. So the reading does the work it can and the
 * playback speed is the floor under it. `src/features/pinyin/talkOut.ts` has
 * the numbers and why they stop where they do.
 */
export type TalkMode = 'breakdown' | 'teaching' | 'conversation' | 'skim';
export const TALK_MODES: readonly TalkMode[] = ['breakdown', 'teaching', 'conversation', 'skim'];
export const DEFAULT_MODE: TalkMode = 'conversation';

/** One turn so far, as text. The learner's are what speech recognition wrote down. */
export interface TalkLine {
  who: 'tutor' | 'learner';
  text: string;
}

/** How the learner wants to be talked to. */
export interface TalkOptions {
  level: TalkLevel;
  length: TalkLength;
  /** a line of English about one thing in Claude's turn: a word, a pattern, the word order */
  explain: boolean;
  /** the words in Claude's turn that are probably new at this level */
  words: boolean;
  /** two or three things the learner could say back, when they are stuck */
  hints: boolean;
  /** what to talk about, in the learner's own words; empty leaves the choice to Claude */
  topic: string;
  /**
   * Who is talking, by voice id (shared/personas.ts): the partner's manner
   * goes into the instructions along with their voice. Absent for the
   * system voice, and in conversations from before there were partners.
   */
  persona?: string;
}

export const DEFAULT_OPTIONS: TalkOptions = {
  level: 'hsk1',
  length: 'normal',
  explain: false,
  words: true,
  hints: true,
  topic: '',
};

export const TALK_TOPIC_MAX_CHARS = 60;

/**
 * The learner's words, sent with every turn rather than kept with the
 * conversation: they are learning more of them every day, and the partner
 * should talk to who they are now.
 */
export interface TalkVocab {
  /** words they know as words */
  known: string[];
  /** words they are learning — worth hearing in use */
  learning: string[];
}

/** Enough to cover HSK 1–3 with room to spare, and still a small prompt. */
export const TALK_VOCAB_MAX = { known: 1000, learning: 15 } as const;

export interface TalkRequest {
  /** the conversation so far, oldest first; empty to have Claude open it */
  lines: TalkLine[];
  options: TalkOptions;
  vocab?: TalkVocab;
}

/** A word or a whole suggested sentence: the characters, how to say it, what it means. */
export interface TalkWord {
  hanzi: string;
  pinyin: string;
  english: string;
}

/** Claude's turn. Everything after the first three is there only if it was asked for. */
export interface TalkReply {
  hanzi: string;
  /** one syllable per Han character, tone marks, spaces between */
  pinyin: string;
  english: string;
  /** words in this turn that are probably new */
  words?: TalkWord[];
  /** things the learner could say back */
  hints?: TalkWord[];
  /** one line of English about the Chinese in this turn */
  note?: string;
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

const LENGTH_RULE: Record<TalkLength, string> = {
  short: 'One short sentence a turn — usually a question. Nothing more.',
  normal: 'One or two sentences a turn. Usually end with a simple question that keeps the conversation going.',
  long: 'Three or four short sentences a turn: say a little of your own, then ask them something.',
};

/** Who Claude is in the conversation, and how it answers. Shared by both routes to Claude. */
export function tutorInstructions(o: TalkOptions, vocab?: TalkVocab): string {
  const persona = personaOf(o.persona);
  const lines = [
    'You are a calm, friendly Mandarin conversation partner for someone learning Chinese, who is practising speaking out loud.',
    'Everything you write in Chinese is read aloud to them by a text-to-speech voice, and they answer by speaking.',
    ...(persona
      ? [
          `You are ${persona.character}`,
          `Your name in Chinese is ${persona.zh}; use it if you introduce yourself.`,
        ]
      : []),
    'Keep the tone relaxed and reassuring: speaking a new language out loud is hard, and they should feel there is no hurry. Avoid exclamation marks and over-the-top praise.',
    '',
    'How to talk:',
    `- Simplified Chinese only, at the learner's level: ${LEVEL_WORDS[o.level]}. Short, natural sentences.`,
    // The words themselves, where the app knows them: a level is a guess at
    // what someone knows, the list is what they do. A word of familiar
    // characters is still a word they may not know — 东西 is not 东 and 西.
    ...(vocab?.known.length
      ? [
          `- The words the learner knows: ${vocab.known.slice(0, TALK_VOCAB_MAX.known).join('、')}. Build your turns out of these wherever you can, and keep anything else to a word or two a turn. A word made of characters they know is not one they know unless it is on this list.`,
        ]
      : []),
    ...(vocab?.learning.length
      ? [
          `- Words they are learning: ${vocab.learning.slice(0, TALK_VOCAB_MAX.learning).join('、')}. Use one or two of these in each turn where they fit naturally, so they hear them in use. Do not force them in or point them out.`,
        ]
      : []),
    `- ${LENGTH_RULE[o.length]}`,
    o.topic
      ? `- Talk about this, and stay on it unless they change the subject: ${o.topic}`
      : '- Opening the conversation: greet them and ask about one everyday topic (food, the weekend, family, the weather, hobbies, work or study).',
    "- The learner's lines come from speech recognition, so they can contain wrong characters that sound like the right ones (是/十, 买/卖, 他/她). Work out what they most likely meant and answer that; do not point out the recognition mistakes.",
    '- If you cannot tell what they meant, ask them simply, in Chinese, to say it again.',
    '- No emoji, no markdown, no pinyin or English inside the Chinese.',
  ];
  return lines.join('\n');
}

const PINYIN_RULE =
  'pinyin with tone marks, one syllable per Chinese character separated by spaces, no punctuation (你好吗？ → nǐ hǎo ma)';

const WORDS_RULE =
  'the words in your turn that are probably new at this level — at most three, and none at all when nothing is new';
const HINTS_RULE =
  'two or three short, different things the learner could say back, each one they could manage at their level';
const NOTE_RULE =
  'one line of English about one thing in your turn worth knowing: a word, a pattern, or the word order. Not a lesson.';

const WORD_SCHEMA = {
  type: 'object',
  properties: {
    hanzi: { type: 'string' },
    pinyin: { type: 'string', description: PINYIN_RULE },
    english: { type: 'string' },
  },
  required: ['hanzi', 'pinyin', 'english'],
  additionalProperties: false,
} as const;

/**
 * Claude's answer as structured output, asking for exactly what the learner
 * has switched on — an unasked-for field is one more thing to write, and
 * every one of them is time before the voice starts.
 */
export function replySchema(o: TalkOptions) {
  const properties: Record<string, unknown> = {
    hanzi: { type: 'string', description: 'your turn, in Chinese characters' },
    pinyin: { type: 'string', description: `your turn in ${PINYIN_RULE}` },
    english: { type: 'string', description: 'a natural English translation of your turn' },
  };
  const required = ['hanzi', 'pinyin', 'english'];
  if (o.words) {
    properties.words = { type: 'array', items: WORD_SCHEMA, description: WORDS_RULE };
    required.push('words');
  }
  if (o.hints) {
    properties.hints = {
      type: 'array',
      items: WORD_SCHEMA,
      description: `${HINTS_RULE}. Whole sentences, as they would say them.`,
    };
    required.push('hints');
  }
  if (o.explain) {
    properties.note = { type: 'string', description: NOTE_RULE };
    required.push('note');
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

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

/**
 * The same answer as labelled lines, for the copy-and-paste route, where
 * there is no schema to lean on. Labels rather than a fixed number of lines,
 * because what is asked for varies — and a chat that answers in the wrong
 * order is still read correctly.
 */
function answerFormat(o: TalkOptions): string {
  const rules = [
    'Chinese: your turn, in Chinese characters',
    `Pinyin: ${PINYIN_RULE}`,
    'English: a translation of your turn',
  ];
  if (o.words) rules.push(`Words: ${WORDS_RULE} — as 词 cí — meaning, separated by semicolons. Leave the line out if none.`);
  if (o.hints) rules.push(`Say: ${HINTS_RULE} — as 句子。jù zi — meaning, separated by semicolons.`);
  if (o.explain) rules.push(`Note: ${NOTE_RULE}`);
  return ['Answer every turn as these labelled lines, and nothing else:', ...rules].join('\n');
}

/**
 * What to paste into the Claude chat the first time: the instructions, and
 * whatever has been said already. After that only each new line goes over,
 * since the chat remembers the rest.
 */
export function relayOpening(o: TalkOptions, lines: readonly TalkLine[], vocab?: TalkVocab): string {
  return [
    tutorInstructions(o, vocab),
    '',
    answerFormat(o),
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
const LABELLED = /^(chinese|hanzi|characters|pinyin|english|translation|words?|say|suggestions?|note)\s*[:：]\s*(.*)$/i;
const BULLET = /^[\s>*•-]+/;
/** "Line 1:", "1." — what a chat numbers its answer with when it is not labelling it */
const NUMBER = /^(?:line\s*\d|\d[.)])\s*[:：—–-]?\s*/i;

/** One line as the chat wrote it, with its decoration taken off: bold, a bullet, a number. */
const clean = (s: string) => s.replace(/\*\*/g, '').replace(BULLET, '').replace(NUMBER, '').trim();

/**
 * "咖啡 kā fēi — coffee" → its three parts. The Chinese runs until the first
 * Latin letter, which the pinyin starts; a dash divides that from the
 * English. Whole suggested sentences parse the same way as single words.
 */
function parseWord(entry: string): TalkWord | null {
  const text = clean(entry);
  if (!HAN.test(text)) return null;
  const at = text.search(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/i);
  const hanzi = (at < 0 ? text : text.slice(0, at)).trim();
  const rest = at < 0 ? '' : text.slice(at);
  const [pinyin = '', ...english] = rest.split(/\s*[—–|]\s*|\s+-\s+|\s*[:：]\s*/);
  return { hanzi, pinyin: pinyin.trim(), english: english.join(' — ').trim() };
}

const parseWords = (value: string): TalkWord[] =>
  value
    .split(/[;；]|\n/)
    .map(parseWord)
    .filter((w): w is TalkWord => w !== null && w.hanzi.length > 0);

const word = (v: unknown): TalkWord | null => {
  const o = v as Partial<TalkWord> | null;
  if (!o || typeof o.hanzi !== 'string' || !HAN.test(o.hanzi)) return null;
  return { hanzi: o.hanzi.trim(), pinyin: String(o.pinyin ?? '').trim(), english: String(o.english ?? '').trim() };
};

const wordList = (v: unknown): TalkWord[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const list = v.map(word).filter((w): w is TalkWord => w !== null);
  return list.length ? list : undefined;
};

function fromJson(text: string): TalkReply | null {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof v.hanzi !== 'string' || !HAN.test(v.hanzi)) return null;
  const note = typeof v.note === 'string' && v.note.trim() ? v.note.trim() : undefined;
  return {
    hanzi: v.hanzi.trim(),
    pinyin: String(v.pinyin ?? '').trim(),
    english: String(v.english ?? '').trim(),
    ...(wordList(v.words) && { words: wordList(v.words) }),
    ...(wordList(v.hints) && { hints: wordList(v.hints) }),
    ...(note && { note }),
  };
}

/**
 * Claude's answer as pasted back, however it came: the JSON the headless
 * route asks for, the labelled lines the chat was asked for, or — when a chat
 * has ignored the format altogether — the Chinese, the pinyin and the English
 * picked out by what they look like. Null when there is no Chinese in it.
 */
export function parseReply(raw: string): TalkReply | null {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const asJson = text.startsWith('{') ? fromJson(text) : null;
  if (asJson) return asJson;

  const labelled: Record<string, string> = {};
  const plain: string[] = [];
  let last: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = clean(raw);
    const match = LABELLED.exec(line);
    if (match) {
      const key = match[1]!.toLowerCase();
      last = key.startsWith('word') ? 'words' : key === 'say' || key.startsWith('suggestion') ? 'hints' : key;
      labelled[last] = match[2]!.trim();
    } else if (last && BULLET.test(raw) && line) {
      // A list written under its label rather than beside it.
      labelled[last] += `\n${line}`;
    } else if (line) {
      plain.push(line);
      last = null;
    }
  }

  const hanzi = labelled.chinese ?? labelled.hanzi ?? labelled.characters ?? plain.find((l) => HAN.test(l));
  if (!hanzi || !HAN.test(hanzi)) return null;
  const rest = plain.filter((l) => !HAN.test(l));
  const pinyin = labelled.pinyin ?? rest.find((l) => TONE_MARK.test(l)) ?? '';
  const english = labelled.english ?? labelled.translation ?? rest.find((l) => l !== pinyin) ?? '';
  const words = labelled.words ? parseWords(labelled.words) : [];
  const hints = labelled.hints ? parseWords(labelled.hints) : [];
  return {
    hanzi: hanzi.trim(),
    pinyin: pinyin.trim(),
    english: english.trim(),
    ...(words.length && { words }),
    ...(hints.length && { hints }),
    ...(labelled.note && { note: labelled.note }),
  };
}

/* ------------------------------------------------ conversations that are kept */

/**
 * A conversation, saved so it can be come back to.
 *
 * The options are kept with the turns, not only the turns, and that is the
 * point of the record rather than a detail of it: what Claude was told at the
 * start — the level, how long a turn is, what to talk about, whether the
 * grammar is explained — is what makes the twentieth turn continuous with the
 * first. A conversation resumed under somebody else's settings is a different
 * conversation wearing the same history.
 */
export interface TalkConversation {
  id: string;
  /** the topic, or Claude's opening line cut short — what the list shows */
  title: string;
  options: TalkOptions;
  /** the voice it was held in, so it sounds the same when it is picked up again */
  voice: string | null;
  turns: TalkSavedTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface TalkSavedTurn extends TalkReply {
  who: 'tutor' | 'learner';
}

/** One line of the list of conversations: enough to choose between them. */
export interface TalkConversationSummary {
  id: string;
  title: string;
  level: TalkLevel;
  turns: number;
  updatedAt: number;
}

/** Long enough for any topic; a title is cut to it rather than refused. */
export const TALK_TITLE_MAX_CHARS = 80;

/** Beyond this a conversation is long past the point of being resumed. */
export const TALK_SAVED_TURNS_MAX = 400;

/**
 * What to call a conversation in the list: what the learner chose to talk
 * about, or failing that the opening line, which is always a question about
 * something. A conversation with neither is still young enough to be "New
 * conversation" without anyone minding.
 */
export function conversationTitle(options: TalkOptions, turns: TalkSavedTurn[]): string {
  const opening = turns.find((t) => t.who === 'tutor');
  const raw = options.topic.trim() || opening?.hanzi.trim() || '';
  if (!raw) return 'New conversation';
  const cut = [...raw].slice(0, TALK_TITLE_MAX_CHARS);
  return cut.length < [...raw].length ? `${cut.join('')}…` : cut.join('');
}
