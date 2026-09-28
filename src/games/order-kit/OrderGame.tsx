import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { wordId } from '../../domain/ids';
import type { Rng } from '../kit/rng';
import type { GameProps } from '../types';
import { AppProvider, type AppApi, type ReadKey } from './app';
import { glossaryOf, hskWords } from './gloss';
import { GuideSidebar } from './GuideSidebar';
import { HelpProvider, NativeSay, Popover, T, type HelpApi } from './help';
import { MiniApp } from './MiniApp';
import {
  check,
  defaultChoices,
  itemOf,
  lineText,
  newOrder,
  allLines,
  goalOf,
  nextHint,
  price,
  shortForm,
  stepOf,
  wantText,
  type Hint,
  type View,
} from './order';
import { S } from './strings';
import { buildTasks } from './tasks';
import { markTourSeen, Tour, tourSeen } from './Tour';
import type { Brand, Miss, Order, ScreenId } from './types';
import { MenuWordList, WordPicks } from './words';
import './order-kit.css';

/**
 * One ordering game: the intro, then a few orders, each from a friend's
 * WeChat message to the pickup code — or the same mini-app with no task, to
 * look around.
 *
 * The order is checked at 去支付. Right: the payment sheet, then the pickup
 * screen, and the round is reported. Help is free: the guide, 拼 and 下一步
 * are there to be used, and cost nothing. Wrong: the friend says what is
 * wrong, and the learner goes back and fixes it; wrong again, and the round
 * is missed and a card shows what was asked beside what was ordered.
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

/** The stage is side by side from this width; below it the guide is a drawer. */
const WIDE = 690;

const CAPSULE_KEY = 'hanzi-workshop/order-capsule-told';

