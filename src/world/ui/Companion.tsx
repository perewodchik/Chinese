import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { itemForToken } from '../../domain/words';
import { useLibrary } from '../../features/shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { useStore } from '../../store/store';
import { BEIJING_PRESET, keepBeijingWord } from '../../store/wordCommands';
import type { Lexicon } from '../core/dialogue/lexicon';
import type { Line } from '../core/dialogue/source';
import { EMOTE_MS } from '../core/rabbit';
import { FitChips, Typed } from './Bubble';
import './bubble.css';
import { companionOptions, glossTurn, hintAnswer, keepable, phaseOf, translateAnswer, type Gloss } from './companionLines';
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
 * the meaning of their whole turn, a hint, what now; asking *them* again is
 * said in the talk (「再说一遍」), not asked of him —
 * 1 / 2 / 3 pick one, Esc or a tap outside closes it. The bubble is the same
 * size for every answer; nothing in it scrolls. Everything is free. He speaks
 * up by himself only when the page gives him a `said` line.
 */
export function Companion({
  open,
  setOpen,
  said,
  turn,
  speakerName,
  why,
  canHint,
  stuck,
  hintStep,
  onHint,
  now,
  lex,
  talking,
  hat,
  onPat,
  onBlip,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  /** a line he says by himself, shown when he opens */
  said: string | null;
  /** their turn: every line since your last reply (empty before they speak, or out of a talk) */
  turn: readonly Line[];
  /** a speaker's name, for a turn two people speak in */
  speakerName?: (speaker: string) => string | null;
  why: string | undefined;
  canHint: boolean;
  /** missed at a line where a hint is left: a "?" over his head says help is here */
  stuck?: boolean;
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
  /** a soft sound as he answers (the page's sound level) */
  onBlip?: () => void;
}) {
  const hold = useRef<number | undefined>(undefined);
  const patted = useRef(false);
  const self = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const openItem = useOpenItem();
  const [show, setShow] = useState<Show | null>(null);
  // each answer is a new one, even the same words twice (it types again)
  const [asked, setAsked] = useState(0);
  const answer = (s: Show) => {
    setShow(s);
    setAsked((n) => n + 1);
    onBlip?.();
  };
  // His little faces (X7's pictures): thinking while he types, glad at a kept word.
  const [typing, setTyping] = useState(false);
  const [glad, setGlad] = useState(0);
  useEffect(() => {
    if (!glad) return;
    const t = window.setTimeout(() => setGlad(0), EMOTE_MS);
    return () => window.clearTimeout(t);
  }, [glad]);
  const rim = useRim(self, talking);
  // A new line of his own replaces whatever he was showing.
  useEffect(() => setShow(null), [said]);
  const current: Show = show ?? (said ? { kind: 'say', text: said } : { kind: 'say', text: talking ? 'Yes? Ask me anything.' : 'Yes?' });

  // The words of the talk you are in (or just had): "What did I learn?" after it.
  const [talkWords, setTalkWords] = useState<Gloss[]>([]);
  useEffect(() => {
    if (talking) setTalkWords([]);
  }, [talking]);
  useEffect(() => {
    if (!talking || !turn.length) return;
    const add = keepable(glossTurn(turn, lex));
    setTalkWords((ws) => {
      const fresh = add.filter((g) => !ws.some((w) => w.w === g.w));
      return fresh.length ? [...ws, ...fresh] : ws;
    });
  }, [talking, turn, lex]);

  // Kept is what "Words from Beijing" holds, so a star stays lit on every device.
  const beijing = useStore((s) => s.collections.find((c) => c.presetId === BEIJING_PRESET));
  const kept = useMemo(() => new Set((beijing?.words ?? []).map((w) => w.w)), [beijing]);
  const keep = (g: Gloss) => {
    if (kept.has(g.w)) return;
    keepBeijingWord({ w: g.w, py: g.py, d: g.en, hsk: lib.byWord.get(g.w)?.hsk ?? null, explain: '', examples: [] });
    setGlad(Date.now());
  };

  const line = turn.at(-1);
  const phase = phaseOf(talking, line);
  const options = companionOptions(
    { phase, canHint, learned: talkWords.length > 0 },
    {
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
        ? translateAnswer(turn, why, speakerName)
        : current.kind === 'learned'
          ? 'From that talk. Tap the star to keep a word.'
          : '';
  const list = current.kind === 'translate' && line ? keepable(glossTurn(turn, lex)) : current.kind === 'learned' ? talkWords : null;
  // over his head: "!" when he has something to say, "?" when you are stuck and he can help, "…" while he types
  const mark = !open && said ? 'says' : !open && stuck ? 'help' : open && typing ? 'thinking' : null;

  return (
    <div
      className="wc"
      ref={self}
      data-talking={talking ? '' : undefined}
      style={rim ? { transform: `translate(${rim.x}px, ${rim.y}px)` } : undefined}
    >
      <button
        type="button"
        className="wc-rabbit"
        aria-expanded={open}
        aria-label={!open && said ? '兔儿爷 has something to say (Tab)' : !open && stuck ? '兔儿爷 can help you answer (Tab)' : '兔儿爷 — help (Tab)'}
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
          if (!open && said) onBlip?.();
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
        {mark && (
          <span key={mark} className="wc-mark" data-kind={mark} aria-hidden>
            <i />
          </span>
        )}
        {!mark && glad > 0 && (
          <span key={glad} className="wc-emote" aria-hidden>
            <PropSprite frame="emote/happy" scale={2} />
          </span>
        )}
      </button>
      {open && (
        <div className="wb" role="dialog" aria-label="兔儿爷 says">
          <span className="wb-tail" aria-hidden />
          <div className="wb-say">
            <Typed key={asked} text={text} lines={list ? LINES_WITH_WORDS : LINES_ALONE} onBusy={setTyping} />
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

/** how long his hop onto the dialogue box's rim takes */
const HOP_MS = 250;

/**
 * Where he sits during a talk: on the top-left rim of the dialogue box, as
 * an offset from his corner (a transform, so nothing else moves). He hops
 * there in a small arc when a talk opens and back down when it closes; if
 * the box moves (the iPad's keyboard lifts it), he goes with it.
 */
function useRim(self: RefObject<HTMLDivElement | null>, talking: boolean): { x: number; y: number } | null {
  const [rim, setRim] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!talking) {
      setRim(null);
      return;
    }
    const wc = self.current;
    const shell = wc?.parentElement;
    if (!wc || !shell) return;
    const measure = () => {
      const box = shell.querySelector('.wd');
      if (!box) return;
      const s = shell.getBoundingClientRect();
      const d = box.getBoundingClientRect();
      const rabbit = wc.firstElementChild as HTMLElement | null;
      // his corner, untransformed: offsets ignore the transform
      const left = wc.offsetLeft;
      const bottom = wc.offsetTop + wc.offsetHeight;
      const h = rabbit?.offsetHeight ?? 56;
      // feet on the rim, a little in from its corner; never above the top of the game
      const y = Math.max(d.top - s.top + 1, h + 4) - bottom;
      const x = d.left - s.left + 10 - left;
      setRim((r) => (r && Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1 ? r : { x: Math.round(x), y: Math.round(y) }));
    };
    measure();
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const box = shell.querySelector('.wd');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null;
    ro?.observe(shell);
    if (box) ro?.observe(box);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', later);
    vv?.addEventListener('scroll', later);
    window.addEventListener('resize', later);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      vv?.removeEventListener('resize', later);
      vv?.removeEventListener('scroll', later);
      window.removeEventListener('resize', later);
    };
  }, [self, talking]);

  // The hop: an arc between the corner and the rim, only when he changes place.
  const was = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const from = was.current ?? { x: 0, y: 0 };
    const to = rim ?? { x: 0, y: 0 };
    const moved = !!was.current !== !!rim;
    was.current = rim;
    const el = self.current;
    if (!moved || !el?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const at = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;
    const top = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 28 };
    el.animate([{ transform: at(from) }, { transform: at(top), offset: 0.55 }, { transform: at(to) }], { duration: HOP_MS, easing: 'ease-out' });
  }, [rim, self]);
  return rim;
}
