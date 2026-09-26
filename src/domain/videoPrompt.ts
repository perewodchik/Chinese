import { summarise } from './dictation';
import { partLines, type SylMark, type Video, type VideoLine } from './video';

/**
 * What Claude is asked about a video.
 *
 * Claude cannot watch it: neither Claude Code on the home computer (its tools
 * are off) nor a chat on the iPad can play a YouTube video. What it can do is
 * read everything that is said, with the times and the notebook's line
 * numbers, and that is what the notebook work is about. So each prompt carries
 * the part's transcript and who the learner is — their band, the words they
 * know and are learning, the sounds they mix up — and asks for one JSON block
 * the app can read back, whether it arrives through the server or through the
 * clipboard.
 */

export interface Learner {
  band: number;
  known: string[];
  learning: string[];
  chars: string[];
  /** sounds the learner keeps getting wrong, in words: "zh written as j" */
  weak: string[];
}

const FENCE = '```';

/** How many known words go into a prompt: enough to show the level, not a dictionary. */
const MAX_KNOWN = 600;

function me(l: Learner): string[] {
  return [
    '## Me',
    `- Level: HSK ${l.band} (the 2026 syllabus). I study 20–30 minutes a day. My first language is Russian; explain things in simple English.`,
    `- Words I know: ${l.known.slice(0, MAX_KNOWN).join('、') || '(none marked yet)'}`,
    `- Words I'm learning: ${l.learning.join('、') || '(none)'}`,
    `- Characters I can read (${l.chars.length}): ${l.chars.join('')}`,
    `- Sounds I often get wrong: ${l.weak.join('; ') || 'nothing recorded yet'}`,
  ];
}

const time = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
};

/** The part's lines as the prompt shows them: number · time · Chinese | pinyin | English. */
export function transcript(lines: readonly VideoLine[]): string {
  return lines
    .map((l, i) => [`${i + 1} ${time(l.at)} ${l.zh}`, l.py, l.en ?? ''].join(' | ').replace(/ \| $/, ''))
    .join('\n');
}

const SOURCE: Record<Video['textFrom'], string> = {
  captions: 'made by the channel',
  'captions-auto': "YouTube's automatic captions — they may contain mistakes",
  pasted: 'pasted in by me',
  waiting: 'none yet',
  none: 'none — the video has none',
};

function about(v: Video, part: number): string[] {
  const lines = partLines(v, part);
  const p = v.parts[part];
  const minutes = v.seconds ? `${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, '0')}` : 'unknown length';
  return [
    '## The video',
    `- "${v.title}"${v.channel ? ` by ${v.channel}` : ''}, ${minutes}.`,
    v.description ? `- Description: ${v.description.replace(/\s+/g, ' ').slice(0, 500)}` : '',
    `- Captions: ${SOURCE[v.textFrom]}. The pinyin next to each line comes from the captions where they had it and otherwise from my app's dictionary, so it may be wrong where a character has two readings.`,
    `- The part I'm working on: lines 1–${lines.length}${v.parts.length > 1 && p ? ` (part ${part + 1} of ${v.parts.length})` : ''}. These are the numbers in my notebook, so keep them.`,
    '',
    'Transcript (number · start time · Chinese | pinyin | English from the captions, if any):',
    transcript(lines),
  ].filter((x) => x !== '');
}

const SCHEMA = `{
  "lines": [{ "n": 1, "py": "wǒ shì pèi qí", "en": "I'm Peppa.", "who": "Peppa", "caption_doubt": null }],
  "sandhi": [{ "n": 3, "heard": "ní hǎo", "why": "3rd + 3rd: the first is said as a 2nd" }],
  "words": [{ "w": "卧室", "py": "wòshì", "en": "bedroom", "hsk": 4, "lines": [12], "verdict": "learn_now" }],
  "new_senses": [{ "w": "玩", "en": "to play (with a friend) — not 'to have fun'", "lines": [8] }],
  "grammar": [{ "pattern": "在 + verb + 呢", "lines": [20], "explain": "…", "example": { "zh": "…", "py": "…", "en": "…" } }],
  "notes": [{ "text": "…", "lines": [5] }],
  "listening": [{ "n": 14, "why": "…" }],
  "questions": [{ "q": { "zh": "…", "py": "…", "en": "…" }, "answer": { "zh": "…", "py": "…", "en": "…" }, "lines": [3] }],
  "retell": { "zh": "…", "en": "…", "words": ["卧室"] },
  "extra": { "sentences": [{ "zh": "…", "py": "…", "en": "…" }], "talk_topic": "…" },
  "level": { "verdict": "good stretch", "why": "…" }
}`;

