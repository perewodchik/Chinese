import { useState } from 'react';
import { mergeIntoWorkspace } from '../../store/commands';
import { forgetLegacyWork, readLegacyWork, type LegacyWork } from '../../store/legacy';
import { flushWorkspace, getSyncStatus } from '../../store/store';
import { useToast } from '../../ui/toast';

const counted = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

function describe(work: LegacyWork): string {
  const parts: string[] = [];
  if (work.collections) parts.push(counted(work.collections, 'collection'));
  if (work.texts) parts.push(counted(work.texts, 'text'));
  if (work.reviewed) parts.push(`review history for ${counted(work.reviewed, 'character')}`);
  return parts.length ? parts.join(', ') : 'some saved work';
}

/**
 * Work this browser kept before there were accounts, offered to an account that
 * already has work of its own.
 *
 * A brand-new account simply takes it (see WorkspaceGate). An account with
 * collections of its own is asked, because putting two sets of work together is
 * something to decide rather than something to discover afterwards.
 */
export function LegacyWorkNotice() {
  const toast = useToast();
  const [work, setWork] = useState(() => readLegacyWork());
  const [busy, setBusy] = useState(false);

  if (!work) return null;

  async function bringIn(found: LegacyWork) {
    setBusy(true);
    mergeIntoWorkspace(found.state);
    setWork(null);
    await flushWorkspace();
    // The browser's copy goes only once the server has the account's.
    if (getSyncStatus()?.unsaved === 0) {
      forgetLegacyWork();
      toast('Added the work from this browser to your account.');
    } else {
      toast('Added to your account on this device. It goes to the server as soon as the server can be reached.');
    }
  }

  function remove() {
    if (!confirm('Remove the work this browser kept from before accounts? Your account is not touched.')) return;
    forgetLegacyWork();
    setWork(null);
  }

  return (
    <div className="notice legacy-notice" role="region" aria-label="Work from before accounts">
      <b>This browser still has work from before there were accounts</b> — {describe(work)}. It is not in
      your account yet.
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm primary" disabled={busy} onClick={() => void bringIn(work)}>
          Add it to my account
        </button>
        <button className="btn sm ghost" disabled={busy} onClick={remove}>
          Remove it from this browser
        </button>
      </div>
    </div>
  );
}
