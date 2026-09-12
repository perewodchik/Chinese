import { useEffect, useState } from 'react';
import { PER_PAGE_CHOICES } from '../../domain/sheet';
import { chooseFolder, folderSupported, forgetFolder, getFolderName } from '../../platform/files';
import { resetWorkspace, setSettings } from '../../store/commands';
import type { SyncStatus } from '../../store/sync/engine';
import { useStore, useSyncStatus } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';
import { useUser } from '../auth/session';
import { useSignOut } from '../auth/useSignOut';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function whereWorkIs(status: SyncStatus | null): string {
  if (!status) return '';
  switch (status.phase) {
    case 'saved':
      return `Everything is saved to your account${status.lastSavedAt ? ` — last at ${time(status.lastSavedAt)}` : ''}. Sign in on another device and it is all there.`;
    case 'pending':
    case 'saving':
      return 'Saving your latest changes to your account…';
    case 'offline':
      return `${status.unsaved} change${status.unsaved === 1 ? ' is' : 's are'} kept on this device until the server can be reached again.`;
    case 'failing':
      return `The last save did not go through (${status.message ?? 'no reason given'}). Trying again shortly.`;
    case 'signed-out':
      return 'Signed out. Sign in again and anything unsaved goes to the server.';
  }
}

export function SettingsPage() {
  useTitle('Settings');
  const user = useUser();
  const settings = useStore((s) => s.settings);
  const status = useSyncStatus();
  const toast = useToast();
  const { leave, leaving } = useSignOut();
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getFolderName().then((name) => {
      if (live) setFolder(name);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section style={{ maxWidth: 640, display: 'grid', gap: 16 }}>
      <h1>Settings</h1>

      <div className="card">
        <header>
          <h2>Account</h2>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={() => void leave()} disabled={leaving}>
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        </header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            Signed in as <b>{user.username}</b>, since {new Date(user.createdAt).toLocaleDateString()}.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {whereWorkIs(status)}
          </p>
          <div className="subtle-rule" style={{ margin: '2px 0' }} />
          <h3 className="field-title" style={{ marginTop: 0 }}>
            Change password
          </h3>
          <ChangePasswordForm />
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Where worksheets go</h2>
        </header>
        <div className="body">
          {folderSupported() ? (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                Pick a folder once and every PDF lands there automatically, named after the collection and
                dated, so you can find them again. The folder belongs to this browser, not to your account.
              </p>
              <div className="row">
                <button
                  className="btn"
                  onClick={async () => {
                    const h = await chooseFolder();
                    if (h) {
                      setFolder(h.name);
                      toast(`Worksheets will be saved to ${h.name}`);
                    }
                  }}
                >
                  {folder ? 'Choose a different folder' : 'Choose folder'}
                </button>
                {folder && (
                  <>
                    <span className="small">
                      Saving to <b>{folder}</b>
                    </span>
                    <button
                      className="btn ghost sm"
                      onClick={async () => {
                        await forgetFolder();
                        setFolder(null);
                        toast('Worksheets will download normally again');
                      }}
                    >
                      Forget
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              This browser cannot write to a folder directly, so worksheets will download the usual way. Chrome
              or Edge supports it.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Appearance &amp; footer</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            Theme
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ theme: e.target.value as 'system' | 'light' | 'dark' })}
            >
              <option value="system">Match my system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <span className="tiny muted">
              This is the app on screen. How a PDF looks is chosen per collection, under Design.
            </span>
          </label>
          <label className="field">
            Footer note on every sheet
            <input
              type="text"
              value={settings.footerNote}
              placeholder="your name, a class, anything"
              onChange={(e) => setSettings({ footerNote: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Writing texts</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <p className="small muted" style={{ margin: 0 }}>
            No API key: a session builds a prompt, you paste it into Claude yourself, and paste the answer back.
            Nothing is sent to Claude from this app.
          </p>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.readerPractice}
              onChange={(e) => setSettings({ readerPractice: e.target.checked })}
            />
            <span>
              Print practice sheets behind a text
              <span className="d">Every new character the text taught, as the same block a worksheet uses</span>
            </span>
          </label>
          <label className="field">
            Characters per practice page
            <select
              value={settings.practicePerPage}
              onChange={(e) => setSettings({ practicePerPage: Number(e.target.value) })}
            >
              {PER_PAGE_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
            <span className="tiny muted">
              Two gets the full sheet — origin, words, a sentence. Four is stroke order and squares.
            </span>
          </label>
          <label className="field">
            Credit the writer as
            <input
              type="text"
              value={settings.modelName}
              placeholder="Claude Opus"
              onChange={(e) => setSettings({ modelName: e.target.value })}
            />
            <span className="tiny muted">Stamped on each text you import.</span>
          </label>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Your saved work</h2>
        </header>
        <div className="body">
          <p className="small muted" style={{ marginTop: 0 }}>
            Collections, progress, review schedules, printed sheets and texts are kept in your account on the
            computer that runs this app, saved as you go. Whoever runs it can take a copy at any time with{' '}
            <code>npm run admin -- backup</code>.
          </p>
          <div className="row">
            <div className="spacer" />
            <button
              className="btn danger sm"
              onClick={() => {
                if (
                  confirm(
                    'Delete everything in this account — collections, progress, reviews and texts — on every device? This cannot be undone.',
                  )
                ) {
                  resetWorkspace();
                  toast('Everything in this account was deleted');
                }
              }}
            >
              Delete all my work
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
