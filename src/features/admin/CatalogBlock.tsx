import { useEffect, useState } from 'react';
import type { CatalogBook } from '../../../shared/catalog';
import { changeCatalogBook } from '../../api/catalog';
import { request } from '../../api/http';
import { HSK_BANDS } from '../../domain/text';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed } from '../auth/useFreshPassword';
import { day, plural } from './format';

/**
 * The shared library's books on the admin page (A9), in the order learners
 * see them: each with its version, its texts, when it was published and how
 * many took it and read it all; its band, a place up or down, and Hide / Show.
 * Publishing a book or a new version is done from its shelf in Read, where
 * the texts are.
 *
 * States: loading (nothing drawn); none published; the list, hidden ones said;
 * a change on its way (that book's controls held).
 */
export function CatalogBlock({ confirm }: { confirm: <T>(run: () => Promise<T>) => Promise<T> }) {
  const toast = useToast();
  const [books, setBooks] = useState<CatalogBook[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => request<CatalogBook[]>('GET', '/api/admin/catalog').then(setBooks, () => undefined);
  useEffect(() => {
    void load();
  }, []);

  async function change(b: CatalogBook, what: Parameters<typeof changeCatalogBook>[1], said: string | null) {
    setBusy(b.id);
    try {
      await confirm(() => changeCatalogBook(b.id, what));
      if (said) toast(said);
      await load();
    } catch (err) {
      if (!(err instanceof NotConfirmed)) toast(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  if (!books) return null;
  return (
    <section className="block">
      <h2 className="block-title">The library</h2>
      {books.length === 0 ? (
        <p className="small muted">No book published yet. A shelf in Read is published from its ⋯ menu.</p>
      ) : (
        <ul className="list admin-list">
          {books.map((b, i) => (
            <li key={b.id} className="admin-row admin-book-row">
              <span className="grow">
                <b>
                  {b.title}
                  {b.titleZh ? <span className="hanzi"> {b.titleZh}</span> : null}
                </b>
                <span className="small muted">
                  {b.hidden ? 'Hidden · ' : ''}
                  {plural(b.texts, 'text')} · version {b.version}, {day(b.publishedAt)} · {b.readers ? `${plural(b.readers.took, 'reader')}, ${b.readers.finished} finished` : ''}
                </span>
              </span>
              <span className="admin-book-actions">
                <select
                  className="admin-book-level"
                  aria-label={`The band “${b.title}” is for`}
                  value={b.level}
                  disabled={busy === b.id}
                  onChange={(e) => void change(b, { level: Number(e.target.value) }, null)}
                >
                  {HSK_BANDS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
                <button className="btn quiet sm admin-move admin-up" aria-label={`Move “${b.title}” up`} disabled={busy === b.id || i === 0} onClick={() => void change(b, { move: 'earlier' }, null)}>
                  <Icon name="down" />
                </button>
                <button className="btn quiet sm admin-move" aria-label={`Move “${b.title}” down`} disabled={busy === b.id || i === books.length - 1} onClick={() => void change(b, { move: 'later' }, null)}>
                  <Icon name="down" />
                </button>
                <button
                  className="btn quiet sm admin-book-hide"
                  disabled={busy === b.id}
                  onClick={() => void change(b, { hidden: !b.hidden }, b.hidden ? `“${b.title}” is in the library again` : `“${b.title}” is hidden from the library`)}
                >
                  {b.hidden ? 'Show' : 'Hide'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
