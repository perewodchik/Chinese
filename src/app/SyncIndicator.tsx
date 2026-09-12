import type { SyncPhase } from '../store/sync/engine';
import { useSyncStatus } from '../store/store';

const LABEL: Record<SyncPhase, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  saving: 'Saving…',
  offline: 'Offline',
  failing: 'Not saved',
  'signed-out': 'Signed out',
};

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Whether what is on screen has reached the server. Quiet when it has; plain
 * about it when it has not, because "offline" on a tablet is the difference
 * between work that is safe and work that is only on the tablet.
 */
export function SyncIndicator() {
  const status = useSyncStatus();
  if (!status) return null;

  const { phase, unsaved, lastSavedAt, message } = status;
  const title =
    message ??
    (phase === 'saved'
      ? lastSavedAt
        ? `Everything is on the server — last saved at ${time(lastSavedAt)}`
        : 'Everything is on the server'
      : `${unsaved} change${unsaved === 1 ? '' : 's'} on the way to the server`);

  return (
    <span className="sync" data-phase={phase} title={title}>
      <i aria-hidden />
      <span className="sync-label">{LABEL[phase]}</span>
    </span>
  );
}
