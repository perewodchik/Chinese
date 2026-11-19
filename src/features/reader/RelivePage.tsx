import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { pictureUrl } from '../../api/pictures';
import { bookTitle, chapterHead, isFrontMatter } from '../../domain/bookshelf';
import { beatAt, beatCount, canRelive, castOf, scenesOf, type BeatPart, type CastMember } from '../../domain/companion';
import { pictureAbove } from '../../domain/pictures';
import { alignPinyin, type Token } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { isHanzi, shelfEntries, shelve, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { useWordLevel } from '../shared/levels';
import { usePinyinMode } from './readerView';
import './reader.css';
import './relive.css';

/**
 * /read/relive/:setId/:page — a chapter already read, lived again as scenes
 * (domain/companion): the paragraph's picture above, one sentence at a time
 * under it, what is said in a bubble from the face of whoever says it.
 *
 * It is a companion to the book and counts for nothing: nothing is marked
 * read and nothing is written. It is opened from a read chapter in the
 * book's list of chapters, and always leads back to the book.
 *
 * States: not a companion book or no such chapter (a line and the way back);
 * the chapter not read yet (the way to read it); a beat; the end.
 */
export function RelivePage() {
  const { setId = '', page: pageParam = '1' } = useParams();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const set = sets.find((s) => s.id === setId) ?? null;
  const list = useMemo(() => (set ? (shelve(texts, sets).bySet.get(set.id) ?? []) : []), [texts, sets, set]);
  const entries = useMemo(() => shelfEntries(list), [list]);
  const page = Math.max(1, Number(pageParam) || 1);
  const entry = entries[page - 1];
  const cast = set ? castOf(bookTitle(set.name)) : null;

  if (!set || !entry || !cast || isFrontMatter(entry.main)) {
    return <Away title="Nothing to relive here" line="This chapter is not in a book with a companion." to={set ? paths.reading(set.id) : paths.read()} label="Back to the book" />;
  }
  if (!canRelive(entry)) {
    return <Away title="Read it first" line="Read this chapter in the book, and then you can live it again here." to={paths.reading(set.id, { page })} label="Read the chapter" />;
  }
  const chapter = entries.slice(0, page).filter((e) => !isFrontMatter(e.main)).length;
  return <Relive key={entry.main.id} text={entry.easier ?? entry.main} cast={cast} back={paths.reading(set.id, { page })} chapter={chapter} />;
}

function Away({ title, line, to, label }: { title: string; line: string; to: string; label: string }) {
  useTitle(title);
  return (
    <div className="empty">
      <span className="big">读</span>
      <p>{line}</p>
      <Link className="btn" to={to}>
        {label}
      </Link>
    </div>
  );
}

function Relive({ text, cast, back, chapter }: { text: GeneratedText; cast: CastMember[]; back: string; chapter: number }) {
  const head = chapterHead(text, chapter);
  useTitle(`${head.zh} · relive`);
  const scenes = useMemo(() => scenesOf(text, cast), [text, cast]);
  const total = beatCount(scenes);
  const [n, setN] = useState(0);
  const done = n >= total;
  const at = beatAt(scenes, Math.min(n, total - 1));

  const next = useCallback(() => setN((v) => Math.min(total, v + 1)), [total]);
  const prev = useCallback(() => setN((v) => Math.max(0, v - 1)), []);

  // Arrows step through it on a keyboard, unless the word drawer or a field has the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const scene = at ? scenes[at.scene]! : null;
  const beat = at && scene ? scene.beats[at.beat]! : null;
  const picture = scene ? pictureAbove(text, scene.para) : undefined;

  return (
    <div className="cp-page">
      <header className="cp-bar">
        <Link className="back-link" to={back}>
          <Icon name="back" />
          {head.kicker ?? 'The book'}
        </Link>
        <span className="cp-count" aria-live="polite">
          {done ? 'The end' : `${n + 1} of ${total}`}
        </span>
      </header>

      <div className="cp-stage" style={{ '--ratio': picture?.w && picture.h ? picture.w / picture.h : 4 / 3 } as CSSProperties}>
        {picture?.key ? <img key={picture.key} src={pictureUrl(picture.key)} alt="" width={picture.w} height={picture.h} /> : <span className="cp-stage-title hanzi">{head.zh}</span>}
      </div>

      <div className="cp-progress" aria-hidden>
        <span style={{ width: `${(Math.min(n + 1, total) / Math.max(1, total)) * 100}%` }} />
      </div>

      <section className="cp-beat" aria-live="polite">
        {done ? (
          <div className="cp-end">
            <span className="hanzi cp-end-zh">{head.zh}</span>
            <p>You lived this chapter again. Nothing here counts; the book is where you left it.</p>
            <button className="btn quiet" type="button" onClick={() => setN(0)}>
              From the start
            </button>
          </div>
        ) : beat ? (
          <BeatView key={beat.line} text={text} line={beat.line} parts={beat.parts} cast={cast} />
        ) : null}
      </section>

      <footer className="cp-dock">
        <button className="icon-btn" type="button" onClick={prev} disabled={n === 0} aria-label="Back one line">
          <Icon name="back" />
        </button>
        {done ? (
          <Link className="btn primary lg" to={back}>
            Back to the book
          </Link>
        ) : (
          <button className="btn primary lg" type="button" onClick={next}>
            Go on
          </button>
        )}
      </footer>
    </div>
  );
}

/** One sentence: what is told in the book's voice, what is said in a bubble from the speaker's face. */
function BeatView({ text, line, parts, cast }: { text: GeneratedText; line: number; parts: BeatPart[]; cast: CastMember[] }) {
  const lib = useLibrary();
  const l = text.lines[line]!;
  const own = useMemo(() => new Set(text.vocab.map((v) => v.w)), [text.vocab]);
  const tokens = useMemo(() => segment(l.zh, lib, new Set([...own, ...writerHints(l.zh, l.py, lib)])), [l.zh, l.py, lib, own]);
  const syllables = useMemo(() => alignPinyin(l, lib), [l, lib]);
  return (
    <div className="cp-lines">
      {parts.map((p, i) => {
        const words = <Words tokens={tokens} syllables={syllables} chars={[...l.zh]} from={p.from} to={p.to} />;
        if (p.kind === 'told') return <p key={i} className="cp-told rd-zh hanzi" lang="zh">{words}</p>;
        const who = p.who ? cast.find((c) => c.id === p.who!.id) : undefined;
        return (
          <div key={i} className="cp-said">
            <span className="cp-face" aria-hidden>
              {/* A face from the book's pictures; for someone without one, the first character of their name. */}
              {who?.face ? <img src={`/companion/faces/${who.face}.jpg`} alt="" width={44} height={44} /> : <span className="hanzi">{p.who ? [...p.who.name][0] : '？'}</span>}
            </span>
            <div className="cp-said-body">
              <span className="cp-who">{p.who ? <><b className="hanzi">{p.who.name}</b> {who?.en}</> : 'Someone says'}</span>
              <p className="cp-bubble rd-zh hanzi" lang="zh">{words}</p>
            </div>
          </div>
        );
      })}
      <p className="cp-en">{l.en}</p>
    </div>
  );
}

/** The words of one stretch of a sentence, each with its reading over it, a tap opening its drawer. */
function Words({ tokens, syllables, chars, from, to }: { tokens: Token[]; syllables: string[]; chars: string[]; from: number; to: number }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const levelOfWord = useWordLevel();
  const [pinyin] = usePinyinMode();
  // Which syllable each character starts at: the readings are laid over the hanzi only.
  const hanziBefore = useMemo(() => {
    const out: number[] = [];
    let h = 0;
    for (const c of chars) {
      out.push(h);
      if (isHanzi(c)) h += 1;
    }
    return out;
  }, [chars]);
  // Punctuation is held to the word before it, an opening mark to the word after
  // it, so a line never starts with ： or ends with “ (an unbreakable .nb run).
  const groups: ReactNode[][] = [];
  let opener: ReactNode[] = [];
  for (const t of tokens) {
    const end = t.at + [...t.text].length;
    if (end <= from || t.at >= to) continue;
    if (!t.word) {
      // Punctuation is cut where the told part and the said part meet.
      const text = chars.slice(Math.max(t.at, from), Math.min(end, to)).join('');
      const mark = <span key={`p${t.at}`}>{text}</span>;
      if (/^[“‘《「『（(]+$/.test(text)) opener.push(mark);
      else if (groups.length) groups[groups.length - 1]!.push(mark);
      else groups.push([mark]);
      continue;
    }
    const unknown = levelOfWord(t.text) === 0;
    const show = pinyin === 'all' || (pinyin === 'new' && unknown);
    const said = [...t.text].map((_, k) => syllables[hanziBefore[t.at]! + k] ?? '').join('');
    const id = itemForToken(lib, t.text);
    groups.push([
      ...opener,
      <span key={t.at} className="w" role="button" tabIndex={0} data-mark={unknown ? 'new' : undefined} onClick={() => openItem(id)} onKeyDown={(e) => e.key === 'Enter' && openItem(id)}>
        <ruby>
          {t.text}
          <rt data-hidden={!show || undefined}>{said}</rt>
        </ruby>
      </span>,
    ]);
    opener = [];
  }
  if (opener.length) groups.push(opener);
  // Every run is its own span with its own key, so a beat never keeps a word of the one before.
  const out = groups.map((g, i) => (
    <span key={`g${i}`} className={g.length > 1 ? 'nb' : undefined}>
      {g}
    </span>
  ));
  return <>{out}</>;
}
