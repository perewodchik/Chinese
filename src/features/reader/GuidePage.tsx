import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { bookTitle, chapterHead, isFrontMatter } from '../../domain/bookshelf';
import { canRelive, guideOf, readInBook, type GuideItem, type GuidePerson } from '../../domain/companion';
import { shelfEntries, shelve } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { CompanionFace } from './CompanionFace';
import './relive.css';

type Tab = 'people' | 'places' | 'things';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'people', label: 'People' },
  { id: 'places', label: 'Places' },
  { id: 'things', label: 'Things' },
];

/**
 * /read/guide/:setId — who is who, where, and what, in a book with a
 * companion: out of the chapters already read only, so it never tells the
 * story ahead of the book (domain/companion `guideOf`). Every name opens its
 * word; every line said and every place opens the chapter at that moment in
 * Relive. Like Relive, it counts for nothing.
 *
 * States: not a companion book; nothing read yet; a tab with nothing in it
 * yet; the lists.
 */
export function GuidePage() {
  const { setId = '' } = useParams();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const set = sets.find((s) => s.id === setId) ?? null;
  const title = set ? bookTitle(set.name) : '';
  useTitle(title ? `${title} · guide` : 'Guide');
  const [tab, setTab] = useState<Tab>('people');

  const guide = useMemo(() => {
    if (!set) return null;
    const entries = shelfEntries(shelve(texts, sets).bySet.get(set.id) ?? []);
    const read = readInBook(texts, sets, title);
    let n = 0;
    const chapters = entries.flatMap((e, i) => {
      if (isFrontMatter(e.main)) return [];
      n += 1;
      return canRelive(e, read) ? [{ n, page: i + 1, text: e.easier ?? e.main }] : [];
    });
    return { result: guideOf(title, chapters), read: chapters.length, heads: new Map(chapters.map((c) => [c.n, chapterHead(c.text, c.n)])) };
  }, [set, texts, sets, title]);

  if (!set || !guide?.result) {
    return (
      <div className="empty">
        <span className="big">读</span>
        <p>This book has no guide.</p>
        <Link className="btn" to={set ? paths.reading(set.id) : paths.read()}>
          Back to the book
        </Link>
      </div>
    );
  }
  const { result } = guide;
  const kicker = (n: number) => guide.heads.get(n)?.kicker ?? `Chapter ${n}`;

  return (
    <div className="gd">
      <Link className="back-link" to={paths.reading(set.id)}>
        <Icon name="back" />
        <span className="hanzi">{title}</span>
      </Link>
      <header className="page-head">
        <h1>Guide</h1>
      </header>
      <p className="gd-lede">{guide.read ? `Who, where and what, from the ${guide.read === 1 ? 'chapter' : `${guide.read} chapters`} you have read. More comes as you read on.` : 'Read the first chapter, and the people, places and things in it come here.'}</p>
      <Seg value={tab} options={TABS} onChange={setTab} label="Show" />
      {tab === 'people' && (result.people.length ? <People people={result.people} setId={set.id} kicker={kicker} /> : <Nothing />)}
      {tab === 'places' && (result.places.length ? <Items items={result.places} setId={set.id} kicker={kicker} journey /> : <Nothing />)}
      {tab === 'things' && (result.things.length ? <Items items={result.things} setId={set.id} kicker={kicker} /> : <Nothing />)}
    </div>
  );
}

function Nothing() {
  return <p className="gd-none">Nothing here yet. It comes as you read on.</p>;
}

/** A Chinese name that opens its word. */
function Name({ zh, big = false }: { zh: string; big?: boolean }) {
  const lib = useLibrary();
  const open = useOpenItem();
  return (
    <button type="button" className={`gd-name hanzi${big ? ' big' : ''}`} onClick={() => open(itemForToken(lib, zh))}>
      {zh}
    </button>
  );
}

function People({ people, setId, kicker }: { people: GuidePerson[]; setId: string; kicker: (n: number) => string }) {
  return (
    <ul className="list gd-list">
      {people.map((p) => (
        <li key={p.member.id} className="gd-person">
          <CompanionFace member={p.member} name={p.names[0] ?? null} size={52} />
          <div className="gd-body">
            {/* A hero can have four names: they wrap, and that is meant. */}
            <div className="gd-names" data-wraps>
              {p.names.map((n, i) => (
                <Name key={n} zh={n} big={i === 0} />
              ))}
            </div>
            <p className="gd-what">
              {p.member.en}. First in {kicker(p.first.n)}.
            </p>
            {p.lines.length > 0 && (
              <details className="gd-lines">
                <summary>
                  {p.lines.length === 1 ? 'What they say' : `What they say, ${p.lines.length} times`}
                  <Icon name="chevron" size={16} />
                </summary>
                <ol>
                  {p.lines.map((l, i) => (
                    <li key={i}>
                      <Link to={paths.relive(setId, l.page, l.line)} className="gd-line">
                        <span className="gd-at">{kicker(l.n)}</span>
                        <span className="hanzi">{l.zh}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Items({ items, setId, kicker, journey = false }: { items: GuideItem[]; setId: string; kicker: (n: number) => string; journey?: boolean }) {
  const lib = useLibrary();
  return (
    <ol className={`list gd-list${journey ? ' gd-way' : ''}`}>
      {items.map((it) => {
        // A reading the chapters do not give comes from the word list, never from guessing at characters.
        const py = it.py || lib.byWord.get(it.name)?.py || '';
        return (
          <li key={it.entry.id} className="gd-item">
            {journey && <span className="gd-stop" aria-hidden />}
            <div className="gd-body">
              <div className="gd-names">
                <Name zh={it.name} big />
                <span className="gd-py">{py}</span>
              </div>
              {it.d && <p className="gd-what">{it.d}</p>}
            </div>
            <Link className="btn quiet sm" to={paths.relive(setId, it.first.page, it.first.line)} aria-label={`See ${it.name} in ${kicker(it.first.n)}`}>
              {kicker(it.first.n)}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
