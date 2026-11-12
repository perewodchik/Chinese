import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Library } from '../../data/types';
import { charId, type ItemId } from '../../domain/ids';
import { alignPinyin, charLevels as countLevels, paragraphs, stepsAbove, wordBands, type Token } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { itemForToken } from '../../domain/words';
import { pictureAbove } from '../../domain/pictures';
import { hskLabel, isHanzi, type GeneratedText } from '../../domain/text';
import { Link } from 'react-router';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useLevelOf, useWordLevel } from '../shared/levels';
import { LevelBar } from '../../ui/LevelMark';
import { useLibrary } from '../shared/library';
import { Comic } from './Comic';
import { ParagraphPicture, type PictureMark } from './ParagraphPicture';
import { SceneView } from './SceneView';
import { StoryChoices, StoryMap } from './StoryPath';
import { useHold } from './useHold';
import type { Peeked } from './WordPeek';
import type { PictureMode, PinyinMode, TranslationMode } from './readerView';
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
  /** the pictures above or beside the paragraphs */
  pictures: PictureMode;
  /** each paragraph's new words with their pinyin and meaning, in the margin or under it */
  glosses: boolean;
}

/** A word's pinyin and its first sense: the text's own list first, then the syllabus, the writer's notes, the character. */
function glossOf(lib: Library, text: GeneratedText, w: string): { py: string; d: string } | null {
  const own = text.vocab.find((v) => v.w === w);
  const found = own ?? lib.byWord.get(w) ?? text.glosses[w] ?? null;
  if (found) return { py: found.py, d: found.d };
  const c = [...w].length === 1 ? lib.byChar.get(w) : undefined;
  return c ? { py: c.py[0] ?? '', d: c.def } : null;
}
const firstSense = (d: string) => d.split(/;|\/|\s\|\s/)[0]!.trim();

/** Where a word stands for this reader: the marks and the pinyin follow it. */
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
 * Whether one of a text's words is done, for its Words part: you know it
 * (Known or Solid, from your answers, or set so in its drawer), or you have
 * put it on the shelf's list to learn. Either way you have dealt with it.
 */
export function useWordDone(study: ReadonlySet<ItemId>): (word: string) => boolean {
  const lib = useLibrary();
  const levelOfWord = useWordLevel();
  return useMemo(() => (w: string) => levelOfWord(w) >= 2 || study.has(itemForToken(lib, w)), [lib, levelOfWord, study]);
}

export { useWordLevel };

