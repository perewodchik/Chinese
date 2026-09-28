import { useEffect, useMemo, useState } from 'react';
import type { Collection } from '../../domain/collection';
import { charId, isWordId, wordId, type ItemId } from '../../domain/ids';
import { segment } from '../../domain/segment';
import { isHanzi } from '../../domain/text';
import { copiedShare, syllablesOf, transcriptWords } from '../../domain/video';
import { itemForToken, wordInfo } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { findVideo, keepVideoItems, patchVideo } from '../../store/videoCommands';
import { Seg } from '../../ui/Seg';
import { SelectToggle } from '../../ui/SelectToggle';
import { useToast } from '../../ui/toast';
import { useSelectMode } from '../../ui/useRangeSelection';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { isNoise } from '../../domain/videoFit';
import { skippedWords, useFit } from './hooks';
import { useVideoCtx } from './context';

/** How big the text is drawn, as a multiple of the usual size. */
const SIZES = [
  { id: '1', label: 'A', title: 'Usual size' },
  { id: '1.3', label: 'A+', title: 'Larger' },
  { id: '1.6', label: 'A++', title: 'Large' },
  { id: '2', label: 'A+++', title: 'Largest' },
] as const;
type Size = (typeof SIZES)[number]['id'];

/** A per-device choice, like the reader's: how the text looks here, not what was learned. */
const VIEW_KEY = 'hanzi.videos.wordsView';
function readView(): { size: Size; english: boolean; pinyin: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as { size?: string; english?: boolean; pinyin?: boolean };
    return {
      size: SIZES.some((s) => s.id === v.size) ? (v.size as Size) : '1',
      english: v.english === true,
      pinyin: v.pinyin !== false,
    };
  } catch {
    return { size: '1', english: false, pinyin: true };
  }
}

/**
 * Where kept words or characters go: “Words from videos” unless another
 * collection is picked. Remembered in Settings, so every device agrees.
 */
function KeepTo({ value, onChange, what }: { value: string; onChange: (id: string) => void; what: string }) {
  const collections = useStore((s) => s.collections);
  const others = collections.filter((c) => c.presetId !== 'words-videos');
  const current = others.some((c) => c.id === value) ? value : '';
  return (
    <select
      className="keep-to tiny"
      value={current}
      aria-label={`Collection new ${what} go to`}
      title={`Where + puts new ${what}`}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">→ Words from videos</option>
      {others.map((c) => (
        <option key={c.id} value={c.id}>
          → {c.name}
        </option>
      ))}
    </select>
  );
}

/** The collection `KeepTo` points at, if it exists yet. */
const keepTarget = (collections: Collection[], to: string) =>
  (to && collections.find((c) => c.id === to)) || collections.find((c) => c.presetId === 'words-videos');

interface Candidate {
  w: string;
  py: string;
  en: string;
  /** Claude's word for it, when there is a pack */
  now: boolean;
}

/**
 * The part's text and its words: which are new, and taking the ones worth
 * learning. A line's number ticks it as copied into the notebook.
 *
 * The strip at the top is the one-tap way — the new words worth learning at
 * this level, Claude's order when there is a pack (it knows which matter in
 * this video), the syllabus's otherwise; + keeps one, ✕ waves it off for this
 * video. Below it the part itself, pinyin over each word and the new ones
 * underlined: a tap opens a word's card, as everywhere, and Select picks
 * words and characters to keep in a run.
 */
