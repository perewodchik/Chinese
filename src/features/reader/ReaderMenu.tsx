import { ask } from '../../ui/dialogs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { type GeneratedText, type TextSet } from '../../domain/text';
import { paths, type ReadMode } from '../../navigation/paths';
// R5: the PDF code (pdf-lib and the fonts) comes only when something is printed.
const pdfRender = () => import('../../pdf/render');
import { deleteText, setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { Modal } from '../../ui/Modal';
import { PalettePicker } from '../../ui/PalettePicker';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { readerSheet } from './readerSheet';

/**
 * ⋯: whether it is read, printing in its three forms, and deleting.
 *
 * The browser's own print is the page as it is on screen with the controls
 * taken off. The PDFs are the designed sheets the worksheets use, with
 * practice squares.
 */
export function ReaderMenu({
  set,
  list,
  text,
  mode,
  onMode,
}: {
  set: TextSet | null;
  list: GeneratedText[];
  text: GeneratedText;
  mode: ReadMode;
  onMode: (m: ReadMode) => void;
}) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const settings = useStore((s) => s.settings);
  const [look, setLook] = useState(false);
  const sheet = readerSheet(settings);
  const printOptions = { footerNote: settings.footerNote, practice: settings.readerPractice };
  const busy = pdf.busy !== null;
  const then = (close: () => void, fn: () => void) => () => {
    close();
    fn();
  };

  async function remove() {
    if (!(await ask({ title: `Delete “${text.titleZh || text.title}”?`, yes: 'Delete it', danger: true }))) return;
    navigate(set && list.length > 1 ? paths.reading(set.id) : paths.read(), { replace: true, flushSync: true });
    deleteText(text.id);
  }

  return (
    <>
      <Menu label={<Icon name="more" size={22} />} title={busy ? 'Building the PDF…' : 'More'} className={`rd-menu-btn${busy ? ' busy' : ''}`}>
        {(close) => (
          <>
            {mode === 'single' && !text.lines.some((l) => l.en) && (
              <button role="menuitem" className="btn ghost sm" onClick={then(close, () => navigate(paths.explainText(text.id)))}>
                Explain it with Claude
                <span className="tiny muted">its English, words, grammar and questions, from your own chat</span>
              </button>
            )}
            {list.length > 1 && (
              <button role="menuitem" className="btn ghost sm" onClick={then(close, () => onMode(mode === 'all' ? 'single' : 'all'))}>
                {mode === 'all' ? 'One text at a time' : 'Every text on one page'}
              </button>
            )}
            <button role="menuitem" className="btn ghost sm" onClick={then(close, () => window.print())}>
              Print {mode === 'all' ? 'the whole shelf' : 'this page'}
              <span className="tiny muted">as it looks here</span>
            </button>
            <button
              role="menuitem"
              className="btn ghost sm"
              disabled={busy}
              onClick={then(close, () =>
                void pdf.run('passage', {
                  title: text.title,
                  render: async () => (await pdfRender()).renderReading(lib, text, sheet, { ...printOptions, pinyin: true, english: true }),
                }),
              )}
            >
              This text as a PDF
            </button>
            {set && (
              <button
                role="menuitem"
                className="btn ghost sm"
                disabled={busy}
                onClick={then(close, () =>
                  void pdf.run(set.id, { title: set.name, render: async () => (await pdfRender()).renderTextSet(lib, set.name, list, sheet, printOptions) }),
                )}
              >
                The shelf as a PDF
              </button>
            )}
            <button role="menuitem" className="btn ghost sm" onClick={then(close, () => setLook(true))}>
              How the PDF looks…
            </button>
            {/* A9: a book from the library is everyone's: a mistake in it goes to whoever runs the site. */}
            {set?.catalog && (
              <button
                role="menuitem"
                className="btn ghost sm"
                onClick={then(close, () => navigate(paths.feedback(window.location.pathname, `the library book “${set.name}”, “${text.titleZh || text.title}”`)))}
              >
                Report a mistake
                <span className="tiny muted">in this library book, to whoever runs the site</span>
              </button>
            )}
            {mode === 'single' && (
              <button role="menuitem" className="btn ghost sm" onClick={then(close, () => navigate(paths.editText(text.id)))}>
                Edit text
                <span className="tiny muted">a line’s Chinese, pinyin or English, its title, its place in the book</span>
              </button>
            )}
            {mode === 'single' && (
              <button role="menuitem" className="btn ghost sm danger" onClick={then(close, remove)}>
                Delete this text
              </button>
            )}
          </>
        )}
      </Menu>
      {look && <PdfLook onClose={() => setLook(false)} teaches={text.teach.length} />}
    </>
  );
}

function PdfLook({ onClose, teaches }: { onClose: () => void; teaches: number }) {
  const settings = useStore((s) => s.settings);
  return (
    <Modal title="How the PDF looks" subtitle="For the designed sheets. Printing the page keeps the page’s own look." onClose={onClose}>
      <PalettePicker value={settings.printPalette} onChange={(p) => p && setSettings({ printPalette: p })} />
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
        This is the print colour for every sheet: worksheets, tests and texts. A collection can still pick its own.
      </p>
      <label className="toggle" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={settings.readerPractice} onChange={(e) => setSettings({ readerPractice: e.target.checked })} />
        <span>
          Practice pages behind the reading
          <span className="d">
            {teaches
              ? `Drill pages for its new words and ${teaches} new character${teaches === 1 ? '' : 's'}`
              : 'Drill pages for each text’s new words and characters'}
          </span>
        </span>
      </label>
    </Modal>
  );
}