/** The study pack for one part: everything the video page shows beyond the transcript. */
export function packPrompt(v: Video, part: number, learner: Learner): string {
  return [
    "I'm learning Mandarin Chinese and want to study a video I've just watched. I work with a paper notebook: I write down the pinyin of each line by hand while it plays, then check it, learn the new words and talk about it. Please prepare a study pack for one part of it.",
    '',
    ...me(learner),
    '',
    ...about(v, part),
    '',
    '## Rules',
    "- Work only from the transcript. Don't add events that aren't in the video.",
    '- Always refer to lines by their numbers.',
    "- If a caption line looks mis-transcribed, say so in caption_doubt; don't change the Chinese.",
    '- Pinyin: tone marks, dictionary tones (not the changed ones), one syllable per Han character, spaces between syllables, the neutral tone unmarked.',
    '',
    '## What I need',
    '1. lines — for every line of the part: its pinyin (correct any the app got wrong); a natural English translation; who says it, if you can tell; caption_doubt if needed.',
    "2. sandhi — lines where what I'll hear differs from the written tones (3rd + 3rd, 一, 不, neutral tones, syllables merged at speed), with what I'll actually hear.",
    '3. words — the words in this part that are not in my known list: the word, pinyin, meaning here, HSK level (2026) or "off-list", line numbers, and a verdict: learn_now (useful at my level; at most 15, most useful first), later, or skip (names, sounds, one-off story words). Put known words used here in a new sense in new_senses.',
    '4. grammar — 2–5 patterns this part uses: the pattern, line numbers, one sentence of explanation, and one more example that uses only words I know.',
    "5. notes — short and useful things that aren't grammar: what particles like 啊 吧 呢 do here, set phrases, culture, how people say it in daily life, anything surprising.",
    '6. listening — the 3–5 lines hardest to write down, and why, especially given the sounds I get wrong: what to listen for.',
    '7. questions — 6 questions in simple Chinese (with pinyin and English), from easy (who / what / where) to one "why", each with a short answer and its line numbers; and one retelling task: tell it in 3–4 sentences using named learn_now words.',
    '8. extra — 3–5 everyday sentences for the same kind of situation, made from my known words plus the learn_now words; and one topic for a conversation about this video.',
    '9. level — easy, good stretch, hard or too hard for me, and one sentence why.',
    '',
    '## Answer format',
    "One JSON code block and nothing else — I paste it straight into my app, so the shape matters more than the prose:",
    `${FENCE}json`,
    SCHEMA,
    FENCE,
  ].join('\n');
}

/* -------------------------------------------------------- smaller asks */

export type AskKind = 'line' | 'mistakes' | 'answer' | 'free' | 'pinyin';

/** Everything a small ask starts with: who I am, and the part. */
function preamble(v: Video, part: number, learner: Learner): string[] {
  const pack = v.packs[part];
  return [
    "I'm learning Mandarin Chinese from a video, with a paper notebook. Answer briefly and simply, for my level. Refer to lines by their numbers.",
    '',
    ...me(learner),
    '',
    ...about(v, part),
    ...(pack?.notes.length ? ['', 'Notes you already gave me (don\'t repeat them):', ...pack.notes.map((n) => `- ${n.text}`)] : []),
    '',
  ];
}

export function explainLinePrompt(v: Video, part: number, n: number, learner: Learner): string {
  const line = partLines(v, part)[n - 1];
  return [
    ...preamble(v, part, learner),
    `## Explain line ${n}: ${line?.zh ?? ''}`,
    'Word by word (pinyin and meaning), then the grammar in one or two sentences, then how it sounds at natural speed — which syllables merge, get lighter or change tone. Plain text, no JSON.',
  ].join('\n');
}

/** What I wrote wrong in the notebook, sent for the pattern in it. */
export function mistakesPrompt(v: Video, part: number, marks: readonly SylMark[], learner: Learner): string {
  const lines = partLines(v, part);
  const s = summarise(lines, marks);
  const rows = marks
    .filter((m) => !m.extra && !m.whole)
    .map((m) => {
      const want = lines[m.line]?.py.split(' ')[m.syl] ?? '?';
      return `- line ${m.line + 1}: ${want} — I wrote ${m.wrote === undefined ? '(not typed)' : m.wrote || '(nothing)'}`;
    });
  const whole = marks.filter((m) => m.whole).map((m) => `- line ${m.line + 1}: missed the whole line`);
  return [
    ...preamble(v, part, learner),
    `## My notebook check: ${s.right} of ${s.total} syllables right`,
    ...rows,
    ...whole,
    '',
    'What is the pattern in my mistakes, and why do I probably make them (think about how an English and Russian speaker hears Mandarin)? Then give me 3–4 minimal pairs from the words in this video to listen for, like zhī / jī, with pinyin and meaning. Plain text, no JSON, short.',
  ].join('\n');
}

export function answerPrompt(v: Video, part: number, question: string, mine: string, learner: Learner): string {
  return [
    ...preamble(v, part, learner),
    `## A question about the video: ${question}`,
    `My answer: ${mine}`,
    'Is it right, nearly right or wrong? Say so in the first word, then give the corrected Chinese (with pinyin) if it needs correcting, and one sentence on why. Plain text, no JSON.',
  ].join('\n');
}

export function freePrompt(v: Video, part: number, question: string, learner: Learner): string {
  return [...preamble(v, part, learner), `## My question`, question, '', 'Plain text, no JSON.'].join('\n');
}

export function pinyinPrompt(v: Video, part: number, n: number, learner: Learner): string {
  const line = partLines(v, part)[n - 1];
  return [
    ...preamble(v, part, learner),
    `## The pinyin of line ${n} looks wrong to me: ${line?.zh ?? ''} | ${line?.py ?? ''}`,
    'Give the correct pinyin with tone marks, dictionary tones, one syllable per Han character separated by spaces, on the first line and nothing else on it. Then one sentence on what was wrong.',
  ].join('\n');
}