export function WordsStep() {
  const { video: v, part, lines, offset, pack } = useVideoCtx();
  const lib = useLibrary();
  const knowledge = useWordKnowledge();
  const openItem = useOpenItem();
  const toast = useToast();
  const fit = useFit(v, lines);
  const collections = useStore((s) => s.collections);
  const wordsTo = useStore((s) => s.settings.videoWordsTo);
  const charsTo = useStore((s) => s.settings.videoCharsTo);
  // What is already in the collection a thing would go to needs no + any more.
  const kept = useMemo(() => new Set(keepTarget(collections, wordsTo)?.items ?? []), [collections, wordsTo]);
  const keptChars = useMemo(() => new Set(keepTarget(collections, charsTo)?.items ?? []), [collections, charsTo]);
  const ignore = useMemo(() => new Set([...skippedWords(v), ...transcriptWords(v.lines, lib)]), [v, lib]);
  /** Not worth marking as new: a name, a noise, a word waved off. */
  const plain = (w: string) => ignore.has(w) || isNoise(w) || v.skipped.includes(w);

  const tokens = useMemo(() => lines.map((l) => segment(l.zh, lib, ignore)), [lines, lib, ignore]);
  const order = useMemo(
    () => [...new Set(tokens.flat().filter((t) => t.word && isHanzi([...t.text][0]!)).map((t) => itemForToken(lib, t.text)))],
    [tokens, lib],
  );
  const select = useSelectMode<ItemId>(order);
  const [view, setViewState] = useState(readView);
  const setView = (patch: Partial<typeof view>) => {
    const next = { ...view, ...patch };
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(next));
    } catch {
      /* fine without: it is only how the text looks */
    }
  };
  const hasEnglish = lines.some((l) => l.en);

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
    // Words to where words go, characters to where characters go.
    const words = ids.filter(isWordId);
    const chars = ids.filter((id) => !isWordId(id));
    const said: string[] = [];
    for (const [some, to] of [[words, wordsTo], [chars, charsTo]] as const) {
      if (!some.length) continue;
      const { added, name } = keepVideoItems(some, to);
      said.push(added ? `${added} added to “${name}”` : `already in “${name}”`);
    }
    if (said.length) toast(`${said.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()));
  }

  // Lines copied into the notebook, ticked on their number; the share is of the whole video.
  const copied = new Set(v.copied ?? []);
  const toggleCopied = (index: number) => {
    // Read from the store, not this render, so quick taps in a row all count.
    const now = findVideo(v.id) ?? v;
    const next = new Set(now.copied ?? []);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    const share = copiedShare({ ...now, copied: [...next] });
    patchVideo(v.id, { copied: [...next].sort((a, b) => a - b), ...(share === 1 && !now.marks.written ? { marks: { written: true } } : {}) });
  };
  const copiedPct = Math.round(copiedShare(v) * 100);

  const newChars = (fit?.newChars ?? []).filter((c) => !keptChars.has(charId(c))).slice(0, 16);

  return (
    <div className="video-step words-step">
      <div className="row keep-head">
        <h2 className="videos-label">New in {v.parts.length > 1 ? `part ${part + 1}` : 'this video'}</h2>
        <KeepTo what="words" value={wordsTo} onChange={(videoWordsTo) => setSettings({ videoWordsTo })} />
      </div>
      {open.length ? (
        <div className="new-words">
          {open.slice(0, 24).map((c) => (
            <span key={c.w} className="new-word" data-later={!c.now || undefined}>
              <button className="new-word-main" onClick={() => openItem(wordId(c.w))}>
                <b className="hanzi">{c.w}</b>
                <span className="tiny new-word-py">{c.py}</span>
                <span className="tiny muted new-word-en">{c.en}</span>
              </button>
              <button className="new-word-act" aria-label={`Learn ${c.w}`} title="Add to the collection picked above" onClick={() => keep([wordId(c.w)])}>
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
          <div className="row keep-head">
            <h2 className="videos-label">Characters you have not learned</h2>
            <KeepTo what="characters" value={charsTo} onChange={(videoCharsTo) => setSettings({ videoCharsTo })} />
          </div>
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
        <span
          className="tiny copied-pct"
          data-done={copiedPct === 100 || undefined}
          title={`${copied.size} of ${v.lines.length} lines of the video written in the notebook`}
        >
          {copiedPct}% written
        </span>
        <div className="spacer" />
        <Seg<Size> size="sm" value={view.size} options={SIZES} onChange={(size) => setView({ size })} label="Text size" />
        <button
          className="chip"
          aria-pressed={view.pinyin}
          title="Show the pinyin over each word"
          onClick={() => setView({ pinyin: !view.pinyin })}
        >
          Pinyin
        </button>
        <button
          className="chip"
          aria-pressed={view.english}
          disabled={!hasEnglish}
          title={hasEnglish ? 'Show the English under each line' : 'This text has no English yet — Study adds it'}
          onClick={() => setView({ english: !view.english })}
        >
          English
        </button>
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
      <ol className="word-lines" data-nopy={!view.pinyin || undefined} style={{ ['--words-scale' as string]: view.size }}>
        {lines.map((line, i) => {
          const syl = syllablesOf(line);
          let h = 0;
          const index = offset + i;
          return (
            <li key={i} data-copied={copied.has(index) || undefined}>
              <button
                className="word-n"
                aria-pressed={copied.has(index)}
                aria-label={`Line ${index + 1} written in the notebook`}
                onClick={() => toggleCopied(index)}
              >
                <span className="tiny word-tok-py" aria-hidden>
                  {'\u00a0'}
                </span>
                <span className="word-n-row">
                  <span className="word-n-box">{copied.has(index) ? '✓' : index + 1}</span>
                </span>
              </button>
              <span className="word-body">
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
                {view.english && line.en && <span className="word-en">{line.en}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
