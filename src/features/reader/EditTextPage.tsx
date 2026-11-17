import { ask } from '../../ui/dialogs';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { pinyinOf } from '../../domain/ownText';
import { shelve, type TextLine } from '../../domain/text';
import { cutsOf, joinWithNext, removeLine, split } from '../../domain/textEdit';
import { paths } from '../../navigation/paths';
import { editText, reorderSet } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import './shelves.css';

/**
 * /read/edit/:textId (T7): a text put right by hand — a line's Chinese,
 * pinyin and English, two lines made one or one cut in two, a line taken
 * out, the title — and its place in its book. Nothing is changed until Save;
 * the place in the book moves at once, as it is not the text's own.
 *
 * States: unchanged (Save waits); changed; a line with nothing in it (Save
 * says so); the only text of its book (no place to move).
 */
export function EditTextPage() {
  const { textId = '' } = useParams();
  const text = useStore((s) => s.texts.find((t) => t.id === textId));
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const lib = useLibrary();
  const navigate = useNavigate();
  const toast = useToast();
  useTitle('Edit text');
  const [lines, setLines] = useState<TextLine[]>(() => text?.lines ?? []);
  const [titleZh, setTitleZh] = useState(text?.titleZh ?? '');
  const [title, setTitle] = useState(text?.title ?? '');
  // The book's texts in reading order, for "earlier" and "later".
  const inBook = useMemo(() => (text?.setId ? (shelve(texts, sets).bySet.get(text.setId) ?? []).map((t) => t.id) : []), [text?.setId, texts, sets]);

  if (!text) return <Navigate to={paths.read()} replace />;

  const changed = titleZh !== text.titleZh || title !== text.title || JSON.stringify(lines) !== JSON.stringify(text.lines);
  const empty = lines.findIndex((l) => !l.zh.trim());
  const back = paths.text(text.id);
  const set = (i: number, patch: Partial<TextLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  function save() {
    if (!text || !changed || empty >= 0 || !lines.length) return;
    editText(text.id, { lines: lines.map((l) => ({ ...l, zh: l.zh.trim(), py: l.py.trim(), en: l.en.trim() })), titleZh: titleZh.trim(), title: title.trim() || titleZh.trim() });
    toast('Saved');
    navigate(back, { replace: true });
  }

  function move(by: -1 | 1) {
    if (!text?.setId) return;
    const at = inBook.indexOf(text.id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= inBook.length) return;
    const order = [...inBook];
    order.splice(at, 1);
    order.splice(to, 0, text.id);
    reorderSet(text.setId, order);
  }
  const place = inBook.indexOf(text.id);

  return (
    <div className="add-text-page edit-text-page">
      <header className="page-head">
        <Link
          className="back-link"
          to={back}
          onClick={(e) => {
            if (!changed) return;
            e.preventDefault();
            void ask({ title: 'Leave without saving?', message: 'Your changes to this text are not saved yet.', yes: 'Leave', no: 'Stay', danger: true }).then((go) => go && navigate(back));
          }}
        >
          <Icon name="back" />
          Back to the text
        </Link>
        <span className="spacer" />
        <button className="btn primary sm" disabled={!changed || empty >= 0 || !lines.length} onClick={save}>
          Save
        </button>
      </header>
      <h1>Edit text</h1>
      <p className="small edit-text-state" data-warn={empty >= 0 || undefined}>
        {empty >= 0 ? `Line ${empty + 1} is empty: write it, or take it out.` : changed ? 'Changed, not saved yet.' : 'Nothing changed yet.'}
      </p>

      <div className="add-text-fields">
        <label className="field">
          Chinese title
          <input type="text" className="hanzi" lang="zh-CN" value={titleZh} onChange={(e) => setTitleZh(e.target.value)} maxLength={60} />
        </label>
        <label className="field">
          English title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </label>
      </div>

      {inBook.length > 1 && (
        <div className="row edit-text-place">
          <span className="grow small">
            Text {place + 1} of {inBook.length} in its book
          </span>
          <button className="btn quiet sm" disabled={place <= 0} onClick={() => move(-1)}>
            Earlier
          </button>
          <button className="btn quiet sm" disabled={place >= inBook.length - 1} onClick={() => move(1)}>
            Later
          </button>
        </div>
      )}

      <ol className="edit-lines">
        {lines.map((l, i) => (
          <li key={i} className="edit-line">
            <div className="row edit-line-head">
              <b className="small">Line {i + 1}</b>
              <label className="small edit-line-para">
                <input type="checkbox" checked={Boolean(l.p)} onChange={(e) => set(i, { p: e.target.checked || undefined })} />
                Starts a paragraph
              </label>
            </div>
            <label className="field">
              <span className="sr-only">Chinese</span>
              <textarea className="hanzi edit-line-zh" lang="zh-CN" rows={2} value={l.zh} onChange={(e) => set(i, { zh: e.target.value })} />
            </label>
            <div className="row edit-line-py">
              <label className="field grow">
                <span className="sr-only">Pinyin</span>
                <input type="text" value={l.py} placeholder="Pinyin" onChange={(e) => set(i, { py: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              </label>
              <button className="btn quiet sm" title="The pinyin from the dictionary, a word at a time" onClick={() => set(i, { py: pinyinOf(l.zh, lib) })}>
                From the dictionary
              </button>
            </div>
            <label className="field">
              <span className="sr-only">English</span>
              <input type="text" value={l.en} placeholder="English" onChange={(e) => set(i, { en: e.target.value })} />
            </label>
            <div className="row edit-line-actions">
              <button className="btn quiet sm" disabled={i >= lines.length - 1} onClick={() => setLines((ls) => joinWithNext(ls, i))}>
                Join with the next
              </button>
              <button className="btn quiet sm" disabled={cutsOf(l.zh).length < 2} onClick={() => setLines((ls) => split(ls, i, (zh) => pinyinOf(zh, lib)))}>
                Split
              </button>
              <span className="spacer" />
              <button className="btn quiet sm" disabled={lines.length <= 1} onClick={() => setLines((ls) => removeLine(ls, i))}>
                Take out
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
