import { useMemo } from 'react';
import { type GeneratedText } from '../../domain/text';
import { useHashFlag } from '../../navigation/hash';
import { CopyOut } from './CopyOut';
import { Section } from './PartSection';

/**
 * Copying out, the part the learner likes best, shown as what it is: a strip
 * of the exercise book with the characters copied so far in ink, the next one
 * waiting in its square, and the ones after it faint, the way the copying
 * screen itself shows them. Tapping the strip is the same as the button.
 */
export function WritePart({ text, partId }: { text: GeneratedText; partId: string }) {
  // Kept in the address (#copy): reloaded, the copying is open again where it was left.
  const [copying, setCopying] = useHashFlag('copy');
  const chars = useMemo(() => text.lines.flatMap((l) => [...l.zh].filter((c) => /\p{Script=Han}/u.test(c))), [text.lines]);
  const total = chars.length;
  const copied = Math.min(total, text.study?.copied ?? 0);
  const done = total > 0 && copied >= total;
  // A window of the text around the place: two copied behind it, the rest ahead.
  const from = done ? Math.max(0, total - WRITE_SQUARES) : Math.max(0, Math.min(copied - 2, total - WRITE_SQUARES));
  const shown = chars.slice(from, from + WRITE_SQUARES);
  // The rest of the sentence the place is in, so the strip has a sentence to it.
  const where = useMemo(() => {
    let n = 0;
    for (const l of text.lines) {
      const han = [...l.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
      if (copied < n + han) {
        let k = copied - n;
        let i = 0;
        const zh = [...l.zh];
        while (k > 0 && i < zh.length) if (/\p{Script=Han}/u.test(zh[i++]!)) k--;
        return zh.slice(i).join('');
      }
      n += han;
    }
    return '';
  }, [text.lines, copied]);

  return (
    <Section id={partId} han="写" title="Write" aside={done ? 'Copied out' : `${copied} of ${total} characters`}>
      <p className="rd-part-lede">Copy the text into your notebook, a word at a time, with its strokes beside it. Copied to the end, the text counts as written.</p>
      <button className="rd-write" onClick={() => setCopying(true)} aria-label={done ? 'Copy the text out again' : 'Go on copying'}>
        <span className="rd-write-squares" aria-hidden>
          {Array.from({ length: WRITE_SQUARES }, (_, k) => {
            const c = shown[k];
            const at = from + k;
            return (
              <span key={k} className="rd-write-sq" data-state={!c ? 'empty' : done || at < copied ? 'done' : at === copied ? 'now' : undefined}>
                {c && <span className="hanzi">{c}</span>}
              </span>
            );
          })}
        </span>
        <span className="rd-write-line" aria-hidden>
          <i style={{ width: `${(copied / Math.max(1, total)) * 100}%` }} />
        </span>
        <span className="rd-write-foot">
          <span className="small muted grow">
            {done ? (
              'The whole text, copied out.'
            ) : (
              <>
                {copied ? 'Go on from' : 'Start with'} <span className="hanzi">{where}</span>
              </>
            )}
          </span>
        </span>
      </button>
      <button className="btn tonal lg rd-write-go" onClick={() => setCopying(true)}>
        {done ? 'Copy it out again' : copied ? 'Go on copying' : 'Start copying'}
      </button>
      {copying && <CopyOut text={text} onClose={() => setCopying(false)} />}
    </Section>
  );
}

/** How many squares of the exercise book the Write part shows. */
const WRITE_SQUARES = 8;
