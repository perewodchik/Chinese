import { useInstall } from '../../platform/install';
import { useToast } from '../../ui/toast';

/**
 * The app on the home screen: one tap where the browser can install it, the
 * two steps where it cannot (Safari on an iPhone or iPad), and a line saying
 * so once it is installed. On a desktop browser that offers neither, nothing.
 */
export function InstallCard() {
  const state = useInstall();
  const toast = useToast();
  if (state.kind === 'unavailable') return null;
  return (
    <div className="card install-card">
      <header>
        <img src="/icons/icon-192.png" alt="" width={36} height={36} />
        <h2>The app on your home screen</h2>
      </header>
      <div className="body">
        {state.kind === 'installed' && <p className="small muted">Installed — you are using it now.</p>}
        {state.kind === 'prompt' && (
          <div className="row">
            <p className="small muted" style={{ margin: 0, flex: 1 }}>
              Opens full screen, without the browser’s bars, from its own icon.
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                if (await state.install()) toast('Installed. Open it from your home screen.');
              }}
            >
              Install
            </button>
          </div>
        )}
        {state.kind === 'apple' && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Opens full screen, without Safari’s bars, from its own icon. Two taps in Safari:
            </p>
            <ol className="install-steps small">
              <li>
                Tap <b>Share</b> <span aria-hidden>(the square with an arrow)</span>.
              </li>
              <li>
                Choose <b>Add to Home Screen</b>, then <b>Add</b>.
              </li>
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
