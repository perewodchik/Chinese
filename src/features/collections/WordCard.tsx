import type { ReactNode } from 'react';
import type { CollectionWord } from '../../domain/collection';
import { charId, wordId } from '../../domain/ids';
import { checkedBand, hskLabel } from '../../domain/wordlist';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';

interface Props {
  word: CollectionWord;
  /** show the reading, and the meaning with everything said about it; off to test yourself */
  pinyin?: boolean;
  english?: boolean;
  /** a checkbox or a remove button, at the end of the header */
  action?: ReactNode;
  dimmed?: boolean;
}

/**
 * One word as its writer explained it: the word, its band, what it means, how
 * it is used, and the sentences that show it.
 *
 * Characters you have not learned yet are marked in the word, and each one
 * opens its own drawer — the word is where you meet a character, and the
 * drawer is where you find out what it is made of. The word opens its own
 * drawer too, which is where it is added to a collection to learn. A chunk
 * the lists do not have — 去支付 — shows the list words it is made of, each
 * of which opens the same way.
 */
export function WordCard({ word, pinyin = true, english = true, action, dimmed }: Props) {
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const openItem = useOpenItem();
  const band = checkedBand(lib, word);
  const disagrees = band.checked && !band.parts && word.hsk !== null && band.hsk !== word.hsk;
  const open = (w: string) => openItem([...w].length > 1 ? wordId(w) : charId(w));

  return (
    <article className={`word-card${dimmed ? ' skipped' : ''}`}>
      <header>
        <div className="word-head">
          <span className="word-zh hanzi">
            {[...word.w].map((ch, i) =>
              lib.byChar.has(ch) ? (
                <button
                  key={i}
                  className={`ch${learned.has(charId(ch)) ? '' : ' fresh'}`}
                  title={learned.has(charId(ch)) ? `${ch} — learned` : `${ch} — not learned yet`}
                  onClick={() => openItem(charId(ch))}
                >
                  {ch}
                </button>
              ) : (
                <span key={i}>{ch}</span>
              ),
            )}
          </span>
          <Say text={word.w} />
          {pinyin && word.py && <span className="word-py">{word.py}</span>}
          <button
            className="btn ghost sm word-open"
            title="Open the word — to hear it, see where you met it, or add it to a collection"
            onClick={() => openItem(wordId(word.w))}
          >
            Open
          </button>
        </div>
        <div className="spacer" />
        <span
          className={`fact${band.checked ? ' good' : ''}`}
          title={
            band.parts
              ? `Not a word on the lists itself, but ${band.parts.join(' + ')} — the band of the hardest of them`
              : band.checked
              ? disagrees
                ? `The syllabus says ${hskLabel(band.hsk)}; Claude said ${hskLabel(word.hsk)}`
                : 'Checked against the syllabus'
              : word.hsk !== null
                ? `Not on the 2026 HSK lists (Claude said ${hskLabel(word.hsk)})`
                : 'Not on the 2026 HSK lists'
          }
        >
          {hskLabel(band.hsk)}
          {disagrees ? ' *' : ''}
        </span>
        {action}
      </header>

      <div className="word-body">
        {band.parts && (
          <p className="word-parts tiny muted">
            <span>Made of</span>
            {band.parts.map((p) => (
              <button key={p} className="pill as-button hanzi" onClick={() => open(p)}>
                {p}
              </button>
            ))}
          </p>
        )}
        {english && word.d && <p className="word-d">{word.d}</p>}
        {english && word.explain && <p className="word-explain">{word.explain}</p>}
        {word.examples.length > 0 && (
          <div className="word-examples">
            {word.examples.map((l, i) => (
              <p key={i} className="passage-line">
                {pinyin && l.py && <span className="py">{l.py}</span>}
                <span className="zh">
                  {l.zh} <Say text={l.zh} />
                </span>
                {english && l.en && <span className="en">{l.en}</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
