import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Line } from '../core/dialogue/source';
import { Typed } from './Bubble';
import './bubble.css';
import { companionOptions, hintAnswer, phaseOf, translateAnswer } from './companionLines';
import { PixelIcon } from './PixelIcon';
import { Portrait } from './Portrait';
import { PropSprite } from './PropSprite';

type Show = { kind: 'say'; text: string } | { kind: 'translate' };

/**
 * His answer fills the box. (The learner, 2026-09-30: the rows of word chips with keep-stars
 * took too much room and "What did I learn?" was not worth it — both gone; the words of the
 * talk are tappable in the dialogue box itself, and a word card keeps a word.)
 */
const LINES = 5;

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
  talking,
  hat,
  onPat,
  onBlip,
  ask,
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
  talking: boolean;
  /** today's hat, drawn over his portrait too (X7) */
  hat: 'none' | 'snow' | 'flower' | 'armour';
  /** held down a moment: a pat on the head — he blushes */
  onPat: () => void;
  /** a soft sound as he answers (the page's sound level) */
  onBlip?: () => void;
  /**
   * A question of his that waits for your answer ("Before we go…", §13 Q1): his bubble opens by
   * itself with it, its choices in place of his options; Esc is the first choice.
   */
  ask?: { text: string; choices: readonly { id: string; label: string; run: () => void }[] } | null;
}) {
  const hold = useRef<number | undefined>(undefined);
  const patted = useRef(false);
  const self = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState<Show | null>(null);
  // each answer is a new one, even the same words twice (it types again)
  const [asked, setAsked] = useState(0);
  const answer = (s: Show) => {
    setShow(s);
    setAsked((n) => n + 1);
    onBlip?.();
  };
  // His little face (X7's pictures): thinking while he types.
  const [typing, setTyping] = useState(false);
  const rim = useRim(self, talking);
  // A new line of his own replaces whatever he was showing.
  useEffect(() => setShow(null), [said]);
  const current: Show = ask ? { kind: 'say', text: ask.text } : (show ?? (said ? { kind: 'say', text: said } : { kind: 'say', text: talking ? 'Yes? Ask me anything.' : 'Yes?' }));
  const shown = open || !!ask;

  const line = turn.at(-1);
  const phase = phaseOf(talking, line);
  const options = companionOptions(
    { phase, canHint },
    {
      translate: line ? () => answer({ kind: 'translate' }) : undefined,
      hint: () => {
        onHint();
        answer({ kind: 'say', text: hintAnswer(hintStep + 1) });
      },
      now: () => answer({ kind: 'say', text: now() }),
    },
  );

  // his question's choices stand in for his options while it waits
  const choices = ask ? ask.choices.map((c) => ({ id: c.id, icon: null, label: c.label, run: c.run })) : options;
  // While open: 1 / 2 / 3 pick, Esc closes (before the talk hears it; a question: its first choice), a tap outside closes.
  const keys = useRef(choices);
  keys.current = choices;
  const asking = useRef(ask);
  asking.current = ask;
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (asking.current) asking.current.choices[0]?.run();
        else setOpen(false);
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
      if (!asking.current && self.current && !self.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [shown, setOpen]);

  const text = current.kind === 'say' ? current.text : current.kind === 'translate' && line ? translateAnswer(turn, why, speakerName) : '';
  // over his head: "!" when he has something to say, "?" when you are stuck and he can help, "…" while he types
  const mark = !shown && said ? 'says' : !shown && stuck ? 'help' : shown && typing ? 'thinking' : null;

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
      </button>
      {shown && (
        <div className="wb" role="dialog" aria-label="兔儿爷 says" data-ask={ask ? '' : undefined}>
          <span className="wb-tail" aria-hidden />
          <div className="wb-say">
            <Typed key={ask ? `ask-${ask.text}` : asked} text={text} lines={LINES} onBusy={setTyping} />
          </div>
          <div className="wb-opts">
            {choices.map((o, i) => (
              <button key={o.id} type="button" onClick={o.run} data-main={ask && i === choices.length - 1 ? '' : undefined}>
                {o.icon && <PixelIcon name={o.icon} />}
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
