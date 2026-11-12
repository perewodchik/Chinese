import { useEffect, useState, type ReactNode } from 'react';
import { HSK_BANDS } from '../../domain/text';
import { chooseFolder, folderSupported, forgetFolder, getFolderName } from '../../platform/files';
import { resetWorkspace, setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { PalettePicker } from '../../ui/PalettePicker';
import { useToast } from '../../ui/toast';
import { InstallCard } from './InstallCard';
import { LearningSettings } from './LearningSettings';
import { PronunciationKey } from './PronunciationKey';

/** Slow enough to follow, and not so slow that it stops being speech. */
const GUIDED_PACES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.8, label: 'A little slower' },
  { value: 0.7, label: 'Slower' },
  { value: 0.65, label: 'Slower still' },
  { value: 0.55, label: 'Very slow' },
  { value: 0.45, label: 'A word at a time' },
];

const SILENCE_STOPS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'Never — I will stop it myself' },
  { value: 2, label: '2 seconds of quiet' },
  { value: 3, label: '3 seconds of quiet' },
  { value: 5, label: '5 seconds of quiet' },
  { value: 8, label: '8 seconds of quiet' },
];

/** A section's settings: the cards it had on the one long page, in the same words. */
function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title && (
        <header>
          <h2>{title}</h2>
        </header>
      )}
      <div className="body settings-body">{children}</div>
    </div>
  );
}

function Learning() {
  const settings = useStore((s) => s.settings);
  return (
    <>
      <Card title="Your level">
        <label className="field">
          Your level
          <select value={settings.targetHsk} onChange={(e) => setSettings({ targetHsk: Number(e.target.value) })}>
            {HSK_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <span className="tiny muted">
            Words above it are marked in a passage — green one band up, yellow two, red three, black four or more — and
            new writing sessions are pitched at it.
          </span>
        </label>
      </Card>
      <LearningSettings />
    </>
  );
}

function Speaking() {
  const settings = useStore((s) => s.settings);
  return (
    <>
      <Card title="Pronunciation">
        <label className="field">
          Guided speed
          <select value={String(settings.guidedPace)} onChange={(e) => setSettings({ guidedPace: Number(e.target.value) })}>
            {GUIDED_PACES.map((p) => (
              <option key={p.value} value={String(p.value)}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="tiny muted">
            How slowly the Guided button under a line in a conversation reads it back. The same reading stretched, not
            a different one — the tones stay where they are.
          </span>
        </label>
        <label className="field">
          Stop recording after
          <select value={String(settings.silenceStop)} onChange={(e) => setSettings({ silenceStop: Number(e.target.value) })}>
            {SILENCE_STOPS.map((p) => (
              <option key={p.value} value={String(p.value)}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="tiny muted">
            Quiet that ends a recording on its own, once you have started speaking. It watches the words, not the
            microphone, so a fan or a room of people does not hold it open.
          </span>
        </label>
      </Card>
      <Card title="Speak">
        <label className="toggle">
          <input type="checkbox" checked={settings.speakV2} onChange={(e) => setSettings({ speakV2: e.target.checked })} />
          <span>
            The new Speak
            <span className="d">
              Any line heard in your narrator’s voice, and slowly; what to fix listed word by word, each word to practise
              on its own; lines to say again gathered for you. Switch it off for Speak as it was.
            </span>
          </span>
        </label>
      </Card>
    </>
  );
}

function Printing() {
  const settings = useStore((s) => s.settings);
  const toast = useToast();
  const [folder, setFolder] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getFolderName().then((name) => live && setFolder(name));
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <Card title="Sheets">
        <div className="field">
          Print colour
          <PalettePicker value={settings.printPalette} onChange={(p) => p && setSettings({ printPalette: p })} />
          <span className="tiny muted">Every worksheet, test, text and radical sheet. A collection can pick its own under Design.</span>
        </div>
        <label className="field">
          Footer note on every sheet
          <input type="text" value={settings.footerNote} placeholder="your name, a class, anything" onChange={(e) => setSettings({ footerNote: e.target.value })} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.readerPractice} onChange={(e) => setSettings({ readerPractice: e.target.checked })} />
          <span>
            Print practice pages behind a text
            <span className="d">Its new words and characters, in the Drill layout a worksheet uses</span>
          </span>
        </label>
      </Card>
      {/* Only where the browser can write to a folder (Chrome, Edge); Safari downloads as usual, with nothing to set. */}
      {folderSupported() && (
        <Card title="Where worksheets go">
          <p className="small muted" style={{ margin: 0 }}>
            Pick a folder once and every PDF lands there automatically, named after the collection and dated, so you can
            find them again. The folder belongs to this browser, not to your account.
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
        </Card>
      )}
    </>
  );
}

function Appearance() {
  const theme = useStore((s) => s.settings.theme);
  return (
    <Card>
      <label className="field">
        Theme
        <select value={theme} onChange={(e) => setSettings({ theme: e.target.value as 'system' | 'light' | 'dark' })}>
          <option value="system">Match my system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <span className="tiny muted">This is the app on screen. Printed sheets use the colour under Printing.</span>
      </label>
    </Card>
  );
}

function ThisApp() {
  return (
    <>
      <InstallCard />
      <Card>
        <p className="small muted" style={{ margin: 0 }}>
          Hanzi Workshop runs in the browser. Added to the Home Screen it opens full screen, like an app, and keeps
          what it needs for the day when the network is slow.
        </p>
      </Card>
    </>
  );
}

function Work() {
  const toast = useToast();
  return (
    <Card>
      <p className="small muted" style={{ margin: 0 }}>
        Your texts, shelves, cards, lists and progress are kept in your account and saved as you go, the same on every
        device you sign in on.
      </p>
      <div className="row">
        <div className="spacer" />
        <button
          className="btn danger sm"
          onClick={() => {
            if (confirm('Delete everything in this account — collections, progress, reviews and texts — on every device? This cannot be undone.')) {
              resetWorkspace();
              toast('Everything in this account was deleted');
            }
          }}
        >
          Delete all my work
        </button>
      </div>
    </Card>
  );
}

export interface Section {
  id: string;
  han: string;
  label: string;
  /** what is inside, in a line */
  blurb: string;
  body: () => ReactNode;
}

/**
 * The settings, a page each (P11). Reading's own look stays in the text's
 * Aa, which is where it is changed while reading; Voices moves here with V11.
 */
export const SECTIONS: Section[] = [
  { id: 'learning', han: '学', label: 'Learning', blurb: 'Your level, and what counts as a day done', body: Learning },
  { id: 'speaking', han: '说', label: 'Speaking', blurb: 'Guided speed, when recording stops', body: Speaking },
  { id: 'keys', han: '钥', label: 'Keys & services', blurb: 'Pronunciation scoring with your own key', body: PronunciationKey },
  { id: 'printing', han: '印', label: 'Printing', blurb: 'The colour, the footer, practice pages', body: Printing },
  { id: 'appearance', han: '色', label: 'Appearance', blurb: 'Light, dark or as the system is', body: Appearance },
  { id: 'app', han: '机', label: 'This app', blurb: 'On the Home Screen, like an app', body: ThisApp },
  { id: 'work', han: '存', label: 'Your saved work', blurb: 'Where it is kept, and deleting it all', body: Work },
];
