import { useMemo, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { DEFAULT_SCOPE, type Collection } from '../../domain/collection';
import { charId, isCharId, isWordId, idValue, type ItemId } from '../../domain/ids';
import { firstSense } from '../../domain/library';
import { defaultSheet } from '../../domain/sheet';
import { fromBook, hanziIn, isHanzi, shelfEntries, shelve, type GeneratedText, type TextSet } from '../../domain/text';
import { paths, type ShelfTab } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useOpenItem } from '../../navigation/itemDrawer';
import { renderCollection, renderTextSet } from '../../pdf/render';
import { downloadText, safeFileName } from '../../platform/files';
import { addTexts, deleteSet, discardPlan, renameSet, setShelfStudy } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { lastReading } from './lastRead';
import { useStanding, type Standing } from './Passage';
import { readerSheet } from './readerSheet';
import { partFill, PARTS } from './TextParts';
import { useStartSession } from './startSession';
import './shelves.css';

const hasHan = (s: string) => [...s].some(isHanzi);

/** Where to go to carry on: the text last open here, if it is still on the shelf; else the next unread one. */
function useContinue(): { text: GeneratedText; set: TextSet | null; to: string } | null {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  return useMemo(() => {
    const last = lastReading();
    const text = last ? texts.find((t) => t.id === last.textId) : undefined;
    if (text && last) {
      const set = sets.find((s) => s.id === text.setId) ?? null;
      return { text, set, to: set ? paths.reading(set.id, { page: last.page, version: last.version ?? undefined }) : paths.text(text.id) };
    }
    const shelf = shelve(texts, sets);
    for (const set of sets) {
      const entries = shelfEntries(shelf.bySet.get(set.id) ?? []);
      const at = entries.findIndex((e) => !e.main.read && !(e.easier?.read ?? false));
      if (at >= 0) return { text: entries[at]!.main, set, to: paths.reading(set.id, { page: at + 1 }) };
    }
    return null;
  }, [texts, sets]);
}

export { useContinue };

/**
 * Read: where you stopped, and every shelf.
 *
 * A shelf is a book being worked through, or a batch of texts Claude wrote
 * for you — each with its own words and characters, so nothing has to be
 * gathered into a collection to be learned. Texts come first in this app,
 * and this is the tab that finds them.
 */
/** Pinyin as typed on a phone: no tone marks, no ü's dots, no spaces. */
const bare = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'’]/g, '')
    .toLowerCase();

