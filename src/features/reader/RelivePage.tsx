import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { pictureUrl } from '../../api/pictures';
import { bookTitle, chapterHead, isFrontMatter } from '../../domain/bookshelf';
import { beatAt, beatCount, beatFromQuery, canRelive, castOf, mixedOrder, readInBook, scenesOf, wordsSaid, type BeatPart, type CastMember } from '../../domain/companion';
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
import { CompanionFace } from './CompanionFace';

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
  const [params] = useSearchParams();
  const start = params.get('at');
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const set = sets.find((s) => s.id === setId) ?? null;
  const list = useMemo(() => (set ? (shelve(texts, sets).bySet.get(set.id) ?? []) : []), [texts, sets, set]);
  const entries = useMemo(() => shelfEntries(list), [list]);
  const page = Math.max(1, Number(pageParam) || 1);
  const entry = entries[page - 1];
  const cast = set ? castOf(bookTitle(set.name)) : null;

  if (!set || !entry || !cast || isFrontMatter(entry.main)) {
    return <Away title="Nothing to relive here" line="This chapter is not in a book with a companion." to={set ? paths.shelf(set.id) : paths.read()} label="Back to the book" />;
  }
  if (!canRelive(entry, readInBook(texts, sets, bookTitle(set.name)))) {
    return <Away title="Read it first" line="Read this chapter in the book, and then you can live it again here." to={paths.reading(set.id, { page })} label="Read the chapter" />;
  }
  const chapter = entries.slice(0, page).filter((e) => !isFrontMatter(e.main)).length;
  return <Relive key={entry.main.id} text={entry.easier ?? entry.main} cast={cast} back={paths.reading(set.id, { page })} chapter={chapter} guide={paths.guide(set.id)} title={bookTitle(set.name)} start={start} />;
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

