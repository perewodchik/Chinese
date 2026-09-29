import { useEffect, useMemo, useRef, useState } from 'react';
import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { BEIJING_PRESET, keepBeijingWord } from '../../store/wordCommands';
import type { Lexicon } from '../core/dialogue/lexicon';
import type { Line } from '../core/dialogue/source';
import { FitChips, Typed } from './Bubble';
import './bubble.css';
import { companionOptions, glossLine, hintAnswer, keepable, phaseOf, translateAnswer, type Gloss } from './companionLines';
import { voice } from './Dialogue';
import { PixelIcon } from './PixelIcon';
import { Portrait } from './Portrait';
import { PropSprite } from './PropSprite';

type Show = { kind: 'say'; text: string } | { kind: 'translate' } | { kind: 'learned' };

/** a plain answer fills the box; one with words keeps two lines for them */
const LINES_ALONE = 5;
const LINES_WITH_WORDS = 2;

/**
 * 兔儿爷, in the corner (concept §9, prompt §11). Tap him (or Tab) and his
 * speech bubble opens to his side: his answer, typed out, over one row of at
 * most three things you can ask him for the moment (`companionOptions`) —
 * 1 / 2 / 3 pick one, Esc or a tap outside closes it. The bubble is the same
 * size for every answer; nothing in it scrolls. Everything is free. He speaks
 * up by himself only when the page gives him a `said` line.
 */
