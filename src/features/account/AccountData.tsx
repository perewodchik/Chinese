import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { accountStorage } from '../../api/account';
import { paths } from '../../navigation/paths';
import { resetWorkspace } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { DeleteAccount } from './DeleteAccount';
import './account.css';

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes < MB ? '<1' : Math.round(bytes / MB).toLocaleString('en'));

/**
 * /account/data (P12, P16): how much the account keeps, a copy to download,
 * deleting all the work, and deleting the account.
 */
export function AccountData() {
  useTitle('Your data');
  const toast = useToast();
  return (
    <section className="account-page">
      <header className="page-head">
        <Link className="back-link" to={paths.account()}>
          <Icon name="back" />
          Account
        </Link>
      </header>
      <h1>Your data</h1>

      <section className="block">
        <h2 className="block-title">Your work</h2>
        <StorageLine />
        <p className="small muted ac-copy-lede">
          Your texts, shelves, cards, lists and progress are kept in your account and saved as you go, the same on every
          device you sign in on. A copy to keep: all of that, the walk through Beijing, your conversations, tries and
          narrators, in one file. Not your keys, recordings or pictures.
        </p>
        <a className="btn tonal" href="/api/account/export" download>
          Download a copy
        </a>
      </section>

      <section className="block">
        <h2 className="block-title">Start again</h2>
        <p className="small muted ac-copy-lede">Everything you have done goes, on every device; the account stays, with nothing in it.</p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Delete everything in this account — collections, progress, reviews and texts — on every device? This cannot be undone.')) {
              resetWorkspace();
              toast('Everything in this account was deleted');
            }
          }}
        >
          Delete all my work
        </button>
      </section>

      <DeleteAccount />
    </section>
  );
}

/** How much the account keeps on the server, against its ceiling: a line, and a bar when there is a ceiling. */
function StorageLine() {
  const [use, setUse] = useState<{ usedBytes: number; limitBytes: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    accountStorage().then(
      (u) => live && setUse(u),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  const share = use?.limitBytes ? Math.min(1, use.usedBytes / use.limitBytes) : 0;
  return (
    <div className="ac-storage">
      <span className="small">
        {use === null
          ? ' '
          : use.limitBytes
            ? `It takes ${mb(use.usedBytes)} MB of the ${mb(use.limitBytes)} MB an account keeps here.`
            : `It takes ${mb(use.usedBytes)} MB here.`}
      </span>
      <span className="ac-storage-bar" aria-hidden data-hidden={use?.limitBytes ? undefined : ''}>
        <i style={{ width: `${share * 100}%` }} />
      </span>
    </div>
  );
}
