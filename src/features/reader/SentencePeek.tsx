import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { SentenceMark, TextLine } from '../../domain/text';
import { Say } from '../../ui/Say';
import { placeFor, type Place } from './WordPeek';

export interface HeldSentence {
  i: number;
  /** the sentence on the page, which the card is placed by */
  el: HTMLElement;
}

/** Copies `text`; the old way where the Clipboard API is refused (an http page, an old Safari). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/**
 * A sentence held down, in brief: its English, its pinyin, its sound, and
 * Copy — the Chinese alone, or with its English under it. It sits by the
 * sentence as a tapped word's card sits by the word (a strip on a phone), and
 * goes the same way: a tap anywhere else, or Escape.
 */
export function SentencePeek({
  held,
  line,
  onClose,
  mark,
  onMark,
}: {
  held: HeldSentence;
  line: TextLine;
  onClose: () => void;
  /** this sentence's highlight and note, if it has one */
  mark?: SentenceMark;
  /** highlight it (with a note, or none), or take the highlight off */
  onMark?: (m: SentenceMark) => void;
}) {
  const marked = Boolean(mark && !mark.off);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(mark?.note ?? '');
  useEffect(() => {
    setNoting(false);
    setNote(mark?.note ?? '');
  }, [held.i]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>(() => placeFor(held.el, null));
  const [copied, setCopied] = useState<'zh' | 'both' | null>(null);
  useEffect(() => setCopied(null), [held.i]);

  const measure = useCallback(() => setPlace(placeFor(held.el, card.current)), [held.el]);
  useLayoutEffect(measure, [measure, line]);
  useEffect(() => {
    let frame = 0;
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()));
    };
    document.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [measure]);

  // A phone: the sentence is kept above the strip, not under it.
  // Checked again as the card takes its height (its fonts and sound button arrive a moment after it).
  useEffect(() => {
    const c = card.current;
    if (place.kind !== 'strip' || !c) return;
    const keepClear = () => {
      const r = held.el.getBoundingClientRect();
      // From its resting place, not its box: the card is still rising into it when it is first measured.
      const clear = window.innerHeight - (parseFloat(getComputedStyle(c).bottom) || 0) - c.offsetHeight - 16;
      if (r.bottom > clear) document.querySelector('.main')?.scrollBy({ top: r.bottom - clear + 24, behavior: 'smooth' });
    };
    const seen = new ResizeObserver(keepClear);
    seen.observe(c);
    return () => seen.disconnect();
  }, [held.el, place.kind]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (card.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const copy = (what: 'zh' | 'both') =>
    void copyText(what === 'zh' ? line.zh : `${line.zh}\n${line.en}`).then((ok) => {
      if (!ok) return;
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
    });

  const style: CSSProperties =
    place.kind === 'strip' ? {} : ({ left: place.left, top: place.top, '--arrow': `${place.arrow}px` } as CSSProperties);

  return (
    <div ref={card} className="rd-peek rd-peek-sent no-print" data-place={place.kind} style={style} role="dialog" aria-label="The sentence in English">
      {place.kind === 'strip' && <span className="rd-peek-grab" aria-hidden />}
      <p className="rd-peek-en" lang="en">
        {line.en || 'No English for this sentence yet.'}
      </p>
      {line.py && <p className="rd-peek-py">{line.py}</p>}
      <div className="rd-peek-acts">
        <Say text={line.zh} size="lg" title="Hear the sentence" />
        {onMark && (
          <>
            <button
              className="btn quiet sm"
              aria-pressed={marked}
              onClick={() => onMark(marked ? { at: Date.now(), off: true } : { at: Date.now(), ...(mark?.note ? { note: mark.note } : {}) })}
            >
              {marked ? 'Unhighlight' : 'Highlight'}
            </button>
            <button className="btn quiet sm" aria-expanded={noting} onClick={() => setNoting((n) => !n)}>
              Note
            </button>
          </>
        )}
        <span className="spacer" />
        {line.en && (
          <button className="btn quiet sm rd-peek-copy-both" onClick={() => copy('both')}>
            {copied === 'both' ? 'Copied' : 'Copy with English'}
          </button>
        )}
        <button className="btn tonal sm rd-peek-copy" onClick={() => copy('zh')}>
          {copied === 'zh' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {noting && onMark && (
        <form
          className="rd-peek-note"
          onSubmit={(e) => {
            e.preventDefault();
            onMark({ at: Date.now(), ...(note.trim() ? { note: note.trim() } : {}) });
            setNoting(false);
          }}
        >
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your note on this sentence" aria-label="Your note on this sentence" rows={3} autoFocus />
          <button className="btn tonal sm" type="submit">
            Save the note
          </button>
        </form>
      )}
    </div>
  );
}