const KIND_LABEL: Record<NonNullable<GeneratedText['lines'][number]['kind']>, string> = {
  bubble: 'a speech bubble',
  caption: 'a caption',
  sfx: 'a sound effect',
  sign: 'writing in the picture',
  note: 'a footnote',
};

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
  /** a line pointed at on a comic's page photo: found and its English opened */
  onPoint?: (i: number) => void;
  /** this is the easier retelling of a book's text: a comic's page shows its lines */
  retold?: boolean;
  /** the shelf's own list of things being learned */
  study: ReadonlySet<ItemId>;
  /** above the title, when several passages share the page */
  heading?: ReactNode;
  /** the head as a book prints it: 第三章, the name, its English (`chapterHead`) */
  head: { kicker: string | null; zh: string; en: string };
  /** beside the title: the narrator's button */
  titleAction?: ReactNode;
  /** a word tapped, for its card; without it a tap opens the word drawer */
  onWord?: (p: Peeked & { key: string }) => void;
  /** the word whose card is open, by `line:token`: lit with the highlighter */
  peekKey?: string | null;
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
export function Passage({ text, view, reading, flash, revealed, onReveal, onPoint, retold, heading, head, titleAction, onWord, peekKey }: PassageProps) {
  const lib = useLibrary();
  const openItem = useOpenItem();

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
  const pictureOf = (n: number) => (story || view.pictures === 'off' ? undefined : pictureAbove(text, n));
  // A comic's page photo is what is being read, not an illustration: always large, with its spots.
  const beside = view.pictures === 'beside' && !text.lines.some((l) => l.box);
  const paraStarts = useMemo(() => new Map(paragraphs(text).map((p, n) => [p[0]!, n])), [text]);
  // A comic's lines, by the page (paragraph) whose photo they are on.
  const marks = useMemo(
    () =>
      paragraphs(text).map((p) =>
        p.flatMap((i): PictureMark[] => {
          const l = text.lines[i]!;
          return l.box ? [{ i, box: l.box, label: `Line ${i + 1}, ${KIND_LABEL[l.kind ?? 'bubble']}`, line: l }] : [];
        }),
      ),
    [text],
  );
  const comic = view.comic && (text.genre === 'dialogue' || text.lines.some((l) => l.who)) && !story;
  const layout = view.layout;
  const showTrad = view.traditional && text.lines.some((l) => l.zht);

  const ownWords = useMemo(() => new Set(text.vocab.map((w) => w.w)), [text.vocab]);
  const levelOfWord = useWordLevel();
  const levelOfId = useLevelOf();
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

  // The text's characters counted at each level, for its bar.
  const charLevels = useMemo(() => countLevels(text.lines.map((l) => l.zh), (c) => levelOfId(charId(c))), [text.lines, levelOfId]);
  // Its different characters met at least once, by your own answers: the same count as the bar under it.
  const charTotal = charLevels.reduce((a, b) => a + b, 0);
  // Under three in ten of its characters met, nearly everything would be underlined as new, and the red
  // pen would say nothing: nothing is underlined then, and the head says how to fix it (V8).
  const fewKnown = charTotal > 0 && (charTotal - charLevels[0]) / charTotal < 0.3;
  const band = useStore((st) => st.settings.hskBand);
  // The words not known yet, each once: what the head counts as new.
  const newWords = useMemo(() => {
    const seen = new Set<string>();
    for (const line of tokens) for (const t of line) if (t.word && levelOfWord(t.text) === 0) seen.add(t.text);
    return seen.size;
  }, [tokens, levelOfWord]);
  // Each paragraph's new words, each glossed once, where it first comes.
  const glosses = useMemo(() => {
    const seen = new Set<string>();
    return paras.map((p) =>
      p.flatMap((i) =>
        (tokens[i] ?? []).flatMap((t) => {
          if (!t.word || seen.has(t.text) || levelOfWord(t.text) !== 0) return [];
          seen.add(t.text);
          const g = glossOf(lib, text, t.text);
          return g ? [{ w: t.text, py: g.py, d: firstSense(g.d) }] : [];
        }),
      ),
    );
  }, [paras, tokens, levelOfWord, lib, text]);
  const hold = useHold(onReveal);
  // A learner at HSK 1–2 reads about seventy characters a minute, stopping on what is new.
  const minutes = Math.max(1, Math.round(text.lines.reduce((n, l) => n + [...l.zh].filter(isHanzi).length, 0) / 70));

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
      // How well the word is known now, 0 to 3, from review alone: only what is not known yet is marked and given its pinyin.
      const unknown = levelOfWord(t.text) === 0;
      const said: string[] = [];
      for (const ch of t.text) if (isHanzi(ch)) said.push(py[h++] ?? '');
      const showPy = view.pinyin === 'all' || (view.pinyin === 'new' && unknown);
      const step = view.markAbove ? stepsAbove(t, view.target) : 0;
      const mark = view.markUnknown && unknown && !fewKnown ? 'new' : undefined;
      const id = itemForToken(lib, t.text);
      const band = bands.get(t.text);
      const key = `${text.id}:${i}:${k}`;
      const open = (el: HTMLElement) => {
        if (!onWord) return openItem(id);
        const g = glossOf(lib, text, t.text);
        onWord({ key, word: t.text, id, el, py: g?.py ?? said.join(''), meaning: g ? firstSense(g.d) : '', band: band ?? null });
      };
      const word = (
        <span
          key={k}
          className="w"
          role="button"
          tabIndex={0}
          data-mark={mark}
          data-above={step || undefined}
          data-peek={peekKey === key || undefined}
          title={step && band ? `${t.text} · ${hskLabel(band)}` : undefined}
          onClick={(e) => open(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') open(e.currentTarget);
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
        {head.kicker && <p className="rd-chapter hanzi">{head.kicker}</p>}
        {/* The title in the middle, the narrator's button to its right, outside the centring. */}
        <div className="rd-title-row">
          <h1 className="rd-title hanzi">{head.zh}</h1>
          {titleAction}
        </div>
        {head.en && head.en !== head.zh && <p className="rd-subtitle">{head.en}</p>}
        <div className="rd-know" title={`Its characters: ${charLevels[3]} solid, ${charLevels[2]} known, ${charLevels[1]} met, ${charLevels[0]} not known yet`}>
          <span className="rd-meter" aria-hidden>
            <LevelBar levels={charLevels} />
          </span>
          <span>
            About {minutes} minute{minutes === 1 ? '' : 's'}.{' '}
            {fewKnown ? (
              // Little known yet is almost always little marked yet: say how, rather than a percentage.
              <Link className="rd-know-mark" to={paths.sweep(band <= 4 ? band : undefined)}>
                Mark what you know to see what is new
              </Link>
            ) : (
              <>
                You know {Math.round(((charTotal - charLevels[0]) / (charTotal || 1)) * 100)}% of it
                {newWords ? `, and ${newWords} word${newWords === 1 ? ' is' : 's are'} new.` : '.'}
              </>
            )}
          </span>
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
              {pictureOf(n) && !beside && <ParagraphPicture picture={pictureOf(n)!} size="large" marks={marks[n]} onMark={onPoint} retold={retold} />}
              {/* The paragraph, and beside it on a wide page (under it on a
                  narrower one) its English and its new words. */}
              <div className="rd-row">
                <p className="rd-para">
                  {pictureOf(n) && beside && <ParagraphPicture picture={pictureOf(n)!} size="beside" />}
                  {p.map((i) => (
                    <span
                      key={i}
                      id={`line-${text.id}-${i}`}
                      className="sent"
                      data-reading={reading === i || undefined}
                      data-flash={flash === i || undefined}
                      data-open={revealed.has(i) || undefined}
                      {...hold(i)}
                    >
                      {sentence(i)}
                    </span>
                  ))}
                </p>
                <aside className="rd-margin">
                  {view.translation === 'shown' ? (
                    <p className="rd-en-para">{p.map((i) => text.lines[i]!.en).filter(Boolean).join(' ')}</p>
                  ) : (
                    p
                      .filter((i) => revealed.has(i) && text.lines[i]!.en)
                      .map((i) => (
                        <button key={i} className="rd-en-held" onClick={() => onReveal(i)} aria-label="Hide this English">
                          {text.lines[i]!.en}
                        </button>
                      ))
                  )}
                  {view.glosses && glosses[n]!.length > 0 && (
                    <ul className="rd-glosses" lang="zh">
                      {glosses[n]!.map((g) => (
                        <li key={g.w}>
                          <span className="hanzi">{g.w}</span>
                          <span>
                            <b>{g.py}</b> <span lang="en">{g.d}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            </Fragment>
          ))
        ) : (
          <ol className="rd-lines">
            {shownLines.map((i) => {
              const open = view.translation === 'shown' || revealed.has(i);
              const pic = paraStarts.has(i) ? pictureOf(paraStarts.get(i)!) : undefined;
              return (
                <Fragment key={i}>
                  {pic && !beside && (
                    <li className="rd-line-pic">
                      <ParagraphPicture picture={pic} size="large" marks={marks[paraStarts.get(i)!]} onMark={onPoint} retold={retold} />
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
                      {pic && beside && <ParagraphPicture picture={pic} size="beside" />}
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

