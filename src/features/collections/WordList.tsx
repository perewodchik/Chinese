import { useState } from 'react';
import type { Collection } from '../../domain/collection';
import { setWords } from '../../store/commands';
import { WordCard } from './WordCard';

/**
 * The words a collection was written around, at /collections/:id/words.
 *
 * Pinyin and meaning can be turned off, which turns the page into a test of
 * itself: the word and its examples, and whether you can still read them.
 */
export function WordList({ c }: { c: Collection }) {
  const [pinyin, setPinyin] = useState(true);
  const [meaning, setMeaning] = useState(true);
  const words = c.words ?? [];

  function remove(w: string) {
    if (!confirm(`Take “${w}” out of this list? Its characters stay in the collection.`)) return;
    setWords(
      c.id,
      words.filter((x) => x.w !== w),
    );
  }

  return (
    <div className="word-list">
      <div className="scope-bar" style={{ marginBottom: 12 }}>
        <div className="chips">
          <button className="chip" aria-pressed={pinyin} onClick={() => setPinyin(!pinyin)}>
            Pinyin
          </button>
          <button className="chip" aria-pressed={meaning} onClick={() => setMeaning(!meaning)}>
            Meaning
          </button>
        </div>
        <div className="spacer" />
        <span className="tiny muted">
          {words.length} word{words.length === 1 ? '' : 's'} · click a character to open it
        </span>
      </div>

      {c.brief && (
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          Asked for: <i>{c.brief}</i>
        </p>
      )}
      {c.note && meaning && <p className="notice teacher" style={{ margin: '0 0 14px' }}>{c.note}</p>}

      <div className="word-grid">
        {words.map((w) => (
          <WordCard
            key={w.w}
            word={w}
            pinyin={pinyin}
            english={meaning}
            action={
              <button className="btn ghost sm" title="Take this word out of the list" onClick={() => remove(w.w)}>
                ✕
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}
