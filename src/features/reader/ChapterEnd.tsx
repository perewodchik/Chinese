import type { Book } from '../../domain/bookshelf';
import type { GeneratedText } from '../../domain/text';
import { BookCover } from './BookCover';
import { MORE, type PartId, type TabId } from './TextParts';
import './shelves.css';

/** What each part is for, in a line: the rows say it so a part is chosen without opening it. */
const PART: Record<Exclude<TabId, 'read'>, { name: string; about: string }> = {
  write: { name: 'Copy it out', about: 'A word at a time, with its strokes beside it' },
  words: { name: 'Words', about: 'Its new words, and how well you know them' },
  questions: { name: 'Questions', about: 'What happened, in a few questions' },
  listen: { name: 'Listen again', about: 'The narrator, a sentence at a time' },
  more: { name: 'More', about: 'Translate it, or take it down as dictation' },
};

/** Where a part has got, in words: what is done is said in jade. */
function stateOf(id: Exclude<TabId, 'read'>, text: GeneratedText, fill: Record<PartId, number>): { label: string; done: boolean } {
  const st = text.study ?? {};
  if (id === 'more') return { label: '', done: false };
  if (id === 'words') {
    const n = text.vocab.length;
    return { label: `${Math.round(fill.words * n)} of ${n} done`, done: fill.words >= 1 };
  }
  if (id === 'questions') {
    const n = text.questions.length;
    return { label: `${(st.answered ?? []).length} of ${n} answered`, done: fill.questions >= 1 };
  }
  if (id === 'listen') {
    const times = st.listens ?? (st.heard ? 1 : 0);
    if (times) return { label: times === 1 ? 'Heard once' : `Heard ${times} times`, done: true };
  }
  if (id === 'write' && fill.write >= 1) return { label: 'Copied out', done: true };
  return { label: fill[id] > 0 ? 'Started' : 'Not yet', done: false };
}

export interface NextChapter {
  /** "Chapter 2 of 6", "Text 3 of 5" */
  where: string;
  kicker: string | null;
  zh: string;
  en: string;
  /** what the button says: "Read chapter 2", "Read the next text" */
  action: string;
}

/**
 * The end of a chapter, as a book ends one: 第一章 · 完, then what there is
 * to do with it — each part a row saying where it has got, opening the part
 * below — and the next chapter with the page's one button, which also counts
 * this one as read. The last chapter's button marks it read instead.
 */
export function ChapterEnd({
  text,
  kicker,
  chapter,
  parts,
  fill,
  onPart,
  next,
  book,
  onNext,
  onToggleRead,
  onAgain,
}: {
  text: GeneratedText;
  kicker: string | null;
  /** a chapter of a book (else a text on a shelf of texts) */
  chapter: boolean;
  parts: TabId[];
  fill: Record<PartId, number>;
  onPart: (id: TabId) => void;
  next: NextChapter | null;
  book: Book | null;
  onNext: () => void;
  onToggleRead: () => void;
  onAgain: () => void;
}) {
  const rows = parts.filter((p): p is Exclude<TabId, 'read'> => p !== 'read');
  const reads = text.reads ?? (text.read ? 1 : 0);
  const status = text.read
    ? reads > 1
      ? `You have read it ${reads} times.`
      : 'You have read it.'
    : chapter
      ? 'The end of the chapter.'
      : 'The end of the text.';
  return (
    <section className="rd-end no-print" aria-label={chapter ? 'The end of the chapter' : 'The end of the text'}>
      <header className="rd-end-head">
        <svg width="64" height="12" viewBox="0 0 64 12" aria-hidden>
          <path d="M2 6h22M40 6h22" />
          <circle cx="32" cy="6" r="3" />
        </svg>
        <h2 className="hanzi">{kicker ? `${kicker} · 完` : '完'}</h2>
        <p>{status}</p>
      </header>

      <div className="rd-end-parts">
        <p className="rd-end-label">{chapter ? 'With this chapter, if you like' : 'With this text, if you like'}</p>
        {rows.map((id) => {
          const s = stateOf(id, text, fill);
          const han = id === 'more' ? MORE.han : { write: '写', words: '词', questions: '问', listen: '听' }[id];
          return (
            <button key={id} className="rd-end-part" onClick={() => onPart(id)}>
              <span className="rd-end-han hanzi" data-done={s.done || undefined} aria-hidden>
                {han}
              </span>
              <span className="rd-end-what">
                <b>{PART[id].name}</b>
                <small>{PART[id].about}</small>
              </span>
              <span className="rd-end-state" data-done={s.done || undefined}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {next && (
        <div className="rd-end-next">
          {book && <BookCover book={book} width={58} />}
          <span className="rd-end-next-text">
            <small>Next: {next.where.toLowerCase()}</small>
            <b className="hanzi">{next.kicker ? `${next.kicker} ${next.zh}` : next.zh}</b>
            {next.en && next.en !== next.zh && <i>{next.en}</i>}
          </span>
        </div>
      )}

      <div className="rd-end-foot">
        {next ? (
          <button className="btn primary lg" onClick={onNext}>
            {next.action}
          </button>
        ) : (
          !text.read && (
            <button className="btn primary lg" onClick={onToggleRead}>
              Mark as read
            </button>
          )
        )}
        <div className="rd-end-quiet">
          <button className="btn quiet" onClick={onAgain}>
            {chapter ? 'Read this chapter again' : 'Read it again'}
          </button>
          {text.read && (
            <button className="btn quiet" onClick={onToggleRead}>
              Mark as not read
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
