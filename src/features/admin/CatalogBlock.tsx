import { useEffect, useState } from 'react';
import type { CatalogBook } from '../../../shared/catalog';
import { request } from '../../api/http';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed } from '../auth/useFreshPassword';
import { day, plural } from './format';

/**
 * The shared library's books on the admin page (A9): each with its version,
 * its texts and when it was published, and Hide / Show. Publishing a book or a
 * new version is done from its shelf in Read, where the texts are.
 *
 * States: loading (nothing drawn); none published; the list, hidden ones said.
 */
export function CatalogBlock({ confirm }: { confirm: <T>(run: () => Promise<T>) => Promise<T> }) {
  const toast = useToast();
  const [books, setBooks] = useState<CatalogBook[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => request<CatalogBook[]>('GET', '/api/admin/catalog').then(setBooks, () => undefined);
  useEffect(() => {
    void load();
  }, []);

  async function toggle(b: CatalogBook) {
    setBusy(b.id);
    try {
      await confirm(() => request<void>('PATCH', `/api/admin/catalog/${encodeURIComponent(b.id)}`, { body: { hidden: !b.hidden } }));
      toast(b.hidden ? `“${b.title}” is in the library again` : `“${b.title}” is hidden from the library`);
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
          {books.map((b) => (
            <li key={b.id} className="admin-row admin-invite-row">
              <span className="grow">
                <b>
                  {b.title}
                  {b.titleZh ? <span className="hanzi"> {b.titleZh}</span> : null}
                </b>
                <span className="small muted">
                  {b.hidden ? 'Hidden · ' : ''}HSK {b.level} · {plural(b.texts, 'text')} · version {b.version}, {day(b.publishedAt)}
                </span>
              </span>
              <button className="btn quiet sm" disabled={busy === b.id} onClick={() => void toggle(b)}>
                {b.hidden ? 'Show' : 'Hide'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
