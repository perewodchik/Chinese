import type { ReactNode } from 'react';
import { personaOf } from '../../../shared/personas';
import type { TextLine } from '../../domain/text';
import { Portrait } from '../pinyin/Portrait';

/**
 * A dialogue as a comic: each line a speech bubble from a face, the speakers
 * taking turns left and right.
 *
 * The faces are the conversation partners' — drawn from the same parts, so a
 * name the passage invents (小明, 王老师) still gets a face of its own, the
 * same face every time that name speaks. Lines without a speaker alternate
 * between two. The face of whoever is being read aloud is the one talking.
 */
export function Comic({
  lines,
  reading,
  sentence,
  english,
}: {
  lines: Array<{ i: number; line: TextLine }>;
  /** the line being read aloud */
  reading: number | null;
  /** the line drawn as the reader draws it, words and pinyin */
  sentence: (i: number) => ReactNode;
  english: boolean;
}) {
  const speakers: string[] = [];
  const who = (l: TextLine, n: number) => l.who || (n % 2 === 0 ? 'A' : 'B');
  for (const [n, { line }] of lines.entries()) {
    const w = who(line, n);
    if (!speakers.includes(w)) speakers.push(w);
  }
  return (
    <div className="comic">
      {lines.map(({ i, line }, n) => {
        const w = who(line, n);
        const side = speakers.indexOf(w) % 2 === 0 ? 'left' : 'right';
        const persona = personaOf(w);
        const speaking = reading === i;
        return (
          <div key={i} className="comic-turn" data-side={side} data-reading={speaking || undefined}>
            <span className="comic-face">
              <Portrait voice={persona?.id ?? `speaker-${w}`} gender={persona?.gender} mood={speaking ? 'speaking' : 'idle'} size="sm" still={!speaking} />
              <span className="comic-name hanzi">{line.who ?? ''}</span>
            </span>
            <div className="comic-bubble">
              <div className="comic-zh">{sentence(i)}</div>
              {english && line.en && <div className="comic-en">{line.en}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
