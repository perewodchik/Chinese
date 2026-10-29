import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Library } from '../../data/types';
import { charId, readableChars, type ItemId } from '../../domain/ids';
import { alignPinyin, paragraphs, stepsAbove, wordBands, type Token } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { itemForToken, type WordKnowledge } from '../../domain/words';
import { pictureAbove } from '../../domain/pictures';
import { coverageOf, hskLabel, isHanzi, plainTitle, type GeneratedText } from '../../domain/text';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { Comic } from './Comic';
import { ParagraphPicture } from './ParagraphPicture';
import { SceneView } from './SceneView';
import { StoryChoices, StoryMap } from './StoryPath';
import type { PinyinMode, TranslationMode } from './readerView';
import './stories.css';

/** What the reader has switched on, shared by every passage on the page. */
export interface ReaderView {
  layout: 'paragraph' | 'sentences';
  pinyin: PinyinMode;
  translation: TranslationMode;
  traditional: boolean;
  /** underline the words you do not know yet, and the ones you are learning */
  markUnknown: boolean;
  /** underline words above the band below */
  markAbove: boolean;
  target: number;
  /** a dialogue drawn as speech bubbles from faces */
  comic: boolean;
}

/** Where a word stands for this reader: the marks and the pinyin follow it. */
export type Standing = 'known' | 'learning' | 'new';

/** The library's words, indexed once per library rather than once per sentence. */
const bandCache = new WeakMap<Library, Map<string, number>>();
const bandsOf = (lib: Library) => {
  let m = bandCache.get(lib);
  if (!m) bandCache.set(lib, (m = wordBands(lib)));
  return m;
};

