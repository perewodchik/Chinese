import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { wordId } from '../../domain/ids';
import type { Rng } from '../kit/rng';
import type { GameProps } from '../types';
import { AppProvider, type AppApi, type ReadKey } from './app';
import { glossaryOf, hskWords } from './gloss';
import { GuideSidebar } from './GuideSidebar';
import { GlossBody, HelpProvider, NativeSay, Popover, T, type HelpApi } from './help';
import { MiniApp } from './MiniApp';
import {
  check,
  defaultChoices,
  itemOf,
  lineText,
  logLookup,
  newHelpLog,
  newOrder,
  nextHint,
  price,
  shortForm,
  stepOf,
  usedHelp,
  wantText,
  type Hint,
  type View,
} from './order';
import { S } from './strings';
import { buildTasks } from './tasks';
import { markTourSeen, Tour, tourSeen } from './Tour';
import type { Brand, Miss, Order, ScreenId } from './types';
import { MenuPhoto } from './ui';
import './order-kit.css';

/**
 * One ordering game: the intro, then a few orders, each from a friend's
 * WeChat message to the pickup code — or the same mini-app with no task, to
 * look around.
 *
 * The order is checked at 去支付. Right: the payment sheet, then the pickup
 * screen, and the round is reported (first try only when no help was used —
 * §3.5 of the plan). Wrong: the friend says what is wrong, and the learner
 * goes back and fixes it; wrong again, and the round is missed and a card
 * shows what was asked beside what was ordered.
 */

type Mode = 'intro' | 'play' | 'browse';