export function OrderGame({ brand, ctx, rounds, report, finish, words: wordHost, leave }: GameProps & { brand: Brand }) {
  const gl = useMemo(() => glossaryOf(brand), [brand]);
  const [tasks] = useState(() => buildTasks(brand, ctx.rng, ctx.band, rounds));
  const [times] = useState(() => [...tasks.map(() => makeTimes(ctx.rng)), makeTimes(ctx.rng)]);

  const [mode, setMode] = useState<Mode>('intro');
  const [index, setIndex] = useState(0);
  const [order, setOrderState] = useState<Order>(newOrder);
  const [view, setView] = useState<View>({ screen: 'chat', sheet: null });
  const [dir, setDir] = useState<'push' | 'pop' | 'none'>('none');
  const [tries, setTries] = useState(0);
  const [settled, setSettled] = useState(false);
  // table service: which message is in play, whether the 加菜 one is done, and its pop-up
  const [part, setPart] = useState<0 | 1>(0);
  const [laterDone, setLaterDone] = useState(false);
  const [laterPopup, setLaterPopup] = useState(false);
  const [complaint, setComplaint] = useState<Miss[] | null>(null);
  const [missed, setMissed] = useState<Miss[] | null>(null);
  const [toast, setToastState] = useState<{ zh: string; id: number } | null>(null);
  const [pinyin, setPinyinState] = useState(false);
  const [tour, setTour] = useState(false);
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
  const later = task?.later && part === 1 ? task.later : null;
  const table = brand.model === 'table';
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
      // once the order is checked, it no longer changes: only paying and the last screens are left
      if (settled) {
        const ok =
          v.screen === 'pickup' || v.screen === 'table' || v.screen === 'bill' || (v.screen === 'checkout' && v.sheet?.kind === 'pay');
        if (!ok) return;
      }
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
    setView({ screen: m === 'play' ? 'chat' : brand.model === 'table' ? 'landing' : 'home', sheet: null });
    setPart(0);
    setLaterDone(false);
    setLaterPopup(false);
    setDir('none');
    setTries(0);
    setSettled(false);
    setComplaint(null);
    setMissed(null);
    setReading(null);
    setLastItem(null);
    setPinyinState(false);
  };

  /* ---------------------------------------------------------- the round */
  const describe = () => {
    const t = task!;
    const wants = [...t.wants, ...(t.later?.wants ?? [])];
    const text = t.later ? `${t.message} ${t.later.message}` : t.message;
    return {
      prompt: text,
      answer: shortForm(brand, t),
      // the things ordered first (咖啡, 饺子), then the words of the messages (杯, 冰, 要…)
      items: [
        ...new Set([
          ...wants.flatMap((w) => (w.kind === 'line' ? (itemOf(brand, w.item).hsk ?? []) : [])),
          ...hskWords(text, gl, () => true),
        ]),
      ]
        .filter((w) => ctx.lib.byWord.has(w))
        .map(wordId),
    };
  };

  /** A check came back wrong: the friend says so once; the second time, the round is missed. */
  const wrong = (misses: Miss[]) => {
    if (tries === 0) {
      setTries(1);
      setComplaint(misses);
    } else {
      report({ ...describe(), correct: false, firstTry: false });
      setSettled(true);
      setMissed(misses);
    }
  };
  const right = () => {
    report({ ...describe(), correct: true, firstTry: tries === 0 });
    setSettled(true);
  };

  /** Table service: this batch goes to the kitchen. */
  const sendBatch = () => {
    setOrderState((o) => ({ ...o, placed: [...o.placed, o.lines], lines: [] }));
    setView({ screen: 'table', sheet: null });
    setDir('push');
    toastFn(S.placed);
  };

  const submit = () => {
    if (!task) {
      if (table) sendBatch();
      else setView({ screen: 'checkout', sheet: { kind: 'pay' } });
      return;
    }
    if (!table) {
      const r = check(brand, order, task.wants);
      if (!r.ok) return wrong(r.misses);
      right();
      setView({ screen: 'checkout', sheet: { kind: 'pay' } });
      return;
    }
    const wants = part === 0 ? task.wants : task.later!.wants;
    const r = check(brand, order, wants);
    if (!r.ok) return wrong(r.misses);
    sendBatch();
    if (part === 0 && task.later) {
      // the friend thinks of something else once the first dishes are ordered
      setPart(1);
      // after the 下单成功 toast has gone
      window.setTimeout(() => setLaterPopup(true), 1600);
    } else {
      if (part === 1) setLaterDone(true);
      right();
    }
  };

  const toBill = () => {
    if (task && !settled && task.later && part === 1 && !laterDone) {
      // 去买单 before the 加菜: what the friend still wants is missing
      const r = check(brand, order, task.later.wants, []);
      return wrong(r.misses);
    }
    go({ screen: 'bill', sheet: null }, 'push');
  };

  const paid = () => {
    setView({ screen: 'pickup', sheet: null });
    setDir('push');
    if (task && task.level >= 2) {
      const bill = price(brand, order, table ? order.placed.flat() : order.lines);
      const keys: ReadKey[] = table
        ? ['total', 'table', ...(bill.fees.some((f) => f.zh === S.teaFee) ? (['fee'] as ReadKey[]) : [])]
        : order.mode === '外送'
          ? ['time', 'total']
          : ['code', 'total', 'time', ...(bill.discount + bill.promo > 0 ? (['saved'] as ReadKey[]) : [])];
      const key = keys[(index + Number(roundTimes.code)) % keys.length];
      const ask: Record<ReadKey, string> = {
        code: brand.code?.zh === S.queueCode ? S.askQueue : S.askCode,
        total: S.askTotal,
        time: order.mode === '外送' ? S.askArrive : S.askTime,
        saved: S.askSaved,
        table: S.askTable,
        fee: S.askFee,
      };
      setReading({ zh: ask[key], key, state: 'ask' });
    }
  };

  const nextRound = () => {
    if (mode === 'browse') return reset('browse', 0);
    if (index + 1 >= tasks.length) return finish();
    reset('play', index + 1);
  };

  /* --------------------------------------------------------------- layout */
  const stage = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 640, vw: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setSize({
        w: el.clientWidth,
        h: Math.max(520, Math.min(860, window.innerHeight - top - 12)),
        vw: window.innerWidth,
      });
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
  // On a phone the mini-app is the screen, as a mini-program is in WeChat:
  // over the site's bars, edge to edge, with the page behind it held still.
  // Decided by the window, not the stage, since filling the screen changes
  // the stage's own width.
  const full = size.vw > 0 && size.vw < WIDE && mode !== 'intro';
  const wide = !full && size.w >= WIDE;
  useEffect(() => {
    if (!full) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = before;
    };
  }, [full]);
  // the first time, say where the guide went
  useEffect(() => {
    if (!full) return;
    try {
      if (localStorage.getItem(CAPSULE_KEY)) return;
      localStorage.setItem(CAPSULE_KEY, '1');
    } catch {
      return;
    }
    setFloatHint('··· at the top opens the guide; ◎ leaves the shop.');
  }, [full]);

  const app: AppApi = {
    brand,
    order,
    setOrder: (fn) => !settled && setOrderState(fn),
    view,
    go,
    toast: toastFn,
    capsule: full
      ? {
          more: () => setGuideOpen(true),
          close: () => leave?.(),
        }
      : null,
    task,
    later,
    submit,
    toBill,
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
    lib: ctx.lib,
    words: wordHost,
  };
  const setPinyin = setPinyinState;

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
    if (s === 'landing') return order.placed.length === 0;
    if (s === 'table' || s === 'bill') return order.placed.length > 0;
    return true;
  };
  const goTo = (s: ScreenId) => {
    setComplaint(null);
    if (s === 'chat' || s === 'home' || s === 'landing' || s === 'table' || s === 'bill') go({ screen: s, sheet: null }, 'pop');
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
        <Intro brand={brand} onPlay={() => reset('play', 0)} onBrowse={() => reset('browse', 0)} />
        <Popover help={help} extra={(zh) => <WordPicks zh={zh} />} />
      </HelpProvider>
    );
  }

  const guide = (
    <GuideSidebar
      brand={brand}
      task={task}
      later={later}
      step={step}
      canGo={canGo}
      goTo={goTo}
      onScreen={onScreen}
      pulse={pulse}
      hint={() => nextHint(brand, order, goalOf(task, part, laterDone), view)}
      setPinyin={setPinyin}
      replayTour={() => {
        if (settled) return;
        setView({ screen: 'menu', sheet: null });
        setTour(true);
        if (!wide) setGuideOpen(false);
      }}
      startOver={() => {
        // the batches already sent stay sent; the cart and the choices start again
        setOrderState((o) => ({ ...newOrder(), placed: o.placed, diners: o.diners, tea: o.tea }));
        setView({ screen: table ? (order.placed.length ? 'table' : 'landing') : 'home', sheet: null });
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
      {laterPopup && later && !complaint && (
        <div className="ok-modal-wrap">
          <div className="ok-modal" role="alertdialog" aria-label="Your friend says">
            <div className="ok-msg">
              <span className="ok-avatar" aria-hidden>
                {brand.friend.slice(-1)}
              </span>
              <div className="ok-bubble-stack">
                <div className="ok-bubble">
                  <T>{later.message}</T>
                </div>
              </div>
            </div>
            <button type="button" className="ok-btn block" onClick={() => setLaterPopup(false)} autoFocus>
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
          data-full={full || undefined}
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
              {!full && (
                <button type="button" className="ok-handle" aria-expanded={guideOpen} onClick={() => setGuideOpen(true)}>
                  Guide
                </button>
              )}
              {guideOpen && <Drawer onClose={() => setGuideOpen(false)}>{guide}</Drawer>}
            </>
          )}
          {missed && task && (
            <DiffCard
              message={task.later ? `${task.message} ${task.later.message}` : task.message}
              asked={[...task.wants, ...(task.later?.wants ?? [])].map((w) => wantText(brand, w))}
              got={[
                ...(order.diners ? [`${order.diners}人`] : []),
                ...allLines(order).map((l) => lineText(brand, l)),
                ...(order.dine ? [order.dine] : []),
                ...order.note.map((n) => `备注 ${n}`),
              ]}
              misses={missed}
              last={index + 1 >= tasks.length}
              onNext={nextRound}
            />
          )}
        </div>
        <Popover help={help} extra={(zh) => <WordPicks zh={zh} />} />
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

function Intro({ brand, onPlay, onBrowse }: { brand: Brand; onPlay(): void; onBrowse(): void }) {
  const [words, setWords] = useState(false);
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
          The guide beside the phone shows where you are and what is on the screen, and any word on it can be marked known
          or put on a list. <span className="hanzi">拼</span> and <span className="hanzi">下一步</span> are there whenever
          you want them.
        </li>
      </ul>
      <div className="ok-intro-actions">
        <button type="button" className="btn primary" onClick={onPlay} autoFocus>
          Take orders
        </button>
        <button type="button" className="btn" onClick={onBrowse}>
          Just browse
        </button>
        <button type="button" className="btn ghost" aria-expanded={words} onClick={() => setWords(!words)}>
          {words ? 'Hide menu words' : 'Menu words'}
        </button>
      </div>
      <p className="tiny muted">Just browse records nothing: leave it with ✕ when you are done.</p>
      {words && <MenuWordList brand={brand} />}
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
