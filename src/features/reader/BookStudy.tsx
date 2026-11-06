import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { charId, type ItemId } from '../../domain/ids';
import type { Level } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useOpenItem } from '../../navigation/itemDrawer';
import { setShelfStudy } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { LevelBar } from '../../ui/LevelMark';
import { LevelQuick } from '../../ui/LevelPicker';
import { useLevelOf } from '../shared/levels';
import { useLibrary } from '../shared/library';
import { useWordLevel } from './Passage';

/** A chapter as the book page groups by it: the words and characters it brings in first. */
export interface Chapter {
  /** its place among the book's entries; -1 for what was added by hand and comes in none */
  at: number;
  /** 一, 二… or 1, 2…, or nothing for the page before the chapters */
  badge: ReactNode;
  title: string;
  state: 'done' | 'now' | 'new' | 'open';
}

export interface BookWord {
  w: string;
  py: string;
  d: string;
  /** the chapter it first comes in, -1 for none */
  at: number;
}

const counts4 = (levels: Level[]) => {
  const out = [0, 0, 0, 0];
  for (const l of levels) out[l] += 1;
  return out;
};

/**
 * One chapter's group: its number, its name, how many there are and how many
 * not known, a short bar of their levels, and, open, what is in it. Closed it
 * is a line, so a book of a hundred words reads as seven lines.
 */
function Group({ chapter, open, onToggle, summary, levels, children }: { chapter: Chapter; open: boolean; onToggle: () => void; summary: string; levels: number[]; children: ReactNode }) {
  return (
    <section className="bk-group" data-open={open || undefined}>
      <button className="bk-group-head" aria-expanded={open} onClick={onToggle}>
        <span className="chapter-badge" data-state={chapter.state} aria-hidden>
          {chapter.state === 'done' ? <Icon name="check" size={16} /> : chapter.badge}
        </span>
        <span className="bk-group-what">
          <span className={/\p{Script=Han}/u.test(chapter.title) ? 'hanzi' : undefined}>{chapter.title}</span>
          <small>{chapter.state === 'now' ? `Reading now, ${summary}` : summary}</small>
        </span>
        <span className="bk-group-bar" aria-hidden>
          <LevelBar levels={levels} />
        </span>
        <Icon name="chevron" size={18} className="bk-group-chev" />
      </button>
      {open && <div className="bk-group-body">{children}</div>}
    </section>
  );
}

/** Which groups are open: the chapter being read at first, and whatever the learner opens. */
function useOpenGroups(chapters: Chapter[]) {
  const [open, setOpen] = useState<Set<number>>(() => {
    const now = chapters.find((c) => c.state === 'now') ?? chapters.find((c) => c.state !== 'done') ?? chapters[0];
    return new Set(now ? [now.at] : []);
  });
  const toggle = (at: number) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(at)) next.delete(at);
      else next.add(at);
      return next;
    });
  return [open, toggle] as const;
}