interface Times {
  ordered: string;
  ready: string;
  minutes: number;
  code: string;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function makeTimes(rng: Rng): Times {
  const at = (8 + rng.int(11)) * 60 + rng.int(60);
  const minutes = 3 + rng.int(6);
  return { ordered: hhmm(at), ready: hhmm(at + minutes), minutes, code: String(1000 + rng.int(9000)) };
}

const READ_ASK: Record<ReadKey, string> = { code: S.askCode, total: S.askTotal, time: S.askTime, saved: S.askSaved };

/** The stage is side by side from this width; below it the guide is a drawer. */
const WIDE = 690;

export function OrderGame({ brand, ctx, rounds, report, finish }: GameProps & { brand: Brand }) {
  const gl = useMemo(() => glossaryOf(brand), [brand]);
  const [tasks] = useState(() => buildTasks(brand, ctx.rng, ctx.band, rounds));
  const [times] = useState(() => [...tasks.map(() => makeTimes(ctx.rng)), makeTimes(ctx.rng)]);

  const [mode, setMode] = useState<Mode>('intro');
  const [index, setIndex] = useState(0);
  const [order, setOrderState] = useState<Order>(newOrder);
  const [view, setView] = useState<View>({ screen: 'chat', sheet: null });
  const [dir, setDir] = useState<'push' | 'pop' | 'none'>('none');
  const [tries, setTries] = useState(0);
  const [log, setLog] = useState(newHelpLog);
  const [settled, setSettled] = useState(false);
  const [complaint, setComplaint] = useState<Miss[] | null>(null);
  const [missed, setMissed] = useState<Miss[] | null>(null);
  const [toast, setToastState] = useState<{ zh: string; id: number } | null>(null);
  const [pinyin, setPinyinState] = useState(false);
  const [tour, setTour] = useState(false);
  const [words, setWords] = useState(false);
  const [reading, setReading] = useState<AppApi['reading']>(null);
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [onScreen, setOnScreen] = useState<string[]>([]);
  const [floatHint, setFloatHint] = useState<string | null>(null);
  useEffect(() => {
    if (!floatHint) return;
    const t = window.setTimeout(() => setFloatHint(null), 6000);
    return () => window.clearTimeout(t);
  }, [floatHint]);
  // the hint is about the screen it was asked on
  useEffect(() => setFloatHint(null), [view.screen, view.sheet?.kind]);

  const task = mode === 'play' ? tasks[index] : null;
  const roundTimes = mode === 'play' ? times[index] : times[times.length - 1];

  /* --------------------------------------------------------------- toast */
  const toastTimer = useRef<number | null>(null);
  const toastFn = useCallback((zh: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToastState({ zh, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToastState(null), 1500);
  }, []);
  useEffect(() => () => void (toastTimer.current && window.clearTimeout(toastTimer.current)), []);

  /* -------------------------------------------------------------- moving */
  const go = useCallback(
    (v: View, d: 'push' | 'pop' | 'none' = 'none') => {
      // once the order is checked and paid for, it no longer changes
      if (settled && v.screen !== 'checkout' && v.screen !== 'pickup') return;
      if (settled && v.screen === 'checkout' && v.sheet?.kind !== 'pay') return;
      setView(v);
      setDir(d);
      if (v.sheet?.kind === 'spec') setLastItem(v.sheet.item);
      if (v.screen === 'menu' && !v.sheet && !tourSeen(brand)) setTour(true);
    },
    [settled, brand],
  );

  const reset = (m: Mode, i: number) => {
    setMode(m);
    setIndex(i);
    setOrderState(newOrder());
    setView({ screen: m === 'play' ? 'chat' : 'home', sheet: null });
    setDir('none');
    setTries(0);
    setLog(newHelpLog());
    setSettled(false);
    setComplaint(null);
    setMissed(null);
    setReading(null);
    setLastItem(null);
    setPinyinState(false);
  };

  /* ---------------------------------------------------------- the round */
  const describe = () => ({
    prompt: task!.message,
    answer: shortForm(brand, task!),
    // the things ordered first (咖啡, 面包), then the words of the message (杯, 冰, 要…)
    items: [
      ...new Set([
        ...task!.wants.flatMap((w) => (w.kind === 'line' ? (itemOf(brand, w.item).hsk ?? []) : [])),
        ...hskWords(task!.message, gl, () => true),
      ]),
    ]
      .filter((w) => ctx.lib.byWord.has(w))
      .map(wordId),
  });

  const submit = () => {
    if (!task) {
      setView({ screen: 'checkout', sheet: { kind: 'pay' } });
      return;
    }
    const r = check(brand, order, task);
    if (r.ok) {
      report({ ...describe(), correct: true, firstTry: tries === 0 && !usedHelp(log) });
      setSettled(true);
      setView({ screen: 'checkout', sheet: { kind: 'pay' } });
      return;
    }
    if (tries === 0) {
      setTries(1);
      setComplaint(r.misses);
    } else {
      report({ ...describe(), correct: false, firstTry: false });
      setSettled(true);
      setMissed(r.misses);
    }
  };

  const paid = () => {
    setView({ screen: 'pickup', sheet: null });
    setDir('push');
    if (task && task.level >= 2) {
      const bill = price(brand, order);
      const keys: ReadKey[] = ['code', 'total', 'time', ...(bill.discount > 0 ? (['saved'] as ReadKey[]) : [])];
      const key = keys[(index + Number(roundTimes.code)) % keys.length];
      setReading({ zh: READ_ASK[key], key, state: 'ask' });
    }
  };

  const nextRound = () => {
    if (mode === 'browse') return reset('browse', 0);
    if (index + 1 >= tasks.length) return finish();
    reset('play', index + 1);
  };

  const app: AppApi = {
    brand,
    order,
    setOrder: (fn) => !settled && setOrderState(fn),
    view,
    go,
    toast: toastFn,
    task,
    submit,
    paid,
    finishOrder: nextRound,
    times: roundTimes,
    reading,
    answer: (key) => setReading((r) => (r ? { ...r, state: r.key === key ? 'right' : 'wrong' } : r)),
    lastItem,
  };

  /* ----------------------------------------------------------------- help */
  const help: HelpApi = {
    gl,
    pinyin,
    native: ctx.native,
    looked: (zh) => mode === 'play' && !settled && setLog((l) => logLookup(l, zh)),
  };
  const setPinyin = (on: boolean) => {
    setPinyinState(on);
    if (on && mode === 'play' && !settled) setLog((l) => ({ ...l, pinyin: true }));
  };

  /* --------------------------------------------------------------- layout */
  const stage = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 640 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setSize({ w: el.clientWidth, h: Math.max(520, Math.min(860, window.innerHeight - top - 12)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mode]);
  const wide = size.w >= WIDE;

  /* ------------------------------------------------------- on this screen */
  const collect = useCallback(() => {
    const root = phone.current;
    if (!root) return;
    const sheets = root.querySelectorAll('.ok-sheet');
    const scopes: Element[] = sheets.length
      ? [root.querySelector('.ok-nav')!, sheets[sheets.length - 1]]
      : [root];
    const box = root.getBoundingClientRect();
    const seen: string[] = [];
    for (const scope of scopes) {
      for (const el of scope.querySelectorAll<HTMLElement>('[data-zh]')) {
        const zh = el.dataset.zh!;
        if (!zh.trim() || seen.includes(zh) || el.closest('.ok-tour')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < box.top || r.top > box.bottom || r.width === 0) continue;
        seen.push(zh);
      }
    }
    setOnScreen((prev) => (prev.join('|') === seen.join('|') ? prev : seen));
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(collect);
    return () => cancelAnimationFrame(id);
  });
  useEffect(() => {
    const root = phone.current;
    if (!root) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(collect);
    };
    root.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('scroll', onScroll, true);
    };
  }, [collect, mode]);

  /** Outline a control on the phone for a second, scrolled into view. */
  const pulse = (selector: string, hint?: Hint) => {
    const root = phone.current;
    if (!root) return;
    const all = [...root.querySelectorAll<HTMLElement>(selector)];
    const el = all.find((e) => e.getBoundingClientRect().width > 0) ?? all[0];
    // on a phone the drawer covers the phone: close it, and keep the hint in view over the nav bar
    if (!wide && hint) {
      setGuideOpen(false);
      setFloatHint(hint.en);
    }
    if (!el) return;
    const scroller = el.parentElement?.closest<HTMLElement>('.ok-list, .ok-scroll, .ok-spec-body, .ok-rail, .ok-cart-lines');
    if (scroller) {
      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (r.top < s.top || r.bottom > s.bottom) scroller.scrollTop += r.top - s.top - s.height / 3;
    }
    el.classList.remove('ok-pulse');
    void el.offsetWidth;
    el.classList.add('ok-pulse');
    window.setTimeout(() => el.classList.remove('ok-pulse'), 1000);
  };

  /* ------------------------------------------------------------- the map */
  const step = stepOf(view);
  const canGo = (s: ScreenId) => {
    if (s === 'pay' || s === 'pickup') return false;
    if (s === 'spec') return !!lastItem;
    if (s === 'cart') return order.lines.length > 0;
    if (s === 'checkout') return order.lines.length > 0;
    return true;
  };
  const goTo = (s: ScreenId) => {
    setComplaint(null);
    if (s === 'chat' || s === 'home') go({ screen: s, sheet: null }, 'pop');
    else if (s === 'menu') go({ screen: 'menu', sheet: null }, 'pop');
    else if (s === 'spec' && lastItem)
      go({ screen: 'menu', sheet: { kind: 'spec', item: lastItem, choices: defaultChoices(brand, itemOf(brand, lastItem)) } }, 'pop');
    else if (s === 'cart') go({ screen: 'menu', sheet: { kind: 'cart' } }, 'pop');
    else if (s === 'checkout') go({ screen: 'checkout', sheet: null }, 'pop');
  };

  /* ------------------------------------------------------------ rendering */
  if (mode === 'intro') {
    return (
      <HelpProvider value={help}>
        <Intro brand={brand} onPlay={() => reset('play', 0)} onBrowse={() => reset('browse', 0)} onWords={() => setWords(true)} />
        {words && <MenuWords brand={brand} onClose={() => setWords(false)} />}
        <Popover help={help} />
      </HelpProvider>
    );
  }

  const guide = (
    <GuideSidebar
      brand={brand}
      task={task}
      step={step}
      canGo={canGo}
      goTo={goTo}
      onScreen={onScreen}
      pulse={pulse}
      hint={() => {
        if (mode === 'play' && !settled) setLog((l) => ({ ...l, hints: l.hints + 1 }));
        return nextHint(brand, order, task, view);
      }}
      helpUsed={usedHelp(log)}
      lookups={Math.min(log.lookups.length, 2)}
      setPinyin={setPinyin}
      replayTour={() => {
        if (settled) return;
        setView({ screen: 'menu', sheet: null });
        setTour(true);
        if (!wide) setGuideOpen(false);
      }}
      showWords={() => setWords(true)}
      startOver={() => {
        setOrderState(newOrder());
        setView({ screen: 'home', sheet: null });
        setDir('pop');
        setComplaint(null);
      }}
      locked={settled}
    />
  );

  const overlay = (
    <>
      {complaint && (
        <div className="ok-modal-wrap">
          <div className="ok-modal" role="alertdialog" aria-label="Your friend says">
            <div className="ok-msg">
              <span className="ok-avatar" aria-hidden>
                {brand.friend.slice(-1)}
              </span>
              <div className="ok-bubble-stack">
                {complaint.slice(0, 3).map((m, i) => (
                  <div key={i} className="ok-bubble">
                    <T>{m.zh}</T>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" className="ok-btn block" onClick={() => setComplaint(null)} autoFocus>
              <T>{S.fine}</T>
            </button>
          </div>
        </div>
      )}
      {tour && view.screen === 'menu' && (
        <Tour
          brand={brand}
          phone={phone}
          onDone={() => {
            markTourSeen(brand);
            setTour(false);
          }}
        />
      )}
    </>
  );

  return (
    <HelpProvider value={help}>
      <AppProvider value={app}>
        <div
          ref={stage}
          className="ok-stage"
          data-wide={wide || undefined}
          style={{ '--ok-h': `${size.h}px`, '--brand': brand.colours.brand, '--brand-soft': brand.colours.soft, '--brand-ink': brand.colours.ink, '--brand-dark': brand.colours.darkBrand, '--brand-soft-dark': brand.colours.darkSoft } as React.CSSProperties}
        >
          <div className="ok-phone" ref={phone} data-pinyin={pinyin || undefined}>
            <MiniApp dir={dir} toast={toast} overlay={overlay} />
          </div>
          {wide ? (
            guide
          ) : (
            <>
              {floatHint && (
                <button type="button" className="ok-float-hint small" onClick={() => setFloatHint(null)}>
                  {floatHint}
                </button>
              )}
              <button type="button" className="ok-handle" aria-expanded={guideOpen} onClick={() => setGuideOpen(true)}>
                Guide
              </button>
              {guideOpen && <Drawer onClose={() => setGuideOpen(false)}>{guide}</Drawer>}
            </>
          )}
          {missed && task && (
            <DiffCard
              message={task.message}
              asked={task.wants.map((w) => wantText(brand, w))}
              got={[
                ...order.lines.map((l) => lineText(brand, l)),
                ...(order.dine ? [order.dine] : []),
                ...order.note.map((n) => `备注 ${n}`),
              ]}
              misses={missed}
              last={index + 1 >= tasks.length}
              onNext={nextRound}
            />
          )}
          {words && <MenuWords brand={brand} onClose={() => setWords(false)} />}
        </div>
        <Popover help={help} />
      </AppProvider>
    </HelpProvider>
  );
}

/* ---------------------------------------------------------------- drawer */

function Drawer({ onClose, children }: { onClose(): void; children: React.ReactNode }) {
  const start = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <div className="ok-drawer-wrap">
      <div className="ok-drawer-scrim" onClick={onClose} />
      <div
        className="ok-drawer"
        style={dx > 0 ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') start.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDx(Math.max(0, e.clientX - start.current));
        }}
        onPointerUp={() => {
          if (dx > 70) onClose();
          start.current = null;
          setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        <button type="button" className="btn ghost sm ok-drawer-close" onClick={onClose} aria-label="Close the guide">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- intro */

function Intro({ brand, onPlay, onBrowse, onWords }: { brand: Brand; onPlay(): void; onBrowse(): void; onWords(): void }) {
  return (
    <div className="ok-intro" style={{ '--brand': brand.colours.brand, '--brand-dark': brand.colours.darkBrand } as React.CSSProperties}>
      <div className="ok-intro-mark">
        <b className="hanzi">{brand.name}</b>
        <i>{brand.latin}</i>
      </div>
      <p>{brand.pitch}</p>
      <ul className="small ok-intro-rules">
        <li>A friend sends you an order on WeChat, in Chinese. The mini-app opens at its home page.</li>
        <li>Press and hold any Chinese on the phone to see its pinyin and meaning.</li>
        <li>
          The guide beside the phone shows where you are and what is on the screen. Using <span className="hanzi">拼</span>,{' '}
          <span className="hanzi">下一步</span> or looking up three or more words costs that order its first-try mark.
        </li>
      </ul>
      <div className="ok-intro-actions">
        <button type="button" className="btn primary" onClick={onPlay} autoFocus>
          Take orders
        </button>
        <button type="button" className="btn" onClick={onBrowse}>
          Just browse
        </button>
        <button type="button" className="btn ghost" onClick={onWords}>
          Menu words
        </button>
      </div>
      <p className="tiny muted">Just browse records nothing: leave it with ✕ when you are done.</p>
    </div>
  );
}

/* ------------------------------------------------------------ menu words */

function MenuWords({ brand, onClose }: { brand: Brand; onClose(): void }) {
  return (
    <div className="ok-words-wrap" role="dialog" aria-label="Menu words">
      <div className="ok-words">
        <div className="row">
          <h2>Menu words</h2>
          <span className="spacer" />
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close" autoFocus>
            ✕
          </button>
        </div>
        {brand.words.map((g) => (
          <section key={g.en}>
            <h3 className="ok-words-h">{g.en}</h3>
            <ul>
              {g.words.map((w) => {
                const item = brand.items.find((i) => i.zh === w || i.call === w);
                return (
                  <li key={w}>
                    {item ? <MenuPhoto brand={brand} photo={item.photo} className="words" /> : <span className="ok-words-nophoto" />}
                    <GlossBody zh={w} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- diff card */

function DiffCard({
  message,
  asked,
  got,
  misses,
  last,
  onNext,
}: {
  message: string;
  asked: string[];
  got: string[];
  misses: Miss[];
  last: boolean;
  onNext(): void;
}) {
  return (
    <div className="ok-diff-wrap">
      <div className="ok-diff" role="dialog" aria-label="Missed order">
        <h2>Not this time</h2>
        <p className="hanzi ok-diff-msg">{message}</p>
        <div className="ok-diff-cols">
          <div>
            <h3>They asked for</h3>
            <ul>
              {asked.map((a, i) => (
                <li key={i} className="hanzi">
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>You ordered</h3>
            <ul>
              {got.length ? (
                got.map((a, i) => (
                  <li key={i} className="hanzi">
                    {a}
                  </li>
                ))
              ) : (
                <li className="muted">nothing</li>
              )}
            </ul>
          </div>
        </div>
        <ul className="small ok-diff-why">
          {misses.map((m, i) => (
            <li key={i}>
              <span className="hanzi">{m.zh}</span> — {m.en}
              <NativeSay text={m.zh} />
            </li>
          ))}
        </ul>
        <button type="button" className="btn primary" onClick={onNext} autoFocus>
          {last ? 'See the results' : 'Next order'}
        </button>
      </div>
    </div>
  );
}