export function Companion({
  open,
  setOpen,
  said,
  line,
  why,
  canHint,
  hintStep,
  onHint,
  now,
  lex,
  talking,
  hat,
  onPat,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  /** a line he says by himself, shown when he opens */
  said: string | null;
  /** the latest line in the conversation */
  line: Line | undefined;
  why: string | undefined;
  canHint: boolean;
  /** how far the hint has gone at this line (0–3) */
  hintStep: number;
  onHint: () => void;
  now: () => string;
  lex: Lexicon;
  talking: boolean;
  /** today's hat, drawn over his portrait too (X7) */
  hat: 'none' | 'snow' | 'flower' | 'armour';
  /** held down a moment: a pat on the head — he blushes */
  onPat: () => void;
}) {
  const hold = useRef<number | undefined>(undefined);
  const patted = useRef(false);
  const self = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [show, setShow] = useState<Show | null>(null);
  const [again, setAgain] = useState<{ line: Line | undefined; n: number }>({ line: undefined, n: 0 });
  // each answer is a new one, even the same words twice (it types again)
  const [asked, setAsked] = useState(0);
  const answer = (s: Show) => {
    setShow(s);
    setAsked((n) => n + 1);
  };
  // A new line of his own replaces whatever he was showing.
  useEffect(() => setShow(null), [said]);
  const current: Show = show ?? (said ? { kind: 'say', text: said } : { kind: 'say', text: talking ? 'Yes? Ask me anything.' : 'Yes?' });

  // The words of the talk you are in (or just had): "What did I learn?" after it.
  const [talkWords, setTalkWords] = useState<Gloss[]>([]);
  useEffect(() => {
    if (talking) setTalkWords([]);
  }, [talking]);
  useEffect(() => {
    if (!talking || !line) return;
    const add = keepable(glossLine(line, lex));
    setTalkWords((ws) => [...ws, ...add.filter((g) => !ws.some((w) => w.w === g.w))]);
  }, [talking, line, lex]);

  // Kept is what "Words from Beijing" holds, so a star stays lit on every device.
  const beijing = useStore((s) => s.collections.find((c) => c.presetId === BEIJING_PRESET));
  const kept = useMemo(() => new Set((beijing?.words ?? []).map((w) => w.w)), [beijing]);
  const keep = (g: Gloss) => {
    if (kept.has(g.w)) return;
    keepBeijingWord({ w: g.w, py: g.py, d: g.en, hsk: lib.byWord.get(g.w)?.hsk ?? null, explain: '', examples: [] });
  };

  const phase = phaseOf(talking, line);
  const options = companionOptions(
    { phase, canHint, learned: talkWords.length > 0 },
    {
      again: line
        ? () => {
            const n = again.line === line ? again.n + 1 : 1;
            setAgain({ line, n });
            voice(line, n > 1);
            answer({ kind: 'say', text: n > 1 ? 'Once more, slowly.' : 'Listen again.' });
          }
        : undefined,
      translate: line ? () => answer({ kind: 'translate' }) : undefined,
      hint: () => {
        onHint();
        answer({ kind: 'say', text: hintAnswer(hintStep + 1) });
      },
      now: () => answer({ kind: 'say', text: now() }),
      learned: () => answer({ kind: 'learned' }),
    },
  );

  // While open: 1 / 2 / 3 pick, Esc closes (before the talk hears it), a tap outside closes.
  const keys = useRef(options);
  keys.current = options;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const i = ['1', '2', '3'].indexOf(e.key);
      const o = keys.current[i];
      if (i >= 0 && o && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        o.run();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (self.current && !self.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, setOpen]);

  const chip = (g: Gloss) => (
    <>
      <button type="button" className="wb-w" onClick={() => openItem(itemForToken(lib, g.w))} title={g.en || undefined}>
        <span className="han">{g.w}</span>
        {g.py && <span className="wb-py">{g.py}</span>}
      </button>
      <button
        type="button"
        className="wb-star"
        aria-pressed={kept.has(g.w)}
        aria-label={kept.has(g.w) ? `${g.w} is kept in Words from Beijing` : `Keep ${g.w}`}
        onClick={() => keep(g)}
      >
        <PixelIcon name={kept.has(g.w) ? 'star-full' : 'star'} size={18} />
      </button>
    </>
  );
  const words = (list: Gloss[]) => (
    <FitChips
      items={list}
      keyOf={(g) => g.w}
      render={chip}
      more={(hidden) => (
        <button type="button" className="wb-plus" onClick={() => openItem(itemForToken(lib, hidden[0]!.w))} aria-label={`${hidden.length} more words`}>
          +{hidden.length}
        </button>
      )}
    />
  );

  const text =
    current.kind === 'say'
      ? current.text
      : current.kind === 'translate' && line
        ? translateAnswer(line, why)
        : current.kind === 'learned'
          ? 'From that talk. Tap the star to keep a word.'
          : '';
  const list = current.kind === 'translate' && line ? keepable(glossLine(line, lex)) : current.kind === 'learned' ? talkWords : null;

  return (
    <div className="wc" ref={self} data-talking={talking ? '' : undefined}>
      <button
        type="button"
        className="wc-rabbit"
        aria-expanded={open}
        aria-label="兔儿爷 — help (Tab)"
        data-says={!open && said ? '' : undefined}
        onPointerDown={() => {
          patted.current = false;
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => {
            patted.current = true;
            onPat();
          }, 500);
        }}
        onPointerUp={() => window.clearTimeout(hold.current)}
        onPointerCancel={() => window.clearTimeout(hold.current)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          // a pat is not a call for help
          if (patted.current) return;
          setShow(null);
          setOpen(!open);
        }}
        title="Tap for help — hold to pat him"
      >
        <Portrait sprite="rabbit" scale={3} />
        {hat !== 'none' && (
          <span className="wc-hat">
            <PropSprite frame={`rabbit-hat/${hat}`} scale={3} />
          </span>
        )}
      </button>
      {open && (
        <div className="wb" role="dialog" aria-label="兔儿爷 says">
          <span className="wb-tail" aria-hidden />
          <div className="wb-say">
            <Typed key={asked} text={text} lines={list ? LINES_WITH_WORDS : LINES_ALONE} />
            {list && words(list)}
          </div>
          <div className="wb-opts">
            {options.map((o, i) => (
              <button key={o.id} type="button" onClick={o.run}>
                <PixelIcon name={o.icon} />
                <span>{o.label}</span>
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
