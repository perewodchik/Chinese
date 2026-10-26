import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { nextCollectionName } from '../../domain/collection';
import { charId, wordId } from '../../domain/ids';
import { pendingSheets } from '../../domain/memory';
import { collectedItems } from '../../domain/sweep';
import { HSK_BANDS } from '../../domain/text';
import { wordKnowledge } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { createCollection, startListPlan } from '../../store/commands';
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

/** How much of a set is done: characters learned and words known, as one share. */
export function useSetProgress() {
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const know = useMemo(() => wordKnowledge(lib, recall, collectedItems(collections)), [lib, recall, collections]);
  return (set: LibSet) => {
    const chars = set.chars.filter((c) => learned.has(charId(c))).length;
    const words = set.words.filter((w) => know.status(w) === 'known').length;
    return { chars, words, share: (chars + words) / Math.max(1, set.chars.length + set.words.length) };
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
  const learned = useStore((s) => s.learned);
  const band = useStore((s) => s.settings.hskBand);
  const waiting = pendingSheets(useStore((s) => s.sheets));
  const progress = useSetProgress();
  const [q, setQ] = useState('');
  const [allTopics, setAllTopics] = useState(false);
  const [allLists, setAllLists] = useState(false);

  const bands = useMemo(() => HSK_BANDS.map((b) => withList(bandSet(lib, b.id), collections)), [lib, collections]);
  const texts = useStore((s) => s.texts);
  // The words your texts brought that no band has come first: they are the ones you have met.
  const topics = useMemo(() => {
    const own = textWordsSet(lib, texts);
    return [...(own ? [withList(own, collections)] : []), ...topicSets(lib).map((t) => withList(t, collections))];
  }, [lib, collections, texts]);
  const mine = useMemo(() => ownLists(collections), [collections]);
  const fromTexts = useMemo(() => collections.filter((c) => FROM_TEXT.test(c.name)), [collections]);

  const found = useMemo(() => {
    const needle = flat(q.trim());
    if (!needle) return null;
    const hit = (...s: string[]) => s.some((x) => flat(x).includes(needle));
    return {
      chars: lib.characters.filter((c) => hit(c.c, c.py.join(' '), c.def)).slice(0, 32),
      words: lib.words.filter((w) => hit(w.w, w.py, w.d)).slice(0, 12),
      sets: [...mine, ...bands, ...topics].filter((s) => hit(s.name)),
    };
  }, [q, lib, mine, bands, topics]);

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
        <Menu label={<Icon name="plus" size={22} />} title="New list" className="icon-btn accent">
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
          onChange={(e) => setQ(e.target.value)}
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
                <CharTile key={c.c} c={c} learned={learned.has(charId(c.c))} onOpen={() => openItem(charId(c.c))} />
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
          {found.words.length > 0 && (
            <section className="block">
              <h2 className="block-title">Words</h2>
              <div className="lib-words">
                {found.words.map((w) => (
                  <WordRow key={w.w} w={w} onOpen={() => openItem(wordId(w.w))} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {waiting.map((w) => (
            <Link key={w.id} className="continue" to={paths.gradeSheet(w.id)}>
              <span className="grow">
                <span className="small muted">
                  Printed {new Date(w.printedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}, not marked yet
                </span>
                <b>{w.name}</b>
              </span>
              <span className="btn tonal sm">Mark it</span>
            </Link>
          ))}

          <div className="lib-cols">
            <div>
              <section className="block">
                <div className="block-head">
                  <h2 className="block-title">Your lists</h2>
                  <span className="spacer" />
                  {mine.length > 3 ? (
                    <button className="btn quiet sm lib-more" onClick={() => setAllLists((a) => !a)}>
                      {allLists ? 'Fewer' : `All ${mine.length}`}
                    </button>
                  ) : (
                    <button className="btn quiet sm" onClick={newList}>
                      New list
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
                  <p className="small muted">
                    A list is what you print and write out: start an empty one, or print any set below and it becomes
                    yours.
                  </p>
                )}
                {fromTexts.length > 0 && <FromTexts lists={fromTexts} />}
              </section>

              <section className="block">
                <h2 className="block-title">HSK</h2>
                <div className="list">
                  {bands.map((s) => (
                    <BandRow key={s.id} set={s} progress={progress(s)} now={`hsk-${band}` === s.id} />
                  ))}
                </div>
              </section>
            </div>

            <div>
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

function Bar({ share }: { share: number }) {
  return (
    <span className="lib-bar" aria-hidden>
      <i style={{ width: `${Math.round(share * 100)}%` }} />
    </span>
  );
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
        <Bar share={progress.share} />
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}

function BandRow({ set, progress, now }: { set: LibSet; progress: ReturnType<ReturnType<typeof useSetProgress>>; now: boolean }) {
  return (
    <Link className="lib-band" to={paths.librarySet(set.id)}>
      <span className="lib-band-n">{set.name.replace('HSK ', '')}</span>
      <span className="grow">
        <span className="lib-band-line">
          <span>
            {progress.chars} of {set.chars.length.toLocaleString('en')} characters
          </span>
          {now && <span className="lib-now">Your level</span>}
        </span>
        <Bar share={progress.share} />
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}
