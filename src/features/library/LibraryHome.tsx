import { useMemo, useState } from 'react';
import { useQuery } from '../../navigation/query';
import { Link, useNavigate } from 'react-router';
import { nextCollectionName } from '../../domain/collection';
import { charId, wordId } from '../../domain/ids';
import { pendingSheets, type PrintedSheet } from '../../domain/memory';
import { HSK_BANDS } from '../../domain/text';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useLevelOf } from '../shared/levels';
import { LevelBar } from '../../ui/LevelMark';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { paths } from '../../navigation/paths';
import { createCollection, discardSheet, startListPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { FromTexts } from './FromTexts';
import { bandSet, FROM_TEXT, ownLists, textWordsSet, topicSets, withList, type LibSet } from './sets';
import { CharTile, WordRow } from './SetPage';
import './home.css';

const flat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * How much of a set is known, from review alone: its characters and words
 * counted at each level, 0 to 3, and how many are met at least.
 */
export function useSetProgress() {
  const levelOf = useLevelOf();
  const know = useWordKnowledge();
  return (set: LibSet) => {
    const levels: [number, number, number, number] = [0, 0, 0, 0];
    let chars = 0;
    let words = 0;
    for (const c of set.chars) {
      const l = levelOf(charId(c));
      levels[l] += 1;
      if (l > 0) chars += 1;
    }
    for (const w of set.words) {
      const l = know.level(w);
      levels[l] += 1;
      if (l > 0) words += 1;
    }
    return { chars, words, levels, share: (chars + words) / Math.max(1, set.chars.length + set.words.length) };
  };
}

function count(set: LibSet) {
  const parts = [];
  if (set.chars.length) parts.push(`${set.chars.length.toLocaleString('en')} character${set.chars.length === 1 ? '' : 's'}`);
  if (set.words.length) parts.push(`${set.words.length.toLocaleString('en')} word${set.words.length === 1 ? '' : 's'}`);
  return parts.join(', ') || 'Empty';
}

/**
 * The library, at /library: every set of characters and words in one place —
 * your own lists, the HSK bands, the topics — and the things to look up
 * beside them: the radicals, their families, blank paper.
 *
 * It took over Lists to print. A list is a set you made; a band is a set the
 * syllabus made; both are looked through, learned from and printed the same
 * way, from the set's own page.
 */
export function LibraryHome() {
  useTitle('Library');
  const lib = useLibrary();
  const navigate = useNavigate();
  const openItem = useOpenItem();
  const collections = useStore((s) => s.collections);
  const levelOf = useLevelOf();
  const know = useWordKnowledge();
  const band = useStore((s) => s.settings.hskBand);
  const waiting = pendingSheets(useStore((s) => s.sheets));
  const progress = useSetProgress();
  // Kept in the address (?q=) as it is typed, so a reload finds the same search.
  const [query, setQuery] = useQuery();
  const [q, setQ] = useState(() => query.get('q') ?? '');
  const [allTopics, setAllTopics] = useState(false);
  const [allLists, setAllLists] = useState(false);

  const bands = useMemo(() => HSK_BANDS.map((b) => withList(bandSet(lib, b.id), collections)), [lib, collections]);
  const texts = useStore((s) => s.texts);
  // The words your texts brought that no band has come first: they are the ones you have met.
  const ownWords = useMemo(() => {
    const own = textWordsSet(lib, texts);
    return own ? withList(own, collections) : null;
  }, [lib, collections, texts]);
  const topics = useMemo(() => topicSets(lib).map((t) => withList(t, collections)), [lib, collections]);
  const [otherLevels, setOtherLevels] = useState(false);
  const levelSet = bands.find((b) => b.id === `hsk-${band}`) ?? bands[0]!;
  const mine = useMemo(() => ownLists(collections), [collections]);
  const fromTexts = useMemo(() => collections.filter((c) => FROM_TEXT.test(c.name)), [collections]);

  const found = useMemo(() => {
    const needle = flat(q.trim());
    if (!needle) return null;
    const hit = (...s: string[]) => s.some((x) => flat(x).includes(needle));
    return {
      chars: lib.characters.filter((c) => hit(c.c, c.py.join(' '), c.def)).slice(0, 32),
      words: lib.words.filter((w) => hit(w.w, w.py, w.d)).slice(0, 12),
      sets: [...mine, ...bands, ...(ownWords ? [ownWords] : []), ...topics].filter((s) => hit(s.name)),
      // B6: the same search in your texts, so a word looked up here is found where it was read.
      texts: texts.filter((t) => t.titleZh.includes(q.trim()) || t.lines.some((l) => l.zh.includes(q.trim()))),
    };
  }, [q, lib, mine, bands, ownWords, topics, texts]);

  function newList() {
    const c = createCollection({ name: nextCollectionName(collections) });
    navigate(paths.collection(c.id, 'items'));
  }

  const shownTopics = allTopics ? topics : topics.slice(0, 4);
  // Newest first: the three made last, the rest behind All.
  const newest = useMemo(() => [...mine].reverse(), [mine]);
  const shownLists = allLists ? newest : newest.slice(0, 3);

  return (
    <div className="lib-home">
      <header className="page-head">
        <h1>Library</h1>
        <span className="spacer" />
        <Menu
          label={
            <>
              <Icon name="plus" size={18} />
              New list
            </>
          }
          title="Make a new list"
          className="btn tonal sm read-add"
        >
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), newList())}>
                An empty list
                <span className="tiny muted">fill it from the library</span>
              </button>
              <button
                role="menuitem"
                className="btn ghost sm"
                onClick={() => (close(), startListPlan(), navigate(paths.buildList('describe')))}
              >
                Words, written with Claude
                <span className="tiny muted">a topic in, explained words out</span>
              </button>
            </>
          )}
        </Menu>
      </header>

      <label className="search">
        <Icon name="search" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setQuery('q', e.target.value);
          }}
          placeholder="好, hao or good"
          aria-label="Search characters, words and sets"
        />
      </label>

      {found ? (
        <>
          {found.sets.length > 0 && (
            <section className="block">
              <h2 className="block-title">Sets</h2>
              <div className="list">
                {found.sets.map((s) => (
                  <SetRow key={s.id} set={s} progress={progress(s)} />
                ))}
              </div>
            </section>
          )}
          <section className="block">
            <h2 className="block-title">{found.chars.length ? 'Characters' : 'No characters'}</h2>
            <div className="lib-tiles">
              {found.chars.map((c) => (
                <CharTile key={c.c} c={c} level={levelOf(charId(c.c))} onOpen={() => openItem(charId(c.c))} />
              ))}
            </div>
          </section>
          <section className="block">
            <div className="list">
              <Link className="lib-ref" to={paths.radicals(q.trim())}>
                <span className="hanzi lib-ref-mark" aria-hidden>
                  部
                </span>
                <span className="grow">
                  <b>Look for “{q.trim()}” among the radicals</b>
                </span>
                <Icon name="chevron" className="muted" />
              </Link>
            </div>
          </section>
          {found.texts.length > 0 && (
            <section className="block">
              <div className="block-head">
                <h2 className="block-title">In your texts</h2>
                <span className="spacer" />
                {found.texts.length > 5 && (
                  <Link className="btn quiet sm" to={paths.readSearch(q.trim())}>
                    All {found.texts.length}
                  </Link>
                )}
              </div>
              <div className="list">
                {found.texts.slice(0, 5).map((t) => (
                  <Link key={t.id} className="lib-ref" to={paths.text(t.id)}>
                    <span className="grow">
                      <b className="hanzi">{t.titleZh || t.title}</b>
                      <span className="small muted">{t.title}</span>
                    </span>
                    <Icon name="chevron" className="muted" />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {found.words.length > 0 && (
            <section className="block">
              <h2 className="block-title">Words</h2>
              <div className="lib-words">
                {found.words.map((w) => (
                  <WordRow key={w.w} w={w} level={know.level(w.w)} onOpen={() => openItem(wordId(w.w))} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="lib-cols">
            <div>
              {/* B2: what people come for first — where they are — then what to learn from. */}
              <section className="block">
                <h2 className="block-title">Your level</h2>
                <LevelCard set={levelSet} progress={progress(levelSet)} band={band} />
                <button className="btn quiet sm lib-other" aria-expanded={otherLevels} onClick={() => setOtherLevels((o) => !o)}>
                  Other levels
                  <Icon name="chevron" size={14} className="lib-other-chevron" />
                </button>
                {otherLevels && (
                  <div className="list">
                    {bands
                      .filter((b) => b.id !== levelSet.id)
                      .map((s) => (
                        <BandRow key={s.id} set={s} progress={progress(s)} now={false} />
                      ))}
                  </div>
                )}
              </section>

              {(ownWords || fromTexts.length > 0) && (
                <section className="block">
                  <h2 className="block-title">Words from your texts</h2>
                  {ownWords && (
                    <div className="list">
                      <SetRow set={ownWords} progress={progress(ownWords)} strip />
                    </div>
                  )}
                  {fromTexts.length > 0 && <FromTexts lists={fromTexts} />}
                </section>
              )}

              <section className="block">
                <div className="block-head">
                  <h2 className="block-title">Topics</h2>
                  <span className="spacer" />
                  {topics.length > 4 && (
                    <button className="btn quiet sm lib-more" onClick={() => setAllTopics((a) => !a)}>
                      {allTopics ? 'Fewer' : `All ${topics.length}`}
                    </button>
                  )}
                </div>
                <div className="list">
                  {shownTopics.map((s) => (
                    <SetRow key={s.id} set={s} progress={progress(s)} strip />
                  ))}
                </div>
              </section>
            </div>

            <div>
              <section className="block">
                <div className="block-head">
                  <h2 className="block-title">Your lists</h2>
                  <span className="spacer" />
                  {mine.length > 3 && (
                    <button className="btn quiet sm lib-more" onClick={() => setAllLists((a) => !a)}>
                      {allLists ? 'Fewer' : `All ${mine.length}`}
                    </button>
                  )}
                </div>
                {mine.length ? (
                  <div className="list">
                    {shownLists.map((s) => (
                      <SetRow key={s.id} set={s} progress={progress(s)} strip />
                    ))}
                  </div>
                ) : (
                  <p className="small muted">What you print and write out. None yet.</p>
                )}
                {waiting.length > 0 && <SheetsToMark sheets={waiting} />}
              </section>

              <section className="block">
                <h2 className="block-title">Look things up</h2>
                <div className="list">
                  <Link className="lib-ref" to={paths.radicals()}>
                    <span className="hanzi lib-ref-mark" aria-hidden>
                      部
                    </span>
                    <span className="grow">
                      <b>Radicals</b>
                      <span className="small muted">The 214 parts characters are built from</span>
                    </span>
                    <Icon name="chevron" className="muted" />
                  </Link>
                  <Link className="lib-ref" to={paths.family()}>
                    <span className="hanzi lib-ref-mark" aria-hidden>
                      族
                    </span>
                    <span className="grow">
                      <b>Families</b>
                      <span className="small muted">What one part grows into, drawn as a tree</span>
                    </span>
                    <Icon name="chevron" className="muted" />
                  </Link>
                  <Link className="lib-ref" to={paths.paper()}>
                    <span className="hanzi lib-ref-mark" aria-hidden>
                      纸
                    </span>
                    <span className="grow">
                      <b>Blank paper</b>
                      <span className="small muted">Practice grids, writing paper and dictation sheets to print</span>
                    </span>
                    <Icon name="chevron" className="muted" />
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** A set's items by level, as one bar of deepening greens: solid first, then known, then met. */
function Bar({ levels }: { levels: readonly number[] }) {
  return <LevelBar levels={levels} />;
}

function SetRow({ set, progress, strip }: { set: LibSet; progress: ReturnType<ReturnType<typeof useSetProgress>>; strip?: boolean }) {
  const sample = set.chars.length ? set.chars : set.words;
  return (
    <Link className="lib-set" to={paths.librarySet(set.id)}>
      <span className="grow">
        <b>{set.name}</b>
        {strip && sample.length > 0 && (
          <span className="hanzi lib-strip" aria-hidden>
            {sample.slice(0, 14).join(set.chars.length ? '' : '  ')}
          </span>
        )}
        <span className="small muted">
          {count(set)}
          {set.collection && set.group !== 'mine' ? ', printed as your list' : ''}
        </span>
        <Bar levels={progress.levels} />
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}

/**
 * The learner's own HSK level, as one card (B2): how much of it is met, in
 * characters and in words, its bar, and the two things to do with it —
 * look through it, or say what is known already.
 */
function LevelCard({ set, progress, band }: { set: LibSet; progress: ReturnType<ReturnType<typeof useSetProgress>>; band: number }) {
  return (
    <div className="lib-level">
      <div className="lib-level-head">
        <span className="lib-band-n">{set.name.replace('HSK ', '')}</span>
        <span className="grow">
          <b>{set.name}</b>
          <span className="small muted">
            {progress.chars} of {set.chars.length.toLocaleString('en')} characters · {progress.words} of {set.words.length.toLocaleString('en')} words met
          </span>
        </span>
      </div>
      <Bar levels={progress.levels} />
      <div className="row">
        <Link className="btn tonal sm" to={paths.librarySet(set.id)}>
          Browse
        </Link>
        <Link className="btn quiet sm" to={paths.sweep(band <= 4 ? band : undefined)}>
          Check what you know
        </Link>
      </div>
    </div>
  );
}

function BandRow({ set, progress, now }: { set: LibSet; progress: ReturnType<ReturnType<typeof useSetProgress>>; now: boolean }) {
  return (
    <Link className="lib-band" to={paths.librarySet(set.id)}>
      <span className="lib-band-n">{set.name.replace('HSK ', '')}</span>
      <span className="grow">
        <span className="lib-band-line">
          <span>
            {progress.chars} of {set.chars.length.toLocaleString('en')} characters · {progress.words} of {set.words.length.toLocaleString('en')} words
          </span>
          {now && <span className="lib-now">Your level</span>}
        </span>
        <Bar levels={progress.levels} />
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}

/**
 * Printed sheets waiting to be marked, under Your lists (B1): one line, "2
 * printed sheets to mark", unfolding to each with Mark it and Dismiss.
 * Marking a sheet is something done with a list, not the first thing in the
 * Library, so it no longer stands at its top.
 *
 * States: folded; unfolded; a sheet dismissed (its row goes; the line goes
 * with the last).
 */
function SheetsToMark({ sheets }: { sheets: PrintedSheet[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lib-sheets">
      <div className="lib-sheets-head">
        <span className="small">
          {sheets.length} printed sheet{sheets.length === 1 ? '' : 's'} to mark
        </span>
        <button className="btn quiet sm lib-sheets-fold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <ul className="list">
          {sheets.map((w) => (
            <li key={w.id} className="lib-sheet">
              <span className="grow">
                <b>{w.name}</b>
                <span className="small muted">Printed {new Date(w.printedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span>
              </span>
              <button className="btn quiet sm" onClick={() => discardSheet(w.id)}>
                Dismiss
              </button>
              <Link className="btn tonal sm" to={paths.gradeSheet(w.id)}>
                Mark it
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
