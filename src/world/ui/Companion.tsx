import { useEffect, useState } from 'react';
import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { keepBeijingWord } from '../../store/wordCommands';
import type { Lexicon } from '../core/dialogue/lexicon';
import type { Line } from '../core/dialogue/source';
import { glossLine, whyText } from './companionLines';
import { voice } from './Dialogue';
import { Portrait } from './Portrait';

type Show = { kind: 'say'; text: string } | { kind: 'translate' } | { kind: 'keep' };

/**
 * 兔儿爷, in the corner (concept §9): tap him (or Tab) for one row of help —
 * Again, Translate, Why?, What do I say?, What now?, Keep — and he answers
 * in English above it. Everything is free. He speaks up by himself only
 * when the page gives him a `said` line (two misses in a row, a long idle
 * minute during a quest).
 */
export function Companion({
  open,
  setOpen,
  said,
  line,
  why,
  canHint,
  onHint,
  now,
  lex,
  talking,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  /** a line he says by himself, shown when he opens */
  said: string | null;
  /** the latest line in the conversation */
  line: Line | undefined;
  why: string | undefined;
  canHint: boolean;
  onHint: () => void;
  now: () => string;
  lex: Lexicon;
  talking: boolean;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [show, setShow] = useState<Show | null>(null);
  const [again, setAgain] = useState<{ line: Line | undefined; n: number }>({ line: undefined, n: 0 });
  const [kept, setKept] = useState<Set<string>>(new Set());
  // A new line of his own replaces whatever he was showing.
  useEffect(() => setShow(null), [said]);
  const current: Show | null = show ?? (said ? { kind: 'say', text: said } : null);

  const glosses = line ? glossLine(line, lex) : [];
  const keep = (w: string, py: string, en: string) => {
    keepBeijingWord({ w, py, d: en, hsk: lib.byWord.get(w)?.hsk ?? null, explain: '', examples: [] });
    setKept((k) => new Set(k).add(w));
  };

  return (
    <div className="wc" data-talking={talking ? '' : undefined}>
      {open && (
        <div className="wc-panel" role="dialog" aria-label="兔儿爷, your companion">
          <div className="wc-out">
            {current?.kind === 'say' && <p>{current.text}</p>}
            {current?.kind === 'translate' && line && (
              <>
                <p>“{line.en}”</p>
                <div className="wc-words">
                  {glosses.map((g) => (
                    <button key={g.w} type="button" className="wc-word" onClick={() => openItem(itemForToken(lib, g.w))}>
                      <span className="han">{g.w}</span> <span className="wi-chip-py">{g.py}</span>
                      {g.en && <span className="tiny"> {g.en}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            {current?.kind === 'keep' && (
              <>
                <p className="tiny">Tap a word to keep it in “Words from Beijing”.</p>
                <div className="wc-words">
                  {glosses.map((g) => (
                    <button
                      key={g.w}
                      type="button"
                      className="wc-word"
                      aria-pressed={kept.has(g.w)}
                      onClick={() => keep(g.w, g.py, g.en)}
                      disabled={kept.has(g.w)}
                    >
                      <span className="han">{g.w}</span> <span className="wi-chip-py">{g.py}</span>
                      {kept.has(g.w) && ' ✓'}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!current && <p className="muted">What do you need?</p>}
          </div>
          <div className="wc-acts">
            <button
              type="button"
              disabled={!line}
              onClick={() => {
                if (!line) return;
                const n = again.line === line ? again.n + 1 : 1;
                setAgain({ line, n });
                voice(line, n > 1);
                setShow({ kind: 'say', text: n > 1 ? 'Once more, slowly.' : `Again — ${line.zh}` });
              }}
            >
              🔁 Again
            </button>
            <button type="button" disabled={!line} onClick={() => setShow({ kind: 'translate' })}>
              Translate
            </button>
            <button type="button" disabled={!line} onClick={() => setShow({ kind: 'say', text: whyText(why, line) })}>
              Why?
            </button>
            <button
              type="button"
              disabled={!talking || !canHint}
              onClick={() => {
                onHint();
                setShow({ kind: 'say', text: 'Look above the field — tap the chips to use them.' });
              }}
            >
              What do I say?
            </button>
            <button type="button" onClick={() => setShow({ kind: 'say', text: now() })}>
              What now?
            </button>
            <button type="button" disabled={!line} onClick={() => setShow({ kind: 'keep' })}>
              Keep
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="wc-rabbit"
        aria-expanded={open}
        aria-label="兔儿爷 — help (Tab)"
        data-says={!open && said ? '' : undefined}
        onClick={() => {
          setShow(null);
          setOpen(!open);
        }}
      >
        <Portrait sprite="rabbit" scale={3} />
      </button>
    </div>
  );
}
