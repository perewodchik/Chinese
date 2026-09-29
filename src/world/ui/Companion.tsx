import { useEffect, useMemo, useRef, useState } from 'react';
import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { BEIJING_PRESET, keepBeijingWord } from '../../store/wordCommands';
import type { Lexicon } from '../core/dialogue/lexicon';
import type { Line } from '../core/dialogue/source';
import { companionOptions, glossLine, hintAnswer, keepable, phaseOf, translateAnswer, type Gloss } from './companionLines';
import { voice } from './Dialogue';
import { PixelIcon } from './PixelIcon';
import { Portrait } from './Portrait';
import { PropSprite } from './PropSprite';

type Show = { kind: 'say'; text: string } | { kind: 'translate' } | { kind: 'learned' };

/**
 * 兔儿爷, in the corner (concept §9, prompt §11): tap him (or Tab) and you
 * can ask him at most three things that fit the moment — options that do
 * not apply are left out (`companionOptions`). He answers in English.
 * Everything is free. He speaks up by himself only when the page gives him
 * a `said` line (two misses in a row, a long idle minute during a quest).
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
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [show, setShow] = useState<Show | null>(null);
  const [again, setAgain] = useState<{ line: Line | undefined; n: number }>({ line: undefined, n: 0 });
  // A new line of his own replaces whatever he was showing.
  useEffect(() => setShow(null), [said]);
  const current: Show | null = show ?? (said ? { kind: 'say', text: said } : null);

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
            setShow({ kind: 'say', text: n > 1 ? 'Once more, slowly.' : 'Listen again.' });
          }
        : undefined,
      translate: line ? () => setShow({ kind: 'translate' }) : undefined,
      hint: () => {
        onHint();
        setShow({ kind: 'say', text: hintAnswer(hintStep + 1) });
      },
      now: () => setShow({ kind: 'say', text: now() }),
      learned: () => setShow({ kind: 'learned' }),
    },
  );

  const chips = (words: Gloss[]) => (
    <div className="wc-words">
      {words.map((g) => (
        <span key={g.w} className="wc-word">
          <button type="button" onClick={() => openItem(itemForToken(lib, g.w))} title={g.en || undefined}>
            <span className="han">{g.w}</span> <span className="wi-chip-py">{g.py}</span>
          </button>
          <button type="button" aria-pressed={kept.has(g.w)} aria-label={kept.has(g.w) ? `${g.w} is kept` : `Keep ${g.w}`} onClick={() => keep(g)}>
            <PixelIcon name={kept.has(g.w) ? 'star-full' : 'star'} />
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="wc" data-talking={talking ? '' : undefined}>
      {open && (
        <div className="wc-panel" role="dialog" aria-label="兔儿爷, your companion">
          <div className="wc-out">
            {current?.kind === 'say' && <p>{current.text}</p>}
            {current?.kind === 'translate' && line && (
              <>
                <p style={{ whiteSpace: 'pre-line' }}>{translateAnswer(line, why)}</p>
                {chips(keepable(glossLine(line, lex)))}
              </>
            )}
            {current?.kind === 'learned' && (
              <>
                <p>From that talk — tap the star to keep a word.</p>
                {chips(talkWords)}
              </>
            )}
            {!current && <p className="muted">Yes?</p>}
          </div>
          <div className="wc-acts">
            {options.map((o) => (
              <button key={o.id} type="button" onClick={o.run}>
                <PixelIcon name={o.icon} /> {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
    </div>
  );
}
