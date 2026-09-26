import type { CaptionCue } from '../../shared/videos';

/**
 * Asking Gemini for a video's Chinese, when YouTube has none to give.
 *
 * Many learner channels burn their Chinese into the picture and caption only
 * in English. Claude cannot help there — it can neither hear a video nor
 * watch one — but Gemini takes a YouTube link and listens to it. What comes
 * back has to be read by the app and checked against a notebook, so the
 * prompt asks for exactly one thing, an SRT file of what is said and nothing
 * else: no pinyin, no translation, no notes.
 *
 * When the video has English captions, their times go in the prompt, and
 * Gemini is asked for one Chinese line per caption at the same times. The
 * channel has already cut the speech into sentences; lining up with that
 * cut makes the lines play right, one at a time.
 */

export interface TranscribeTarget {
  url: string;
  title: string;
  seconds?: number;
  /** the video's English captions, when it has them: the times to follow */
  english?: CaptionCue[] | null;
}

const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms % 1000, 3)}`;
};

const FENCE = '```';

export function geminiPrompt(t: TranscribeTarget): string {
  const length = t.seconds ? ` (${Math.floor(t.seconds / 60)}:${String(t.seconds % 60).padStart(2, '0')} long)` : '';
  const timed = t.english?.filter((c) => c.text.trim()) ?? [];
  const out = [
    `Transcribe the spoken Mandarin Chinese in this YouTube video${length}:`,
    t.url,
    `Title: ${t.title}`,
    '',
    'I am learning Chinese and will check my own handwritten dictation against your transcript, so it must be exactly what is said, word for word.',
    '',
    'Rules:',
    '- Write only the Chinese that is spoken, in simplified characters, with Chinese punctuation (，。？！).',
    '- Word for word: keep repetitions, particles (啊, 吧, 呢, 了) and fillers exactly as said. Do not correct, shorten or summarise.',
    '- If the same story is read more than once, transcribe every reading, in order.',
    '- No pinyin, no English, no translation, no speaker names, no notes, no descriptions of music or sounds.',
    '- Leave out anything that is not Mandarin speech (English introductions, music, silence).',
    '- If you cannot make out a word, write [?] in its place rather than guessing.',
    '- If the Chinese is also shown on screen as subtitles, use it to get the characters right — but only for what is actually said.',
    '',
  ];
  if (timed.length) {
    out.push(
      'The video has English captions. Here are their times. Give exactly one Chinese line for each caption below, with the same number and the same times, containing the Chinese said during that caption. If nothing Chinese is said during one, write [-] for it.',
      '',
      ...timed.map((c, i) => `${i + 1}\n${srtTime(c.at)} --> ${srtTime(c.end)}\n${c.text.replace(/\n/g, ' ')}\n`),
    );
  } else {
    out.push('Split it into short lines of one sentence or phrase each — the way subtitles are split — each with its start and end time.');
    out.push('');
  }
  out.push(
    'Answer format: a single SRT file inside one code block, and nothing before or after it. For example:',
    `${FENCE}srt`,
    '1',
    '00:00:01,200 --> 00:00:03,400',
    '我家有一只猫。',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,100',
    '猫在哪儿？',
    FENCE,
  );
  return out.join('\n');
}
