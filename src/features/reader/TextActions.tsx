import { ask } from '../../ui/dialogs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { type GeneratedText, type TextSet } from '../../domain/text';
import { paths, type ReadMode } from '../../navigation/paths';
// R5: the PDF code (pdf-lib and the fonts) comes only when something is printed.
const pdfRender = () => import('../../pdf/render');
import { deleteText, setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { PalettePicker } from '../../ui/PalettePicker';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { readerSheet } from './readerSheet';

/**
 * What can be done with the text and its book, at the foot of the chapters'
 * panel (☰) — there is no ⋯ on the text page: explaining it with Claude,
 * editing it, printing it as it looks or as a PDF, reporting a mistake in a
 * library book, deleting it; and for the book, every text on one page, the
 * whole of it as a PDF and how the PDFs look.
 *
 * The browser's own print is the page as it is on screen with the controls
 * taken off. The PDFs are the designed sheets the worksheets use, with
 * practice squares.
 */
export function TextActions({
  set,
  list,
  text,
  mode,
  onMode,
  onClose,
}: {
  set: TextSet | null;
  list: GeneratedText[];
  text: GeneratedText;
  mode: ReadMode;
  onMode: (m: ReadMode) => void;
  /** closes the panel the actions are in */
  onClose: () => void;
}) {
  const lib = useLibrary();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const settings = useStore((s) => s.settings);
  const [look, setLook] = useState(false);
  const sheet = readerSheet(settings);
  const printOptions = { footerNote: settings.footerNote, practice: settings.readerPractice };
  const busy = pdf.busy !== null;
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };

  async function remove() {
    if (!(await ask({ title: `Delete “${text.titleZh || text.title}”?`, yes: 'Delete it', danger: true }))) return;
    onClose();
    navigate(set && list.length > 1 ? paths.reading(set.id) : paths.read(), { replace: true, flushSync: true });
    deleteText(text.id);
  }

  const row = (label: string, sub: string | null, onClick: () => void, o: { danger?: boolean; disabled?: boolean } = {}) => (
    <button className="rd-toc-row rd-toc-action" data-danger={o.danger || undefined} disabled={o.disabled} onClick={onClick}>
      <span className="rd-toc-title">
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </span>
    </button>
  );

  return (
    <>
      <section className="rd-toc-actions" aria-label="This text">
        <h3 className="rd-toc-group">This {set && list.length > 1 ? 'chapter' : 'text'}</h3>
        {mode === 'single' &&
          !text.lines.some((l) => l.en) &&
          row('Explain it with Claude', 'Its English, words, grammar and questions, from your own chat', then(() => navigate(paths.explainText(text.id))))}
        {mode === 'single' && row('Edit text', 'A line’s Chinese, pinyin or English, its title, its place in the book', then(() => navigate(paths.editText(text.id))))}
        {row(`Print ${mode === 'all' ? 'the whole shelf' : 'this page'}`, 'As it looks here', then(() => window.print()))}
        {row('This text as a PDF', 'With practice squares', then(() =>
          void pdf.run('passage', {
            title: text.title,
            render: async () => (await pdfRender()).renderReading(lib, text, sheet, { ...printOptions, pinyin: true, english: true }),
          }),
        ), { disabled: busy })}
        {/* A9: a book from the library is everyone's: a mistake in it goes to whoever runs the site. */}
        {set?.catalog &&
          row('Report a mistake', 'In this library book, to whoever runs the site', then(() =>
            navigate(paths.feedback(window.location.pathname, `the library book “${set.name}”, “${text.titleZh || text.title}”`)),
          ))}
        {mode === 'single' && row('Delete this text', null, () => void remove(), { danger: true })}
      </section>
      <section className="rd-toc-actions" aria-label="The book">
        <h3 className="rd-toc-group">The book</h3>
        {list.length > 1 && row(mode === 'all' ? 'One text at a time' : 'Every text on one page', null, then(() => onMode(mode === 'all' ? 'single' : 'all')))}
        {set &&
          row('The book as a PDF', 'Every text, with practice squares', then(() =>
            void pdf.run(set.id, { title: set.name, render: async () => (await pdfRender()).renderTextSet(lib, set.name, list, sheet, printOptions) }),
          ), { disabled: busy })}
        {row('How the PDF looks…', 'The print colour, and practice pages behind the reading', () => setLook(true))}
      </section>
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
