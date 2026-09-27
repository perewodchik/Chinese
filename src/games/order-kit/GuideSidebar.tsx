import { useState, type ReactNode } from 'react';
import { GlossBody, T, useHelp } from './help';
import type { Hint } from './order';
import type { Brand, ScreenId, Stage, Task } from './types';

/**
 * The guide beside the phone, for when the learner is lost. It is in the
 * app's own paper style, so it reads as outside the shop.
 *
 *   任务      the friend's message, always there, and its parts as chips
 *   你在这里  the flow as a map; an earlier step is one tap away
 *   这一页    every Chinese label on the screen; opening one outlines it
 *   下一步    one line of English and the control to press
 *   tools     拼, the tour, the menu words, start over
 *   tip       one line about this screen
 */

const FOLD_KEY = 'hanzi-workshop/order-guide-folded';

function readFolded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export interface GuideProps {
  brand: Brand;
  task: Task | null;
  /** the 加菜 message, once it has arrived */
  later: Stage | null;
  step: ScreenId;
  /** steps that can be gone back to now */
  canGo(step: ScreenId): boolean;
  goTo(step: ScreenId): void;
  onScreen: string[];
  /** outline a control on the phone; `hint` also shows the line where the phone is */
  pulse(selector: string, hint?: Hint): void;
  /** 下一步: returns the hint and counts it */
  hint(): Hint;
  helpUsed: boolean;
  lookups: number;
  setPinyin(on: boolean): void;
  replayTour(): void;
  showWords(): void;
  startOver(): void;
  /** the order has been checked and paid: the map no longer goes back */
  locked: boolean;
}

export function GuideSidebar(p: GuideProps) {
  const help = useHelp();
  const [folded, setFolded] = useState(readFolded);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [confirm, setConfirm] = useState(false);
  const here = p.brand.flow.findIndex((f) => f.id === p.step);

  const fold = (id: string) => {
    const next = new Set(folded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFolded(next);
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify([...next]));
    } catch {
      /* per device only */
    }
  };

  const section = (id: string, zh: string, en: string, body: ReactNode, extra?: ReactNode) => (
    <section className="ok-guide-sec" data-folded={folded.has(id) || undefined}>
      <button type="button" className="ok-guide-h" aria-expanded={!folded.has(id)} onClick={() => fold(id)}>
        <span className="hanzi">{zh}</span> <span>· {en}</span>
        <span className="spacer" />
        {extra}
        <span className="ok-guide-caret" aria-hidden>
          ›
        </span>
      </button>
      {!folded.has(id) && <div className="ok-guide-b">{body}</div>}
    </section>
  );

  return (
    <aside className="ok-guide" aria-label="Guide">
      {p.task &&
        section(
          'task',
          '任务',
          'The order',
          <>
            <div className="ok-guide-msg">
              <span className="ok-guide-avatar" aria-hidden>
                {p.brand.friend.slice(-1)}
              </span>
              <T className="hanzi">{p.task.message}</T>
            </div>
            <div className="ok-guide-chips">
              {p.task.parts.map((c, i) => (
                <T key={i} className="ok-guide-chip hanzi">
                  {c}
                </T>
              ))}
            </div>
            {p.later && (
              <>
                <div className="ok-guide-msg later">
                  <span className="ok-guide-avatar" aria-hidden>
                    {p.brand.friend.slice(-1)}
                  </span>
                  <T className="hanzi">{p.later.message}</T>
                </div>
                <div className="ok-guide-chips">
                  {p.later.parts.map((c, i) => (
                    <T key={i} className="ok-guide-chip hanzi">
                      {c}
                    </T>
                  ))}
                </div>
              </>
            )}
            <div className="ok-guide-help" data-used={p.helpUsed || undefined}>
              <span className="ok-guide-help-state">{p.helpUsed ? 'Help used' : 'No help yet'}</span>
              <span className="tiny muted">
                {p.lookups}/2 free lookups · 拼 and 下一步 cost the first-try mark
              </span>
            </div>
          </>,
        )}

      {section(
        'map',
        '你在这里',
        'You are here',
        <ol className="ok-map">
          {p.brand.flow
            .filter((f) => p.task || f.id !== 'chat')
            .map((f) => {
              const i = p.brand.flow.indexOf(f);
              const state = i === here ? 'here' : i < here ? 'past' : 'ahead';
              const can = state === 'past' && !p.locked && p.canGo(f.id);
              return (
                <li key={f.id} data-state={state}>
                  <button type="button" disabled={!can} onClick={() => p.goTo(f.id)} aria-current={state === 'here' ? 'step' : undefined}>
                    <span className="ok-map-dot" aria-hidden />
                    <span className="hanzi">{f.zh}</span>
                    <span className="tiny muted">{f.en}</span>
                  </button>
                </li>
              );
            })}
        </ol>,
      )}

      {section(
        'screen',
        '这一页',
        'On this screen',
        <ul className="ok-onscreen">
          {p.onScreen.map((zh) => {
            const open = openRow === zh;
            return (
              <li key={zh} data-open={open || undefined}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenRow(open ? null : zh);
                    if (!open) {
                      help.looked(zh);
                      p.pulse(`[data-zh="${CSS.escape(zh)}"]`);
                    }
                  }}
                >
                  <span className="hanzi">{zh}</span>
                  {!open && <span className="tiny muted ok-onscreen-hint">›</span>}
                </button>
                {open && <GlossBody zh={zh} />}
              </li>
            );
          })}
          {!p.onScreen.length && <li className="tiny muted">Nothing to read here.</li>}
        </ul>,
      )}

      <section className="ok-guide-sec ok-guide-next">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const h = p.hint();
            setHint(h);
            p.pulse(`[data-hint="${CSS.escape(h.target)}"]`, h);
          }}
        >
          <span className="hanzi">下一步</span> · What next?
        </button>
        <p className="small ok-guide-hint">{hint ? hint.en : p.task ? 'Shows the next thing to press. Counts as help.' : 'Shows the next thing to press.'}</p>
      </section>

      <section className="ok-guide-sec ok-guide-tools">
        <button
          type="button"
          className="chip"
          aria-pressed={help.pinyin}
          onClick={() => p.setPinyin(!help.pinyin)}
          title="Pinyin over every label"
        >
          <span className="hanzi">拼</span> {help.pinyin ? 'on' : 'off'}
        </button>
        <button type="button" className="chip" onClick={p.replayTour}>
          Replay tour
        </button>
        <button type="button" className="chip" onClick={p.showWords}>
          Menu words
        </button>
        {confirm ? (
          <span className="ok-confirm">
            <button
              type="button"
              className="chip"
              onClick={() => {
                setConfirm(false);
                p.startOver();
              }}
            >
              Clear the cart
            </button>
            <button type="button" className="chip" onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setConfirm(true)} disabled={p.locked}>
            Start over
          </button>
        )}
      </section>

      {p.brand.tips[p.step] && (
        <section className="ok-guide-sec ok-guide-tip">
          <span className="ok-guide-tip-label">Tip</span>
          <p className="small">{p.brand.tips[p.step]}</p>
        </section>
      )}
    </aside>
  );
}
