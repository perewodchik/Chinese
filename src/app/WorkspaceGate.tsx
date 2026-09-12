import { useEffect, useState, type ReactNode } from 'react';
import type { UserDto } from '../../shared/api';
import { isOffline, isSignedOut } from '../api/http';
import { workspaceApi } from '../api/workspace';
import type { Action } from '../store/actions';
import { replaceWorkspace } from '../store/commands';
import { claimLegacyWork, forgetLegacyWork } from '../store/legacy';
import { workspaceModel } from '../store/model';
import type { AppState } from '../store/state';
import { attachWorkspace, detachWorkspace } from '../store/store';
import { WorkspaceSync, type RemoteWorkspace } from '../store/sync/engine';
import { browserStorage, localOutbox } from '../store/sync/outbox';
import { followPageLifecycle } from '../store/sync/page';
import { Splash } from '../ui/Splash';
import { useToast } from '../ui/toast';

type Phase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; message: string };

/**
 * Opens the signed-in account's workspace for everything inside it, and closes
 * it again when the account goes — so nothing of one account is still in memory
 * when another signs in on the same tablet.
 */
export function WorkspaceGate({ user, children }: { user: UserDto; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const toast = useToast();

  useEffect(() => {
    let live = true;
    let close = () => undefined as void;
    setPhase({ kind: 'loading' });

    workspaceApi.load().then(
      (remote) => {
        if (!live) return;
        close = openWorkspace(user.id, remote, toast);
        setPhase({ kind: 'ready' });
      },
      (err: unknown) => {
        if (live) setPhase({ kind: 'failed', message: err instanceof Error ? err.message : String(err) });
      },
    );

    return () => {
      live = false;
      close();
    };
  }, [user.id, attempt, toast]);

  if (phase.kind === 'failed') {
    return (
      <Splash mark="断">
        <p>Could not open your saved work.</p>
        <p className="small">{phase.message}</p>
        <button className="btn primary" onClick={() => setAttempt((n) => n + 1)} style={{ marginTop: 10 }}>
          Try again
        </button>
      </Splash>
    );
  }
  if (phase.kind === 'loading') return <Splash mark="写">Opening your work…</Splash>;
  return <>{children}</>;
}

function openWorkspace(userId: string, remote: RemoteWorkspace, toast: (message: string) => void) {
  const outbox = localOutbox<Action>(userId, browserStorage());
  const sync = new WorkspaceSync<AppState, Action>(
    {
      model: workspaceModel,
      gateway: workspaceApi,
      outbox,
      classify: (err) => (isSignedOut(err) ? 'signed-out' : isOffline(err) ? 'offline' : 'failing'),
    },
    remote,
  );
  sync.open();
  attachWorkspace(sync);
  const stopFollowing = followPageLifecycle(sync, outbox);

  // A brand-new account opened in a browser that still has work from before
  // accounts: that work is almost certainly this person's, so it becomes the
  // account's. An account with work of its own is asked instead — see
  // LegacyWorkNotice.
  if (remote.revision === 0 && sync.getStatus().unsaved === 0) {
    const legacy = claimLegacyWork();
    if (legacy) {
      replaceWorkspace(legacy.state);
      toast('Moved the work saved in this browser into your account.');
      void sync.flush().then(() => {
        if (sync.getStatus().unsaved === 0) forgetLegacyWork();
      });
    }
  }

  return () => {
    stopFollowing();
    sync.close();
    detachWorkspace(sync);
  };
}
