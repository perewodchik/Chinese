import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CatalogBook } from '../../../shared/catalog';
import { catalogBook, catalogBooks } from '../../api/catalog';
import type { TextSet } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { addCatalogBook } from '../../store/commands';
import { messageFor } from '../auth/messages';

const LEVEL = (n: number) => (n >= 7 ? 'HSK 7–9' : `HSK ${n}`);

/**
 * From the library: the books of the shared catalogue that are not on your
 * shelves yet, each with Add, which puts it on a shelf of its own and opens
 * it. Nothing is shown while they load, when there are none to offer, or
 * when the library cannot be reached: the shelves above are the page.
 *
 * States: loading (nothing); none to offer (nothing); some; one being added
 * (its button says so, the others wait); added (the book opens); refused
 * (said in its row).
 */
export function FromLibrary({ sets }: { sets: TextSet[] }) {
  const navigate = useNavigate();
  const [books, setBooks] = useState<CatalogBook[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let live = true;
    catalogBooks().then(
      (list) => live && setBooks(list),
      () => live && setBooks([]),
    );
    return () => {
      live = false;
    };
  }, []);

  const taken = useMemo(() => new Set(sets.flatMap((s) => (s.catalog ? [s.catalog.id] : []))), [sets]);
  const offered = (books ?? []).filter((b) => !taken.has(b.id) && !b.hidden);
  if (!offered.length) return null;

  async function add(book: CatalogBook) {
    setBusy(book.id);
    setError(null);
    try {
      const full = await catalogBook(book.id);
      const set = addCatalogBook(full);
      navigate(paths.shelf(set.id));
    } catch (err) {
      setError({ id: book.id, message: messageFor(err) });
      setBusy(null);
    }
  }

  return (
    <section className="block from-library">
      <h2 className="block-title">From the library</h2>
      <ul className="list">
        {offered.map((b) => (
          <li key={b.id} className="from-library-row">
            <span className="grow from-library-text">
              <b>
                {b.titleZh && <span className="hanzi">{b.titleZh} </span>}
                {b.title}
              </b>
              <span className="small muted">
                {LEVEL(b.level)} · {b.texts} {b.kind === 'story' ? (b.texts === 1 ? 'chapter' : 'chapters') : b.texts === 1 ? 'text' : 'texts'} · {b.chars.toLocaleString('en')} characters
              </span>
              <span className="small from-library-blurb">{b.blurb}</span>
              {error?.id === b.id && (
                <span className="small from-library-error" role="alert">
                  {error.message}
                </span>
              )}
            </span>
            <button className="btn tonal sm from-library-add" onClick={() => void add(b)} disabled={busy !== null}>
              {busy === b.id ? 'Adding…' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