/** The summary over a list: how many, and a bar of their levels with the counts under it. */
function Summary({ lead, levels, labels }: { lead: ReactNode; levels: number[]; labels: string }) {
  return (
    <div className="bk-sum">
      <p>{lead}</p>
      <span className="bk-sum-bar" aria-hidden>
        <LevelBar levels={levels} />
      </span>
      <p className="small muted">{labels}</p>
    </div>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

type WordFilter = 'all' | 'none' | 'list';

/**
 * A book's words, by the chapter each first comes in: the chapter being read
 * open, the rest a line each. A filter for the ones not known or on the list,
 * a search, and in each chapter one tap to put its unknown words on the list.
 */
export function BookWords({ setId, words, chapters, study }: { setId: string; words: BookWord[]; chapters: Chapter[]; study: ReadonlySet<ItemId> }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const levelOfWord = useWordLevel();
  const [query, setQuery] = useQuery();
  const filter = oneOf(query.get('words'), ['all', 'none', 'list'] as const, 'all') as WordFilter;
  const [search, setSearch] = useState<string | null>(null);
  const [open, toggle] = useOpenGroups(chapters);
  const itemOf = (w: string): ItemId => ([...w].length > 1 || lib.byWord.has(w) ? (`w${w}` as ItemId) : charId(w));

  const levels = counts4(words.map((w) => levelOfWord(w.w)));
  const notKnown = levels[0]!;
  const onList = words.filter((w) => study.has(itemOf(w.w))).length;

  // A row shown under a filter stays until the filter changes, so setting its
  // level or list from the row does not make it, and everything under it, jump.
  const kept = useRef<{ filter: WordFilter; words: Set<string> }>({ filter, words: new Set() });
  if (kept.current.filter !== filter) kept.current = { filter, words: new Set() };
  const q = search?.trim().toLowerCase() ?? '';
  const passes = (w: BookWord) =>
    (filter === 'all' || kept.current.words.has(w.w) || (filter === 'none' ? levelOfWord(w.w) === 0 : study.has(itemOf(w.w)))) &&
    (!q || w.w.includes(q) || w.py.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')) || w.d.toLowerCase().includes(q));
  const shown = words.filter(passes);
  for (const w of shown) kept.current.words.add(w.w);

  if (!words.length) {
    return (
      <div className="empty compact">
        <span className="big">词</span>
        <p>No words yet. Tap a word in any text here and choose Learn this word.</p>
      </div>
    );
  }

  const groups = chapters.map((c) => ({ c, all: words.filter((w) => w.at === c.at), list: shown.filter((w) => w.at === c.at) })).filter((g) => g.all.length);

  return (
    <>
      <Summary
        lead={
          <>
            <b>{words.length}</b> words in this book, <b className="bk-sum-list">{onList}</b> on your list
          </>
        }
        levels={levels}
        labels={`${notKnown} not known, ${levels[1]} met, ${levels[2]! + levels[3]!} known`}
      />
      <div className="chips shelf-filters bk-filters">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setQuery('words', 'all', 'all')}>
          All <span className="count">{words.length}</span>
        </button>
        <button className="chip" aria-pressed={filter === 'none'} onClick={() => setQuery('words', 'none', 'all')}>
          Not known <span className="count">{notKnown}</span>
        </button>
        <button className="chip" aria-pressed={filter === 'list'} onClick={() => setQuery('words', 'list', 'all')}>
          On my list <span className="count">{onList}</span>
        </button>
        <button className="chip bk-search-chip" aria-pressed={search !== null} aria-label="Search the words" onClick={() => setSearch((s) => (s === null ? '' : null))}>
          <Icon name="search" size={16} />
        </button>
      </div>
      {search !== null && (
        <label className="search bk-search">
          <Icon name="search" />
          <input type="search" autoFocus placeholder="A word, its pinyin or its meaning" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      )}
      <div className="bk-groups">
        {groups.map(({ c, all, list }) => {
          const unknown = all.filter((w) => levelOfWord(w.w) === 0);
          const toAdd = unknown.map((w) => itemOf(w.w)).filter((id) => !study.has(id));
          // Searching or filtering opens every chapter with something to show.
          const isOpen = (q || filter !== 'all' ? list.length > 0 : false) || open.has(c.at);
          return (
            <Group
              key={c.at}
              chapter={c}
              open={isOpen}
              onToggle={() => toggle(c.at)}
              summary={`${plural(all.length, 'word')}, ${unknown.length} not known`}
              levels={counts4(all.map((w) => levelOfWord(w.w)))}
            >
              {toAdd.length > 0 && (
                <div className="bk-group-act">
                  <span className="small muted">In the order they come</span>
                  <button className="btn sm" onClick={() => setShelfStudy(setId, toAdd, true)}>
                    <Icon name="plus" size={16} /> {toAdd.length === 1 ? 'The one not known' : `The ${toAdd.length} not known`} to my list
                  </button>
                </div>
              )}
              {list.length ? (
                <ul className="list shelf-words">
                  {list.map((w) => {
                    const id = itemOf(w.w);
                    return (
                      <li key={w.w} className="shelf-word">
                        <button className="shelf-word-main" onClick={() => openItem(id)}>
                          <span className="hanzi shelf-word-zh">{w.w}</span>
                          <span className="shelf-word-text">
                            <span className="shelf-word-py">{w.py}</span>
                            <span className="shelf-word-d">{w.d}</span>
                          </span>
                        </button>
                        <LevelQuick id={id} level={levelOfWord(w.w)} />
                        {/* On the book's list or not: a choice to learn it, which says nothing of how well it is known. */}
                        <button
                          className="rd-add"
                          aria-pressed={study.has(id)}
                          title={study.has(id) ? 'On this book’s list: tap to take it off' : 'Add it to this book’s list to learn'}
                          onClick={() => setShelfStudy(setId, [id], !study.has(id))}
                        >
                          <Icon name={study.has(id) ? 'check' : 'plus'} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="small muted bk-none">None here under this filter.</p>
              )}
            </Group>
          );
        })}
      </div>
      {onList > 0 && (
        <div className="page-foot bk-foot">
          <Link className="btn primary lg" to={paths.cardSession({ shelf: setId })}>
            {onList === 1 ? 'Practise it as a card' : `Practise the ${onList} as cards`}
          </Link>
        </div>
      )}
    </>
  );
}

type CharFilter = 'all' | 'none' | 'met' | 'known';

/** A book's characters, by the chapter each first comes in, as tiles shaded by how well they are known. */
export function BookChars({ chars, chapters, foot }: { chars: Array<{ c: string; at: number }>; chapters: Chapter[]; foot?: ReactNode }) {
  const openItem = useOpenItem();
  const levelOf = useLevelOf();
  const lib = useLibrary();
  const [query, setQuery] = useQuery();
  const filter = oneOf(query.get('chars'), ['all', 'none', 'met', 'known'] as const, 'all') as CharFilter;
  const [open, toggle] = useOpenGroups(chapters);
  const levels = useMemo(() => counts4(chars.map((x) => levelOf(charId(x.c)))), [chars, levelOf]);

  if (!chars.length) {
    return (
      <div className="empty compact">
        <span className="big">字</span>
        <p>The characters this book’s texts bring in will be here.</p>
      </div>
    );
  }
  const passes = (c: string) => {
    const l = levelOf(charId(c));
    return filter === 'all' || (filter === 'none' ? l === 0 : filter === 'met' ? l === 1 : l >= 2);
  };
  const groups = chapters.map((ch) => ({ ch, all: chars.filter((x) => x.at === ch.at) })).filter((g) => g.all.length);

  return (
    <>
      <Summary
        lead={
          <>
            <b>{chars.length}</b> characters, <b>{levels[0]}</b> not known yet
          </>
        }
        levels={levels}
        labels={`${levels[0]} not known, ${levels[1]} met, ${levels[2]} known, ${levels[3]} solid`}
      />
      <div className="chips shelf-filters bk-filters">
        {(
          [
            ['all', 'All', chars.length],
            ['none', 'Not known', levels[0]],
            ['met', 'Met', levels[1]],
            ['known', 'Known', levels[2]! + levels[3]!],
          ] as const
        ).map(([id, label, n]) => (
          <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setQuery('chars', id, 'all')}>
            {label} <span className="count">{n}</span>
          </button>
        ))}
      </div>
      <div className="bk-groups">
        {groups.map(({ ch, all }) => {
          const list = all.filter((x) => passes(x.c));
          const unknown = all.filter((x) => levelOf(charId(x.c)) === 0).length;
          return (
            <Group
              key={ch.at}
              chapter={ch}
              open={(filter !== 'all' ? list.length > 0 : false) || open.has(ch.at)}
              onToggle={() => toggle(ch.at)}
              summary={`${plural(all.length, 'character')}, ${unknown} not known`}
              levels={counts4(all.map((x) => levelOf(charId(x.c))))}
            >
              {list.length ? (
                <div className="char-grid">
                  {list.map(({ c }) => (
                    <button key={c} className="char-tile" data-level={levelOf(charId(c))} onClick={() => openItem(charId(c))}>
                      <span className="hanzi">{c}</span>
                      <span className="char-tile-py">{lib.byChar.get(c)?.py[0] ?? ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="small muted bk-none">None here under this filter.</p>
              )}
            </Group>
          );
        })}
      </div>
      {foot}
    </>
  );
}