/** Opening punctuation, which goes with the word after it rather than the one before. */
const OPENERS = /^[“‘《「『（(【〈]+$/;

/**
 * How well you know a word, for this page.
 *
 * What review knows about the word decides it when it knows anything. A word
 * review has never seen is read off its characters: every one of them learned
 * and the word reads itself; one of them new and it is new. Chosen on this
 * shelf to learn, it is being learned from that moment.
 */
export function useStanding(study: ReadonlySet<ItemId>): (word: string) => Standing {
  const lib = useLibrary();
  const known = useWordKnowledge();
  const learned = useStore((s) => s.learned);
  return useMemo(() => standingOf(lib, known, learned, study), [lib, known, learned, study]);
}

export function standingOf(
  lib: Library,
  known: WordKnowledge,
  learned: ReadonlySet<ItemId>,
  study: ReadonlySet<ItemId>,
): (word: string) => Standing {
  return (word) => {
    const chars = [...word].filter(isHanzi);
    if (!chars.length) return 'known';
    const s = known.status(word);
    if (s === 'known') return 'known';
    if (s === 'learning' || study.has(itemForToken(lib, word))) return 'learning';
    return chars.every((c) => learned.has(charId(c))) ? 'known' : 'new';
  };
}

interface PassageProps {
  text: GeneratedText;
  view: ReaderView;
  /** the line being read aloud, if it is in this passage */
  reading: number | null;
  /** a line just pointed at from elsewhere on the page — a grammar note — lit for a moment */
  flash: number | null;
  /** lines whose translation has been asked for, in "tap a line" */
  revealed: ReadonlySet<number>;
  onReveal: (i: number) => void;
  /** the shelf's own list of things being learned */
  study: ReadonlySet<ItemId>;
  /** above the title, when several passages share the page */
  heading?: ReactNode;
}

/**
 * The text itself: its title, how much of it you can read, and the Chinese.
 *
 * Every word is a button for its drawer. Pinyin goes over the words the
 * reader asked for — by default only the ones not known yet — and the room
 * for it is kept on every line whether it is shown or not, so turning it on
 * and off never moves a line. Punctuation stays with the word before it: a
 * line never begins with a comma.
 */
export function Passage({ text, view, reading, flash, revealed, onReveal, study, heading }: PassageProps) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const learned = useStore((s) => s.learned);
  const standing = useStanding(study);

  // A story with choices shows the nodes on the way taken so far, in the order
  // they were reached; a plain passage shows everything.
  const story = text.story ?? null;
  const [path, setPath] = useState<string[]>(() => (story ? [story.start] : []));
  useEffect(() => setPath(story ? [story.start] : []), [text.id, story]);
  const byNode = useMemo(() => {
    const m = new Map<string, number[]>();
    text.lines.forEach((l, i) => {
      if (!l.node) return;
      const list = m.get(l.node);
      if (list) list.push(i);
      else m.set(l.node, [i]);
    });
    return m;
  }, [text.lines]);
  const shownLines = useMemo(
    () => (story ? path.flatMap((n) => byNode.get(n) ?? []) : text.lines.map((_, i) => i)),
    [story, path, byNode, text.lines],
  );
  const paras = useMemo(
    () => (story ? path.map((n) => byNode.get(n) ?? []).filter((p) => p.length) : paragraphs(text)),
    [text, story, path, byNode],
  );
  // Pictures go by the passage's own paragraphs, which a story with choices does not show as such.
  const pictureOf = (n: number) => (story ? undefined : pictureAbove(text, n));
  const paraStarts = useMemo(() => new Map(paragraphs(text).map((p, n) => [p[0]!, n])), [text]);
  const comic = view.comic && (text.genre === 'dialogue' || text.lines.some((l) => l.who)) && !story;
  const layout = view.layout;
  const showTrad = view.traditional && text.lines.some((l) => l.zht);

  const ownWords = useMemo(() => new Set(text.vocab.map((w) => w.w)), [text.vocab]);
  const teach = useMemo(() => new Set(text.teach), [text.teach]);
  /** Each sentence cut into words, once per passage. */
  const tokens = useMemo(
    // The writer's own grouping, read out of its pinyin, joins the passage's
    // vocabulary for each sentence: 广州 and 食街 are words there even though
    // no dictionary has them.
    () => text.lines.map((l) => segment(l.zh, lib, new Set([...ownWords, ...writerHints(l.zh, l.py, lib)]))),
    [text.lines, lib, ownWords],
  );
  const syllables = useMemo(() => text.lines.map((l) => alignPinyin(l, lib)), [text.lines, lib]);
  const bands = bandsOf(lib);

  // Worked out from what is learned now, not what was when the text was
  // written: it moves as characters and words are learned.
  const cover = useMemo(() => coverageOf(text, readableChars(learned)), [text, learned]);

  /** One sentence, word by word, punctuation held to its word. */
  function sentence(i: number): ReactNode {
    const line = text.lines[i]!;
    if (showTrad && line.zht) return <span className="trad">{line.zht}</span>;
    const py = syllables[i]!;
    let h = 0;
    const out: ReactNode[] = [];
    let opener = '';
    tokens[i]!.forEach((t: Token, k) => {
      if (!t.word) {
        if (OPENERS.test(t.text.trim())) {
          opener += t.text;
          return;
        }
        // Closing punctuation joins the word before it, so it never starts a line.
        const last = out.pop();
        out.push(
          <span key={`p${k}`} className="nb">
            {last}
            {t.text}
          </span>,
        );
        return;
      }
      const s = standing(t.text);
      const said: string[] = [];
      for (const ch of t.text) if (isHanzi(ch)) said.push(py[h++] ?? '');
      const showPy = view.pinyin === 'all' || (view.pinyin === 'new' && s !== 'known');
      const step = view.markAbove ? stepsAbove(t, view.target) : 0;
      const mark = view.markUnknown && s !== 'known' ? s : undefined;
      // A word holding one of the text's new characters is new too — until it is chosen to learn, when it turns blue like any other.
      const isNew = mark === 'new' || (view.markUnknown && [...t.text].some((c) => teach.has(c)) && s !== 'known' && s !== 'learning');
      const id = itemForToken(lib, t.text);
      const band = bands.get(t.text);
      const word = (
        <span
          key={k}
          className="w"
          role="button"
          tabIndex={0}
          data-mark={isNew ? 'new' : mark}
          data-above={step || undefined}
          title={step && band ? `${t.text} · ${hskLabel(band)}` : undefined}
          onClick={() => openItem(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') openItem(id);
          }}
        >
          {opener && <span className="opener">{opener}</span>}
          <ruby>
            {t.text}
            {/* Always there, hidden when not asked for: its width is the word's, and switching pinyin on must not move a line. */}
            <rt data-hidden={!showPy || undefined}>{said.join('')}</rt>
          </ruby>
        </span>
      );
      opener = '';
      out.push(word);
    });
    return out;
  }

  return (
    <article className="rd-passage" lang="zh">
      <header className="rd-head">
        {heading}
        <h1 className="rd-title hanzi">{text.titleZh || text.title}</h1>
        <p className="rd-subtitle">{plainTitle(text.title)}</p>
        <div className="rd-know" title={`${cover.known} of ${cover.total} different characters`}>
          <span className="rd-meter" aria-hidden>
            <i style={{ width: `${Math.round(cover.ratio * 100)}%` }} />
          </span>
          <span>You know {Math.round(cover.ratio * 100)}%</span>
        </div>
      </header>

      {story && (
        <div className="story-bar no-print">
          <StoryMap story={story} path={path} endings={text.endings ?? []} />
          <span className="tiny muted">A story with choices: you decide what happens.</span>
        </div>
      )}

      <div
        className="rd-zh"
        data-layout={comic ? 'comic' : layout}
        data-pinyin={view.pinyin !== 'off' || undefined}
      >
        {comic ? (
          <Comic
            lines={shownLines.map((i) => ({ i, line: text.lines[i]! }))}
            reading={reading}
            english={view.translation === 'shown'}
            sentence={(i) => sentence(i)}
          />
        ) : layout === 'paragraph' ? (
          paras.map((p, n) => (
            <Fragment key={n}>
              {(text.scenes ?? [])
                .filter((sc) => sc.para === n)
                .map((sc, k) => (
                  <SceneView key={`s${k}`} scene={sc} />
                ))}
              {pictureOf(n) && <ParagraphPicture picture={pictureOf(n)!} />}
              <p className="rd-para">
                {p.map((i) => (
                  <span key={i} id={`line-${text.id}-${i}`} className="sent" data-reading={reading === i || undefined} data-flash={flash === i || undefined}>
                    {sentence(i)}
                  </span>
                ))}
              </p>
              {view.translation === 'shown' && (
                <p className="rd-en-para">{p.map((i) => text.lines[i]!.en).filter(Boolean).join(' ')}</p>
              )}
            </Fragment>
          ))
        ) : (
          <ol className="rd-lines">
            {shownLines.map((i) => {
              const open = view.translation === 'shown' || revealed.has(i);
              const pic = paraStarts.has(i) ? pictureOf(paraStarts.get(i)!) : undefined;
              return (
                <Fragment key={i}>
                  {pic && (
                    <li className="rd-line-pic">
                      <ParagraphPicture picture={pic} />
                    </li>
                  )}
                  <li
                    id={`line-${text.id}-${i}`}
                    className="rd-line"
                    data-reading={reading === i || undefined}
                    data-flash={flash === i || undefined}
                    data-open={open || undefined}
                  >
                    <button
                      className="rd-n"
                      onClick={() => onReveal(i)}
                      aria-label={open ? `Hide the translation of line ${i + 1}` : `Show the translation of line ${i + 1}`}
                      aria-expanded={open}
                      disabled={view.translation === 'shown'}
                    >
                      {i + 1}
                    </button>
                    <div className="rd-line-body">
                      <p className="rd-line-zh sent">{sentence(i)}</p>
                      {open && <p className="rd-line-en">{text.lines[i]!.en}</p>}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>

      {story && (
        <StoryChoices
          textId={text.id}
          story={story}
          path={path}
          endings={text.endings ?? []}
          onChoose={(to) => setPath((p) => [...p, to])}
          onRestart={() => setPath([story.start])}
        />
      )}
    </article>
  );
}