function Relive({ text, cast, back, chapter, guide, title, start }: { text: GeneratedText; cast: CastMember[]; back: string; chapter: number; guide: string; title: string; start: string | null }) {
  const head = chapterHead(text, chapter);
  useTitle(`${head.zh} · relive`);
  const scenes = useMemo(() => scenesOf(text, cast), [text, cast]);
  const total = beatCount(scenes);
  // Opened from the guide at a line someone says, or a place first seen: start there.
  const [n, setN] = useState(() => beatFromQuery(start, total));
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
  const picture = scene ? pictureAbove(text, scene.para) : undefined;
  const last = scenes[scenes.length - 1];
  const endPicture = last ? pictureAbove(text, last.para) : undefined;
  const shown = done ? endPicture : picture;

  return (
    <div className="cp-page">
      <header className="cp-bar">
        <Link className="back-link" to={back}>
          <Icon name="back" />
          {head.kicker ?? 'The book'}
        </Link>
        <Link className="btn quiet sm cp-guide" to={guide}>
          Guide
        </Link>
        <span className="cp-count" aria-live="polite">
          {done ? 'The end' : `${n + 1} of ${total}`}
        </span>
      </header>

      <div className="cp-stage" style={{ '--ratio': shown?.w && shown.h ? shown.w / shown.h : 4 / 3 } as CSSProperties}>
        {shown?.key ? <img key={shown.key} src={pictureUrl(shown.key)} alt="" width={shown.w} height={shown.h} /> : <span className="cp-stage-title hanzi">{head.zh}</span>}
      </div>

      <div className="cp-progress" aria-hidden>
        <span style={{ width: `${(Math.min(n + 1, total) / Math.max(1, total)) * 100}%` }} />
      </div>

      <section className="cp-beat" aria-live="polite">
        {done ? (
          <ChapterEndView text={text} cast={cast} title={title} zh={head.zh} onRestart={() => setN(0)} />
        ) : at && scene ? (
          // The sentences of the scene so far: on a phone only the one now, on a wide screen the ones before it too, quieter.
          scene.beats.slice(0, at.beat + 1).map((beat, i) => (
            <div key={beat.line} className="cp-beat-line" data-past={i < at.beat || undefined}>
              <BeatView text={text} line={beat.line} parts={beat.parts} cast={cast} />
            </div>
          ))
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

/**
 * The end of a chapter lived again: the words its people said, with their
 * faces — a tap opens the word, where it can be learned — and, for a chapter
 * with pictures enough, the story to put back in order. Nothing is scored.
 */
function ChapterEndView({ text, cast, title, zh, onRestart }: { text: GeneratedText; cast: CastMember[]; title: string; zh: string; onRestart: () => void }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const words = useMemo(() => wordsSaid(text, cast, title), [text, cast, title]);
  return (
    <div className="cp-end">
      <span className="hanzi cp-end-zh">{zh}</span>
      <p>You lived this chapter again. Nothing here counts; the book is where you left it.</p>
      {words.length > 0 && (
        <>
          <h2 className="cp-end-title">Words they said</h2>
          <ul className="list cp-words">
            {words.map((w) => {
              const member = cast.find((c) => c.id === w.who.id);
              return (
                <li key={w.w}>
                  <button type="button" className="cp-word" onClick={() => openItem(itemForToken(lib, w.w))}>
                    <CompanionFace member={member} name={w.who.name} size={32} />
                    <span className="cp-word-zh">
                      <span className="hanzi">{w.w}</span>
                      <small>{w.py}</small>
                    </span>
                    <span className="cp-word-d">{w.d}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <StoryInOrder text={text} />
      <button className="btn quiet" type="button" onClick={onRestart}>
        From the start
      </button>
    </div>
  );
}

/**
 * The chapter's pictures, mixed, to tap in the order the story went. When
 * all are tapped it says how it went and shows them in their order — no
 * mark, nothing kept. A chapter with fewer than three pictures has none.
 */
function StoryInOrder({ text }: { text: GeneratedText }) {
  const pictures = useMemo(() => (text.pictures ?? []).filter((p) => p.key).sort((a, b) => a.para - b.para), [text.pictures]);
  const mixed = useMemo(() => mixedOrder(pictures.length), [pictures]);
  const [picked, setPicked] = useState<number[]>([]);
  if (pictures.length < 3) return null;
  const finished = picked.length === pictures.length;
  const right = finished && picked.every((p, i) => p === i);
  const tiles = finished ? pictures.map((_, i) => i) : mixed;
  return (
    <div className="cp-order">
      <h2 className="cp-end-title">The story in pictures</h2>
      <p className="cp-order-say">{finished ? (right ? 'That is the order it happened in.' : 'This is the order it happened in.') : 'Tap them in the order it happened, if you like.'}</p>
      <div className="cp-order-grid">
        {tiles.map((i) => {
          const at = picked.indexOf(i);
          return (
            <button key={pictures[i]!.key} type="button" className="cp-order-tile" disabled={finished || at >= 0} onClick={() => setPicked((p) => [...p, i])} aria-label={at >= 0 ? `Picture ${at + 1}` : 'A picture of the story'}>
              <img src={pictureUrl(pictures[i]!.key!)} alt="" width={pictures[i]!.w} height={pictures[i]!.h} loading="lazy" />
              <span className="cp-order-n" data-shown={finished || at >= 0 || undefined}>{finished ? i + 1 : at + 1}</span>
            </button>
          );
        })}
      </div>
      <button className="btn quiet sm" type="button" onClick={() => setPicked([])} disabled={!picked.length}>
        Again
      </button>
    </div>
  );
}

/** One sentence: what is told in the book's voice, what is said in a bubble from the speaker's face. */
function BeatView({ text, line, parts, cast }: { text: GeneratedText; line: number; parts: BeatPart[]; cast: CastMember[] }) {
  const lib = useLibrary();
  const l = text.lines[line]!;
  const own = useMemo(() => new Set(text.vocab.map((v) => v.w)), [text.vocab]);
  const tokens = useMemo(() => segment(l.zh, lib, new Set([...own, ...writerHints(l.zh, l.py, lib)]), { bySense: true }), [l.zh, l.py, lib, own]);
  const syllables = useMemo(() => alignPinyin(l, lib), [l, lib]);
  return (
    <div className="cp-lines">
      {parts.map((p, i) => {
        const words = <Words tokens={tokens} syllables={syllables} chars={[...l.zh]} from={p.from} to={p.to} />;
        if (p.kind === 'told') return <p key={i} className="cp-told rd-zh hanzi" lang="zh">{words}</p>;
        const who = p.who ? cast.find((c) => c.id === p.who!.id) : undefined;
        return (
          <div key={i} className="cp-said">
            <CompanionFace member={who} name={p.who?.name ?? null} />
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