export function ReadPage() {
  useTitle('Read');
  const navigate = useNavigate();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const plan = useStore((s) => s.plan);
  const startSession = useStartSession();
  const shelf = useMemo(() => shelve(texts, sets), [texts, sets]);
  const go = useContinue();
  const [q, setQ] = useState('');

  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    // Pinyin matches with or without its tone marks and spaces: "lan" finds lán, which is hard to type on a phone.
    const sound = bare(needle);
    const sounds = (py: string) => Boolean(sound) && bare(py).includes(sound);
    const seen = new Set<string>();
    return [...texts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (t) =>
          t.titleZh.includes(needle) ||
          t.title.toLowerCase().includes(needle) ||
          t.lines.some((l) => l.zh.includes(needle) || l.en.toLowerCase().includes(needle) || sounds(l.py)) ||
          t.vocab.some((w) => w.w.includes(needle) || w.d.toLowerCase().includes(needle) || sounds(w.py)),
      )
      // A text with an easier version is one result, as it is one text on its shelf.
      .filter((t) => {
        const key = `${t.setId ?? ''}|${t.titleZh}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
  }, [q, texts]);

  function newShelf() {
    const name = prompt('What is the new shelf called? A book’s title, or a subject.');
    if (!name?.trim()) return;
    const { set } = addTexts([], { setId: null, name: name.trim() });
    navigate(paths.shelf(set.id));
  }

  // Newest first, a text with two versions once.
  const latest = useMemo(() => {
    const seen = new Set<string>();
    return [...texts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((t) => {
        const key = `${t.setId ?? ''}|${t.titleZh}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [texts]);

  return (
    <div className="read-page">
      <header className="page-head">
        <h1>Read</h1>
        <span className="spacer" />
        <Menu label={<Icon name="plus" size={22} />} title="Add" className="icon-btn accent">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(null))}>
                Write texts with Claude
                <span className="tiny muted">out of the characters you know</span>
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), newShelf())}>
                New shelf
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
          placeholder="Search texts and words"
          aria-label="Search texts and words"
        />
      </label>

      {found ? (
        <section className="block">
          <h2 className="block-title">
            {found.length ? `${found.length} text${found.length === 1 ? '' : 's'}` : 'Nothing found'}
          </h2>
          <div className="list">
            {found.map((t) => (
              <TextRow key={t.id} text={t} to={paths.text(t.id)} sub={sets.find((s) => s.id === t.setId)?.name} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {plan && (
            <div className="resume-row">
              <span className="hanzi" aria-hidden>
                写
              </span>
              <div className="grow">
                <b>{plan.name}</b>
                <span className="small muted">
                  {plan.specs.length} texts being written,{' '}
                  {plan.step === 'plan' ? 'still being planned' : plan.step === 'prompt' ? 'the prompt is ready' : 'waiting for Claude’s answer'}
                </span>
              </div>
              <button className="btn quiet sm" onClick={() => confirm('Throw this session away?') && discardPlan()}>
                Discard
              </button>
              <Link className="btn tonal sm" to={paths.session(plan.step)}>
                Continue
              </Link>
            </div>
          )}

          {go && (
            <Link className="continue" to={go.to}>
              <span className="grow">
                <span className="small muted">Where you stopped{go.set ? `, in ${go.set.name}` : ''}</span>
                <span className="hanzi continue-title">{go.text.titleZh || go.text.title}</span>
              </span>
              <span className="btn tonal sm">Open</span>
            </Link>
          )}

          <section className="block">
            <div className="block-head">
              <h2 className="block-title">Shelves</h2>
              <span className="spacer" />
              <button className="btn quiet sm" onClick={newShelf}>
                New shelf
              </button>
            </div>
            {sets.length ? (
              <div className="list">
                {sets.map((set) => {
                  const entries = shelfEntries(shelf.bySet.get(set.id) ?? []);
                  const learning = (set.study ?? []).length;
                  return (
                    <Link key={set.id} className="shelf-row" to={paths.shelf(set.id)}>
                      <span className="grow">
                        <span className={hasHan(set.name) ? 'hanzi shelf-name zh' : 'shelf-name'}>{set.name}</span>
                        <span className="small muted">
                          {entries.length ? `${entries.length} text${entries.length === 1 ? '' : 's'}` : 'No texts yet'}
                          {learning ? `, ${learning} word${learning === 1 ? '' : 's'} you are learning` : ''}
                        </span>
                        {entries.length > 0 && (
                          <span className="read-dots" aria-label={`${entries.filter((e) => e.main.read || e.easier?.read).length} read`}>
                            {entries.map((e) => (
                              <i key={e.main.id} data-read={e.main.read || e.easier?.read || undefined} />
                            ))}
                          </span>
                        )}
                      </span>
                      <Icon name="chevron" className="muted" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="empty compact">
                <span className="big">读</span>
                <p>
                  Nothing to read yet. Claude can write a few texts out of the characters you know, or add pages from a
                  book with /add-text.
                </p>
                <button className="btn primary" onClick={() => startSession(null)}>
                  Write the first texts
                </button>
              </div>
            )}
          </section>

          {shelf.loose.length > 0 && (
            <section className="block">
              <h2 className="block-title">Not on a shelf</h2>
              <div className="list">
                {shelf.loose.map((t) => (
                  <TextRow key={t.id} text={t} to={paths.text(t.id)} />
                ))}
              </div>
            </section>
          )}

          {latest.length > 1 && (
            <section className="block">
              <h2 className="block-title">Added lately</h2>
              <div className="list">
                {latest.map((t) => (
                  <TextRow key={t.id} text={t} to={paths.text(t.id)} sub={`${sets.find((s) => s.id === t.setId)?.name ?? 'Not on a shelf'}, ${ago(t.createdAt)}`} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TextRow({ text, to, sub }: { text: GeneratedText; to: string; sub?: string }) {
  return (
    <Link className="text-row" to={to}>
      <span className="grow">
        <span className="hanzi text-row-zh">{text.titleZh || text.title}</span>
        <span className="small muted">{sub ?? text.title}</span>
      </span>
      <Icon name="chevron" className="muted" />
    </Link>
  );
}

const ago = (at: number) => {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(at).toLocaleDateString();
};

const TABS: ShelfTab[] = ['texts', 'words', 'characters'];

/**
 * One shelf, at /read/:setId — its texts, the words it is teaching, and its
 * characters, each a tab.
 */
export function ShelfPage() {
  const { setId = '' } = useParams();
  const [query, setQuery] = useQuery();
  const tab = oneOf(query.get('tab'), TABS, 'texts');
  const navigate = useNavigate();
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const settings = useStore((s) => s.settings);
  const set = sets.find((s) => s.id === setId) ?? null;
  const list = useMemo(() => (set ? shelve(texts, sets).bySet.get(set.id) ?? [] : []), [texts, sets, set]);
  const entries = useMemo(() => shelfEntries(list), [list]);
  const study = useMemo(() => new Set<ItemId>(set?.study ?? []), [set?.study]);
  const standing = useStanding(study);
  const startSession = useStartSession();
  const pdf = usePdfExport();
  useTitle(set?.name ?? 'Shelf');

  const words = useMemo(() => shelfWords(list, set?.study ?? [], lib), [list, set?.study, lib]);
  const chars = useMemo(() => {
    const out: string[] = [];
    const add = (c: string) => isHanzi(c) && !out.includes(c) && out.push(c);
    for (const t of list) t.teach.forEach(add);
    for (const id of set?.study ?? []) hanziIn(idValue(id)).forEach(add);
    return out;
  }, [list, set?.study]);

  if (!set) return <Navigate to={paths.read()} replace />;

  const book = list.some(fromBook);
  const learningWords = words.filter((w) => standing(w.w) === 'learning');

  function rename() {
    const name = prompt('Rename this shelf', set!.name);
    if (name?.trim()) renameSet(set!.id, name.trim());
  }

  function remove() {
    if (!confirm(`Delete the shelf “${set!.name}” and its ${list.length} text${list.length === 1 ? '' : 's'}?`)) return;
    navigate(paths.read(), { replace: true, flushSync: true });
    deleteSet(set!.id);
  }

  function exportJson() {
    const out = list.map((t) => ({
      title: t.title,
      titleZh: t.titleZh,
      lines: t.lines,
      vocab: t.vocab.map((w) => ({ w: w.w, py: w.py, d: w.d, new: w.isNew ?? false })),
      questions: t.questions,
      grammar: t.grammar,
      note: t.note,
      teach: t.teach.map((c) => ({ c, ...(t.glosses[c] ?? {}) })),
    }));
    downloadText(safeFileName(set!.name, 'json'), JSON.stringify({ name: set!.name, texts: out }, null, 2), 'application/json');
  }

  function printChars() {
    const items = chars.map(charId).filter((id) => lib.byChar.has(idValue(id)));
    const sheet: Collection = {
      id: set!.id,
      name: set!.name,
      items,
      sheet: defaultSheet(),
      scope: { ...DEFAULT_SCOPE },
      createdAt: set!.createdAt,
      updatedAt: Date.now(),
    };
    void pdf.run(`chars-${set!.id}`, {
      title: `${set!.name}, characters`,
      render: () => renderCollection(lib, sheet, items, { footerNote: settings.footerNote, palette: settings.printPalette }),
    });
  }

  return (
    <div className="shelf-page">
      <header className="page-head">
        <Link className="back-link" to={paths.read()}>
          <Icon name="back" size={22} />
          Read
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="More" className="icon-btn">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), startSession(set.id, set.name))}>
                Write more texts for this shelf
              </button>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), rename())}>
                Rename
              </button>
              {list.length > 0 && (
                <button
                  role="menuitem"
                  className="btn ghost sm"
                  disabled={pdf.busy !== null}
                  onClick={() => {
                    close();
                    void pdf.run(set.id, {
                      title: set.name,
                      render: () =>
                        renderTextSet(lib, set.name, list, readerSheet(settings), {
                          footerNote: settings.footerNote,
                          practice: settings.readerPractice,
                        }),
                    });
                  }}
                >
                  Print the texts as a PDF
                </button>
              )}
              {list.length > 0 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), exportJson())}>
                  Save the texts as a file
                  <span className="tiny muted">to paste back into a writing session</span>
                </button>
              )}
              <button role="menuitem" className="btn ghost sm danger" onClick={() => (close(), remove())}>
                Delete this shelf
              </button>
            </>
          )}
        </Menu>
      </header>

      <h1 className={hasHan(set.name) ? 'hanzi sh-title zh' : 'sh-title'}>{set.name}</h1>
      <p className="small muted sh-sub">
        {book ? 'A book, ' : ''}
        {entries.length} text{entries.length === 1 ? '' : 's'} so far
      </p>

      <div className="seg sh-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setQuery('tab', t, 'texts')}>
            {t === 'texts' ? 'Texts' : t === 'words' ? 'Words' : 'Characters'}
            <span className="count">{t === 'texts' ? entries.length : t === 'words' ? words.length : chars.length}</span>
          </button>
        ))}
      </div>

      {tab === 'texts' && (
        <>
          {entries.length ? (
            <ol className="list shelf-texts">
              {entries.map((e, i) => {
                const fill = partFill(e.main, standing);
                return (
                  <li key={e.main.id}>
                    <Link className="shelf-text" to={paths.reading(set.id, { page: i + 1 })}>
                      <span className="shelf-text-n">{i + 1}</span>
                      <span className="grow">
                        <span className="hanzi shelf-text-zh">{e.main.titleZh || e.main.title}</span>
                        <span className="small muted">{e.main.title.replace(/\s*\(easier\)\s*$/, '')}</span>
                        <span className="shelf-text-meta">
                          <span className="part-ticks" aria-label="Parts done">
                            {PARTS.map((p) => (
                              <i key={p.id} title={p.label} style={{ '--fill': `${Math.round(fill[p.id] * 100)}%` } as CSSProperties} />
                            ))}
                          </span>
                          {e.easier && e.original && <span className="versions-tag hanzi">简 原</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="empty compact">
              <span className="big">空</span>
              <p>No texts on this shelf yet.</p>
            </div>
          )}
          <div className="page-foot">
            <button className="btn primary lg" onClick={() => startSession(set.id, set.name)}>
              Write more texts with Claude
            </button>
            <p className="tiny muted">From a book: send the page to Claude with /add-text and name this shelf.</p>
          </div>
        </>
      )}

      {tab === 'words' && <ShelfWords setId={set.id} words={words} standing={standing} study={study} learning={learningWords.length} />}

      {tab === 'characters' && (
        <>
          <ShelfChars chars={chars} />
          {chars.length > 0 && (
            <div className="page-foot">
              <button className="btn lg" disabled={pdf.busy !== null} onClick={printChars}>
                <Icon name="print" />
                Print a practice sheet
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ShelfWord {
  w: string;
  py: string;
  d: string;
  /** how many of the shelf's texts have it */
  texts: number;
}

/** Every word a shelf's texts list, and every word chosen to learn on it, once each. */
function shelfWords(list: GeneratedText[], study: ItemId[], lib: ReturnType<typeof useLibrary>): ShelfWord[] {
  const out = new Map<string, ShelfWord>();
  for (const t of list) {
    const seen = new Set<string>();
    for (const v of t.vocab) {
      if (seen.has(v.w)) continue;
      seen.add(v.w);
      const had = out.get(v.w);
      if (had) had.texts += 1;
      else out.set(v.w, { w: v.w, py: v.py, d: v.d, texts: 1 });
    }
  }
  for (const id of study) {
    const w = idValue(id);
    if (out.has(w)) continue;
    if (isWordId(id)) {
      const e = lib.byWord.get(w);
      out.set(w, { w, py: e?.py ?? '', d: e?.d ?? '', texts: list.filter((t) => t.lines.some((l) => l.zh.includes(w))).length });
    } else if (isCharId(id)) {
      const e = lib.byChar.get(w);
      out.set(w, { w, py: e?.py[0] ?? '', d: e ? firstSense(e.def) : '', texts: list.filter((t) => t.lines.some((l) => l.zh.includes(w))).length });
    }
  }
  return [...out.values()];
}

const FILTERS: Array<{ id: Standing; label: string }> = [
  { id: 'learning', label: 'Learning' },
  { id: 'new', label: 'New' },
  { id: 'known', label: 'Known' },
];

function ShelfWords({
  setId,
  words,
  standing,
  study,
  learning,
}: {
  setId: string;
  words: ShelfWord[];
  standing: (w: string) => Standing;
  study: ReadonlySet<ItemId>;
  learning: number;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [query, setQuery] = useQuery();
  const counts = { learning: 0, new: 0, known: 0 };
  for (const w of words) counts[standing(w.w)] += 1;
  const fallback: Standing = counts.learning ? 'learning' : counts.new ? 'new' : 'known';
  const filter = oneOf(query.get('words'), ['learning', 'new', 'known'] as const, fallback);
  const shown = words.filter((w) => standing(w.w) === filter);
  const itemOf = (w: string): ItemId => ([...w].length > 1 || lib.byWord.has(w) ? (`w${w}` as ItemId) : charId(w));

  if (!words.length) {
    return (
      <div className="empty compact">
        <span className="big">词</span>
        <p>No words yet. Tap a word in any text here and choose Learn this word.</p>
      </div>
    );
  }

  return (
    <>
      <div className="chips shelf-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setQuery('words', f.id, fallback)}>
            {f.label}
            <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="list shelf-words">
          {shown.map((w) => {
            const id = itemOf(w.w);
            const s = standing(w.w);
            return (
              <li key={w.w} className="shelf-word">
                <button className="shelf-word-main" onClick={() => openItem(id)}>
                  <span className="hanzi shelf-word-zh">{w.w}</span>
                  <span className="shelf-word-text">
                    <span className="shelf-word-py">{w.py}</span>
                    <span className="shelf-word-d">{w.d}</span>
                  </span>
                </button>
                <span className="tiny muted shelf-word-n">
                  {w.texts} text{w.texts === 1 ? '' : 's'}
                </span>
                {s === 'known' ? (
                  <span className="rd-add" data-state="known" title="You know this one">
                    <Icon name="check" />
                  </span>
                ) : (
                  <button
                    className="rd-add"
                    aria-pressed={study.has(id) || s === 'learning'}
                    title={study.has(id) ? 'Take it off this shelf’s list' : 'Learn this word'}
                    onClick={() => setShelfStudy(setId, [id], !study.has(id))}
                  >
                    <Icon name={s === 'learning' ? 'check' : 'plus'} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small muted">None here.</p>
      )}
      {learning > 0 && (
        <div className="page-foot">
          <Link className="btn tonal lg" to={paths.cardSession({ shelf: setId })}>
            {learning === 1 ? 'Practise it as a card' : `Practise these ${learning} as cards`}
          </Link>
        </div>
      )}
    </>
  );
}

function ShelfChars({ chars }: { chars: string[] }) {
  const openItem = useOpenItem();
  const learned = useStore((s) => s.learned);
  const lib = useLibrary();
  if (!chars.length) {
    return (
      <div className="empty compact">
        <span className="big">字</span>
        <p>The characters this shelf’s texts bring in will be here.</p>
      </div>
    );
  }
  return (
    <div className="char-grid">
      {chars.map((c) => {
        const e = lib.byChar.get(c);
        return (
          <button key={c} className="char-tile" data-learned={learned.has(charId(c)) || undefined} onClick={() => openItem(charId(c))}>
            <span className="hanzi">{c}</span>
            <span className="char-tile-py">{e?.py[0] ?? ''}</span>
          </button>
        );
      })}
    </div>
  );
}
