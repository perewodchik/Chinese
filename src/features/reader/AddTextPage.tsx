import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { charId } from '../../domain/ids';
import { CHAPTER_CHARS, looksTraditional, pastedTexts, summarize } from '../../domain/pastedText';
import { isHanzi } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { addTexts } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useUser } from '../auth/session';
import { useLevelOf } from '../shared/levels';
import { useLibrary } from '../shared/library';
import { useStartSession } from './startSession';
import './shelves.css';
import { tabStored } from '../../platform/storage';

const NEW_BOOK = '';

/** The paste waiting to be added, kept for this account in this tab: a reload or a look elsewhere loses nothing. */
function useDraft(key: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return tabStored.get(key) ?? '';
    } catch {
      return '';
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      if (v) tabStored.set(key, v);
      else tabStored.remove(key);
    } catch {
      /* a private window keeps it on screen only */
    }
  };
  return [value, set];
}

/**
 * /read/add (T2, T3, T8): Chinese pasted, typed or scanned in, and a text to
 * read a tap later — sentences, pinyin and the new words from the site's own
 * dictionary, with nothing in between and no AI. Before it is added, one line
 * says how big it is and how much of it is known.
 *
 * States: empty (the hint about Scan Text); no Chinese in it; traditional
 * characters; too long for one text (it becomes chapters); ready.
 */
export function AddTextPage() {
  useTitle('Add a text');
  const lib = useLibrary();
  const navigate = useNavigate();
  const user = useUser();
  const sets = useStore((s) => s.sets);
  const marked = useStore((s) => [...s.learned].filter((id) => id.startsWith('c')).length);
  const levelOf = useLevelOf();
  const startSession = useStartSession();
  const [query] = useSearchParams();
  const [raw, setRaw] = useDraft(`hanzi.add-text.${user.username}`);
  const [title, setTitle] = useState('');
  const books = useMemo(() => [...sets].sort((a, b) => b.createdAt - a.createdAt), [sets]);
  const [into, setInto] = useState(() => books.find((s) => s.id === query.get('shelf'))?.id ?? NEW_BOOK);
  useEffect(() => {
    if (into !== NEW_BOOK && !sets.some((s) => s.id === into)) setInto(NEW_BOOK);
  }, [into, sets]);

  const isKnown = useMemo(() => (c: string) => levelOf(charId(c)) >= 1, [levelOf]);
  const hasHan = [...raw].some(isHanzi);
  const sum = useMemo(() => (hasHan ? summarize(raw, lib, isKnown) : null), [hasHan, raw, lib, isKnown]);
  const traditional = useMemo(() => hasHan && looksTraditional(raw, lib), [hasHan, raw, lib]);

  function add() {
    if (!hasHan) return;
    const list = pastedTexts(raw, title, lib, isKnown);
    const name = title.trim() || list[0]?.titleZh || list[0]?.title || 'My texts';
    const { set, texts } = addTexts(list, { setId: into || null, name });
    setRaw('');
    navigate(texts[0] ? paths.text(texts[0].id) : paths.shelf(set.id), { replace: true });
  }

  return (
    <div className="add-text-page">
      <header className="page-head">
        <Link className="back-link" to={paths.read()}>
          <Icon name="back" />
          Read
        </Link>
      </header>
      <h1>Add a text</h1>

      <form
        className="add-text-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="field">
          <span className="sr-only">The Chinese text</span>
          <textarea
            className="hanzi add-text-box"
            lang="zh-CN"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste or type Chinese here…"
            rows={9}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {/* One line under the box, the same height whatever it says, so nothing below moves as it is typed. */}
        <p className="small add-text-about" data-warn={(raw.trim() && !hasHan) || traditional || undefined}>
          {!raw.trim()
            ? 'On an iPhone or iPad: tap the box, then Scan Text to read it off a page with the camera.'
            : !hasHan
              ? 'There is no Chinese in it yet.'
              : traditional
                ? 'This looks like traditional characters. It is kept as written; the dictionary knows simplified ones best.'
                : sum && aboutLine(sum, marked >= 20)}
        </p>

        <div className="add-text-fields">
          <label className="field">
            Title <span className="muted">(optional)</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Its opening words, if left empty" />
          </label>
          <label className="field">
            Goes into
            <select value={into} onChange={(e) => setInto(e.target.value)}>
              <option value={NEW_BOOK}>A new book</option>
              {books.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <button className="btn primary" type="submit" disabled={!hasHan}>
            Add it
          </button>
        </div>
      </form>

      <section className="block add-text-other">
        <h2 className="block-title">Other ways</h2>
        <div className="list">
          <button className="text-row" onClick={() => startSession(null)}>
            <span className="grow">
              <b>Have Claude write texts</b>
              <span className="small muted">Out of the characters you know, in your own chat with Claude</span>
            </span>
            <Icon name="chevron" className="muted" />
          </button>
        </div>
      </section>
    </div>
  );
}

function aboutLine(s: ReturnType<typeof summarize>, judge: boolean): string {
  const parts = [`About ${s.chars.toLocaleString('en')} characters`];
  if (s.chapters > 1) parts.push(`${s.chapters} chapters of up to ${CHAPTER_CHARS.toLocaleString('en')}`);
  if (judge) {
    const share = s.distinct ? s.known / s.distinct : 1;
    parts.push(`you know ${Math.round(share * 100)}% of its characters`);
    parts.push(`${s.newWords} new word${s.newWords === 1 ? '' : 's'} — ${share >= 0.9 ? 'comfortable' : share >= 0.75 ? 'a stretch' : 'hard going'}`);
  }
  return `${parts.join(' · ')}. Pinyin and the words’ meanings come from the dictionary; no English for the lines yet.`;
}
