import { useEffect, useMemo } from 'react';
import { charId, wordId, type ItemId } from '../../domain/ids';
import { segment } from '../../domain/segment';
import { isHanzi } from '../../domain/text';
import { syllablesOf, transcriptWords } from '../../domain/video';
import { itemForToken, wordInfo } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { keepVideoItems, patchVideo } from '../../store/videoCommands';
import { SelectToggle } from '../../ui/SelectToggle';
import { useToast } from '../../ui/toast';
import { useSelectMode } from '../../ui/useRangeSelection';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { isNoise } from '../../domain/videoFit';
import { skippedWords, useFit } from './hooks';
import { useVideoCtx } from './context';

interface Candidate {
  w: string;
  py: string;
  en: string;
  /** Claude's word for it, when there is a pack */
  now: boolean;
}

/**
 * The part's words: which are new, and taking the ones worth learning.
 *
 * The strip at the top is the one-tap way — the new words worth learning at
 * this level, Claude's order when there is a pack (it knows which matter in
 * this video), the syllabus's otherwise; + keeps one, ✕ waves it off for this
 * video. Below it the part itself, pinyin over each word and the new ones
 * underlined: a tap opens a word's card, as everywhere, and Select picks
 * words and characters to keep in a run.
 */
export function WordsStep() {
  const { video: v, part, lines, pack } = useVideoCtx();
  const lib = useLibrary();
  const knowledge = useWordKnowledge();
  const openItem = useOpenItem();
  const toast = useToast();
  const fit = useFit(v, lines);
  const collections = useStore((s) => s.collections);
  const kept = useMemo(() => new Set(collections.find((c) => c.presetId === 'words-videos')?.items ?? []), [collections]);
  const ignore = useMemo(() => new Set([...skippedWords(v), ...transcriptWords(v.lines, lib)]), [v, lib]);
  /** Not worth marking as new: a name, a noise, a word waved off. */
  const plain = (w: string) => ignore.has(w) || isNoise(w) || v.skipped.includes(w);

  const tokens = useMemo(() => lines.map((l) => segment(l.zh, lib, ignore)), [lines, lib, ignore]);
  const order = useMemo(
    () => [...new Set(tokens.flat().filter((t) => t.word && isHanzi([...t.text][0]!)).map((t) => itemForToken(lib, t.text)))],
    [tokens, lib],
  );
  const select = useSelectMode<ItemId>(order);

  const candidates: Candidate[] = useMemo(() => {
    const out: Candidate[] = [];
    const seen = new Set<string>();
    const push = (c: Candidate) => {
      if (seen.has(c.w) || v.skipped.includes(c.w) || knowledge.status(c.w) !== 'new') return;
      seen.add(c.w);
      out.push(c);
    };
    if (pack) {
      for (const w of pack.words.filter((x) => x.verdict === 'learn_now')) push({ w: w.w, py: w.py, en: w.en, now: true });
      for (const w of pack.words.filter((x) => x.verdict === 'later')) push({ w: w.w, py: w.py, en: w.en, now: false });
    } else if (fit) {
      for (const n of fit.newInBand) {
        const info = wordInfo(lib, n.w);
        push({ w: n.w, py: info?.py ?? '', en: info?.d ?? '', now: true });
      }
      for (const n of fit.newAbove) {
        const info = wordInfo(lib, n.w);
        push({ w: n.w, py: info?.py ?? '', en: info?.d ?? '', now: false });
      }
    }
    return out;
  }, [pack, fit, lib, knowledge, v.skipped]);

  const open = candidates.filter((c) => !kept.has(wordId(c.w)));
  const worthNow = open.filter((c) => c.now);

  // Every word worth learning now either kept or waved off: the words are taken.
  useEffect(() => {
    if (candidates.some((c) => c.now) && !worthNow.length && !v.marks.words) patchVideo(v.id, { marks: { words: true } });
  }, [candidates, worthNow.length, v.id, v.marks.words]);

  function keep(ids: ItemId[]) {
    const n = keepVideoItems(ids);
    toast(n ? `${n} added to “Words from videos”.` : 'Already in “Words from videos”.');
  }

  const newChars = (fit?.newChars ?? []).filter((c) => !kept.has(charId(c))).slice(0, 16);

  return (
    <div className="video-step words-step">
      <h2 className="videos-label">New in {v.parts.length > 1 ? `part ${part + 1}` : 'this video'}</h2>
      {open.length ? (
        <div className="new-words">
          {open.slice(0, 24).map((c) => (
            <span key={c.w} className="new-word" data-later={!c.now || undefined}>
              <button className="new-word-main" onClick={() => openItem(wordId(c.w))}>
                <b className="hanzi">{c.w}</b>
                <span className="tiny new-word-py">{c.py}</span>
                <span className="tiny muted new-word-en">{c.en}</span>
              </button>
              <button className="new-word-act" aria-label={`Learn ${c.w}`} title="Add to Words from videos" onClick={() => keep([wordId(c.w)])}>
                +
              </button>
              <button
                className="new-word-act"
                aria-label={`Not now: ${c.w}`}
                title="Not from this video"
                onClick={() => patchVideo(v.id, { skipped: [...v.skipped, c.w] })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted">
          {candidates.length ? 'Every new word here is kept or waved off.' : 'No new words in this part — every word is one you know or are learning.'}
        </p>
      )}
      {!pack && open.length > 0 && (
        <p className="tiny muted">
          Ordered by the syllabus. With Claude’s study pack (Study) they are ordered by how much they matter in this video.
        </p>
      )}

      {newChars.length > 0 && (
        <>
          <h2 className="videos-label">Characters you have not learned</h2>
          <div className="vchars">
            {newChars.map((c) => (
              <span key={c} className="vchar">
                <button className="vchar-glyph" onClick={() => openItem(charId(c))}>
                  {c}
                </button>
                <button className="new-word-act" aria-label={`Learn ${c}`} onClick={() => keep([charId(c)])}>
                  +
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {pack?.senses.length ? (
        <>
          <h2 className="videos-label">Words you know, used differently</h2>
          <ul className="small senses">
            {pack.senses.map((s) => (
              <li key={s.w}>
                <b className="hanzi">{s.w}</b> — {s.en}
                {s.lines.length > 0 && <span className="tiny muted"> (line {s.lines.join(', ')})</span>}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="row words-bar">
        <h2 className="videos-label" style={{ margin: 0 }}>
          The text
        </h2>
        <div className="spacer" />
        {select.on && select.selected.size > 0 && (
          <button
            className="btn sm primary"
            onClick={() => {
              keep([...select.selected]);
              select.toggleMode();
            }}
          >
            Learn {select.selected.size}
          </button>
        )}
        <SelectToggle on={select.on} onToggle={select.toggleMode} />
      </div>
      <ol className="word-lines">
        {lines.map((line, i) => {
          const syl = syllablesOf(line);
          let h = 0;
          return (
            <li key={i}>
              <span className="check-n">{i + 1}</span>
              <span className="word-line">
                {tokens[i]!.map((t, k) => {
                  if (!t.word) return <span key={k} className="word-punct">{t.text}</span>;
                  const n = [...t.text].filter(isHanzi).length;
                  const py = syl.slice(h, h + n).join('');
                  h += n;
                  const id = itemForToken(lib, t.text);
                  const status = knowledge.status(t.text);
                  return (
                    <button
                      key={k}
                      className="word-tok"
                      data-new={(status === 'new' && !plain(t.text)) || undefined}
                      aria-pressed={select.on ? select.selected.has(id) : undefined}
                      onClick={(e) => (select.on ? select.toggle(id, e.shiftKey) : openItem(id))}
                    >
                      <span className="tiny word-tok-py">{py || ' '}</span>
                      <span className="hanzi">{t.text}</span>
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
