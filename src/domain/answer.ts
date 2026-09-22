import { tryParse, fences } from './parse';
import type { GeneratedText, TextLine } from './text';

/**
 * Checking an answer to a comprehension question.
 *
 * The question is about a passage the reader has just read, and the answer is
 * theirs — in Chinese, in English, or in a bit of both. What is worth hearing
 * back is not a score but whether they understood, and if the Chinese was
 * off, how a native speaker would have put it. So the prompt hands over the
 * whole passage, the question, the writer's own model answer where there is
 * one, and asks for a verdict, a line of feedback, and a correction.
 */

export type Verdict = 'right' | 'nearly' | 'wrong';

export interface AnswerCheck {
  verdict: Verdict;
  /** a sentence or two, in English, to the reader */
  feedback: string;
  /** the answer as it could have been written, in Chinese, when it is worth showing */
  better: string;
}

export function checkPrompt(text: Pick<GeneratedText, 'lines' | 'title'>, question: TextLine, answer: string): string {
  return [
    'You are checking a Chinese learner’s answer to a reading-comprehension question. Be warm, brief and exact.',
    '',
    `## The passage — ${text.title}`,
    '',
    text.lines.map((l) => l.zh).join(''),
    '',
    '## The question',
    '',
    question.zh + (question.en ? ` (${question.en})` : ''),
    ...(question.a ? ['', `Model answer: ${question.a}`] : []),
    '',
    '## The learner’s answer',
    '',
    answer.trim(),
    '',
    '## What to send back',
    '',
    'Judge the understanding first: an answer in English, or in simple Chinese, that shows the passage was understood is right. Mark it nearly when it is partly right or the meaning is right but the Chinese has a real mistake. Mark it wrong when it misreads the passage.',
    '',
    'One JSON code block and nothing else:',
    '',
    '```json',
    '{ "verdict": "right | nearly | wrong", "feedback": "one or two sentences in English: what was right, what the passage actually says, or what to fix in the Chinese", "better": "a natural Chinese answer at the learner’s level, or an empty string if theirs needs no change" }',
    '```',
  ].join('\n');
}

const VERDICTS: Verdict[] = ['right', 'nearly', 'wrong'];

/** Claude's verdict, read as forgivingly as the passages are. */
export function readCheck(raw: string): AnswerCheck | null {
  for (const candidate of [...fences(raw), raw, raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)]) {
    const parsed = tryParse(candidate);
    const v = parsed?.value as Record<string, unknown> | undefined;
    if (!v || typeof v !== 'object') continue;
    const verdict = String(v.verdict ?? '').toLowerCase().trim();
    const found = VERDICTS.find((x) => verdict.startsWith(x)) ?? (verdict.includes('partial') ? 'nearly' : null);
    if (!found) continue;
    return {
      verdict: found,
      feedback: typeof v.feedback === 'string' ? v.feedback.trim() : '',
      better: typeof v.better === 'string' ? v.better.trim() : '',
    };
  }
  return null;
}
