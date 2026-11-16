import type { BrokenKey } from '../../../shared/keys';

/**
 * A key the service turned away (K18), said once where the key is kept
 * rather than at every try: what the service said, when, and the two ways
 * on — save the key again (the form below), or Try again.
 */
export function BrokenKeyLine({ broken, busy, onRetry }: { broken: BrokenKey; busy: boolean; onRetry: () => void }) {
  const when = new Date(broken.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <div className="row broken-key">
      <p className="small grow" style={{ margin: 0 }}>
        <b>{broken.reason === 'balance' ? 'Its balance ran out' : 'It stopped being accepted'}</b> on {when}: {broken.message} Nothing is sent with it
        until you save it again or try once more.
      </p>
      <button className="btn quiet sm" type="button" disabled={busy} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
