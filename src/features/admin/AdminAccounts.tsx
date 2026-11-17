import { useEffect, useState } from 'react';
import type { AdminAccount } from '../../../shared/admin';
import { adminAccounts } from '../../api/admin';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import { messageFor } from '../auth/messages';
import { AdminAccountRow } from './AdminAccountRow';
import { plural } from './format';

type Sort = 'seen' | 'joined' | 'room' | 'spent';
const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'seen', label: 'Last here' },
  { id: 'joined', label: 'Newest' },
  { id: 'room', label: 'Room' },
  { id: 'spent', label: 'Spent' },
];

/**
 * The accounts on the admin page (A4): searched by name, sorted, fifty at a
 * time, each from one query on the server however many there are. The page
 * opens on the overview's first page; anything else is asked for.
 *
 * States: the first page; searching (the list stays until the answer); none
 * found; more than a page (Earlier / Later); refused.
 */
export function AdminAccounts({
  first,
  total,
  selfId,
  confirm,
  onChanged,
}: {
  first: AdminAccount[];
  total: number;
  selfId: string;
  confirm: <T>(run: () => Promise<T>) => Promise<T>;
  onChanged: () => void;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('seen');
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState<{ accounts: AdminAccount[]; total: number; pages: number }>({ accounts: first, total, pages: Math.max(1, Math.ceil(total / 50)) });
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const asked = q.trim() !== '' || sort !== 'seen' || page > 0 || tick > 0;

  useEffect(() => {
    if (!asked) {
      setShown({ accounts: first, total, pages: Math.max(1, Math.ceil(total / 50)) });
      return;
    }
    let live = true;
    // A search waits for the typing to stop.
    const wait = setTimeout(() => {
      adminAccounts({ q: q.trim(), sort, page }).then(
        (r) => live && (setShown({ accounts: r.accounts, total: r.total, pages: r.pages }), setError(null)),
        (err: unknown) => live && setError(messageFor(err)),
      );
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [q, sort, page, tick, asked, first, total]);

  return (
    <section className="block">
      <h2 className="block-title">
        Accounts <span className="small muted">{plural(shown.total, 'account')}</span>
      </h2>
      <div className="admin-accounts-tools">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Find by name"
            aria-label="Find an account by name"
          />
        </label>
        <Seg
          value={sort}
          options={SORTS}
          onChange={(s) => {
            setSort(s);
            setPage(0);
          }}
          label="Sort accounts"
          size="sm"
        />
      </div>
      {error && <p className="small notice error">{error}</p>}
      {shown.accounts.length === 0 ? (
        <p className="small muted">No account by that name.</p>
      ) : (
        <ul className="list admin-list">
          {shown.accounts.map((a) => (
            <AdminAccountRow
              key={a.id}
              account={a}
              self={a.id === selfId}
              confirm={confirm}
              onChanged={() => {
                setTick((t) => t + 1);
                onChanged();
              }}
            />
          ))}
        </ul>
      )}
      {shown.pages > 1 && (
        <div className="row admin-pager">
          <button className="btn quiet sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Earlier
          </button>
          <span className="small muted">
            Page {page + 1} of {shown.pages}
          </span>
          <button className="btn quiet sm" disabled={page >= shown.pages - 1} onClick={() => setPage((p) => p + 1)}>
            Later
          </button>
        </div>
      )}
    </section>
  );
}
