import { useMemo, useRef, useState } from 'react';
import type { ItemId } from '../../domain/ids';
import { hskLabel, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { setShelfStudy } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { useLibrary } from '../shared/library';
import { useWordDone, useWordLevel } from './Passage';
import { LevelQuick } from '../../ui/LevelPicker';
import { Section } from './PartSection';

export function WordsPart({
  text,
  setId,
  study,
  onShowLine,
  partId,
}: {
  text: GeneratedText;
  setId: string | null;
  study: ReadonlySet<ItemId>;
  onShowLine: (i: number) => void;
  partId: string;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [all, setAll] = useState(false);
  const words = text.vocab;
  const levelOfWord = useWordLevel();
  const done = useWordDone(study);
  const doneN = words.filter((w) => done(w.w)).length;
  // The least known first: they are what the part is for. Sorted when the text
  // opens and then left alone, so setting a level from a row does not move it.
  const order = useRef<{ of: typeof words; ws: string[] } | null>(null);
  if (order.current?.of !== words) order.current = { of: words, ws: [...words].sort((a, b) => levelOfWord(a.w) - levelOfWord(b.w)).map((w) => w.w) };
  const ordered = useMemo(() => {
    const at = new Map(order.current!.ws.map((w, i) => [w, i]));
    return [...words].sort((a, b) => (at.get(a.w) ?? 0) - (at.get(b.w) ?? 0));
  }, [words]);
  const shown = all ? ordered : ordered.slice(0, 6);

  /** The line a grammar note's example comes from, so it can be pointed at in the text. */
  const lineOf = (zh: string | undefined) => {
    if (!zh) return -1;
    const bare = (s: string) => s.replace(/[^\p{Script=Han}]/gu, '');
    const z = bare(zh);
    return text.lines.findIndex((l) => bare(l.zh).includes(z) || (z.length > 3 && z.includes(bare(l.zh))));
  };

  return (
    <Section id={partId} han="词" title="Words" aside={words.length ? `${doneN} of ${words.length} done` : undefined}>
      {words.length > 0 ? (
        <>
          <p className="rd-part-lede">A word counts as done once it is Known or Solid, or once you add it to your list.</p>
          <ul className="rd-words">
            {shown.map((w) => {
              const id = itemForToken(lib, w.w);
              const band = lib.byWord.get(w.w)?.hsk;
              return (
                <li key={w.w} className="rd-word">
                  <button className="rd-word-main" onClick={() => openItem(id)}>
                    <span className="hanzi rd-word-zh">{w.w}</span>
                    <span className="rd-word-text">
                      <span className="rd-word-py">{w.py}</span>
                      <span className="rd-word-d">
                        {w.d}
                        {band ? <span className="tiny muted"> {hskLabel(band)}</span> : null}
                      </span>
                    </span>
                  </button>
                  <LevelQuick id={id} level={levelOfWord(w.w)} />
                  {/* On the shelf's list or not: a choice to learn it, which says nothing of how well it is known. */}
                  <button
                    className="rd-add"
                    disabled={!setId}
                    aria-pressed={study.has(id)}
                    title={study.has(id) ? 'On this shelf’s list: tap to take it off' : 'Add it to this shelf’s list to learn'}
                    onClick={() => setId && setShelfStudy(setId, [id], !study.has(id))}
                  >
                    <Icon name={study.has(id) ? 'check' : 'plus'} />
                  </button>
                </li>
              );
            })}
          </ul>
          {ordered.length > shown.length && (
            <button className="btn quiet sm rd-more" onClick={() => setAll(true)}>
              Show all {ordered.length}
            </button>
          )}
        </>
      ) : (
        <p className="rd-part-lede">This text came without a word list. Tap any word in it to look it up.</p>
      )}

      {text.grammar.map((g, k) => {
        const at = lineOf(g.zh);
        return (
          <div key={k} className="rd-grammar">
            <div className="row" style={{ gap: 8 }}>
              <b>{g.point}</b>
              <span className="spacer" />
              {at >= 0 && (
                <button className="btn quiet sm" onClick={() => onShowLine(at)}>
                  In line {at + 1}
                </button>
              )}
            </div>
            {g.en && <p className="rd-grammar-en">{g.en}</p>}
            {g.zh && <p className="hanzi rd-grammar-zh">{g.zh}</p>}
          </div>
        );
      })}

      {text.note.trim() && <p className="rd-note">{text.note}</p>}
    </Section>
  );
}
