import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, type ReadKey } from './app';
import { T } from './help';
import {
  addLine,
  choose,
  count,
  defaultChoices,
  disabled,
  groupOf,
  itemOf,
  lineTotal,
  missingRequired,
  needsSheet,
  offered,
  price,
  saving,
  setQty,
  specText,
  subtotal,
  unitPrice,
  usable,
  visibleGroups,
  yuan,
} from './order';
import { S } from './strings';
import { CartIcon, FakeQr, MenuPhoto, PhotoCredit, Price, Sheet, Stepper, Was } from './ui';
import type { Line, MenuItem } from './types';

/**
 * The screens of a shop's mini-program, in the order the learner meets them:
 * the chat, the home page or the table's landing page, the menu, the sheets,
 * checkout, the table (for 加菜), the bill, payment and the last screen. Each
 * reads the app state from useApp() and draws itself in the WeChat look;
 * every Chinese string goes through <T>.
 */

/* ------------------------------------------------------------------ chat */

function Friend({ children }: { children: React.ReactNode }) {
  const { brand } = useApp();
  return (
    <div className="ok-msg">
      <span className="ok-avatar" aria-hidden>
        {brand.friend.slice(-1)}
      </span>
      {children}
    </div>
  );
}

export function ChatScreen() {
  const { brand, task, later, go } = useApp();
  const table = brand.model === 'table';
  return (
    <div className="ok-screen ok-chat">
      <div className="ok-scroll">
        {task && (
          <Friend>
            <div className="ok-bubble">
              <T>{task.message}</T>
            </div>
          </Friend>
        )}
        <Friend>
          <button
            type="button"
            className="ok-mp-card"
            data-hint="chat-card"
            onClick={() => go({ screen: table ? 'landing' : 'home', sheet: null }, 'push')}
          >
            <span className="ok-mp-card-head">
              <span className="ok-mp-dot" aria-hidden />
              <T>{brand.name}</T>
            </span>
            <span className="ok-mp-card-banner">
              <MenuPhoto photo={brand.banner.photo} />
              <span className="ok-wordmark">
                <b>
                  <T>{brand.name}</T>
                </b>
                <i>{brand.latin}</i>
              </span>
            </span>
            <span className="ok-mp-card-foot">
              <span className="ok-mp-glyph" aria-hidden>
                ◎
              </span>
              <T>{table ? S.scanOrder : S.miniProgram}</T>
            </span>
          </button>
        </Friend>
        {later && (
          <Friend>
            <div className="ok-bubble">
              <T>{later.message}</T>
            </div>
          </Friend>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ home */

export function HomeScreen() {
  const { brand, go, toast, setOrder } = useApp();
  const fresh = brand.items.filter((i) => i.cats.includes('new') || i.cats.includes('top')).slice(0, 3);
  const counter = brand.model === 'counter';
  return (
    <div className="ok-screen ok-home">
      <div className="ok-scroll">
        <Banner />
        <div className="ok-entries">
          <button
            type="button"
            className="ok-entry"
            data-hint="home-pickup"
            onClick={() => {
              setOrder((o) => ({ ...o, mode: '自提' }));
              go({ screen: 'menu', sheet: null }, 'push');
            }}
          >
            <b>
              <T>{counter ? S.orderHere : S.pickupHere}</T>
            </b>
            <T className="ok-sub">{S.skipQueue}</T>
          </button>
          <button
            type="button"
            className="ok-entry"
            data-hint="home-delivery"
            onClick={() => {
              if (!brand.delivery) return toast(S.deliverySoon);
              setOrder((o) => ({ ...o, mode: '外送' }));
              go({ screen: 'menu', sheet: null }, 'push');
            }}
          >
            <b>
              <T>{S.delivery}</T>
            </b>
            <T className="ok-sub">{S.toYou}</T>
          </button>
        </div>
        <div className="ok-strip">
          <button type="button" onClick={() => go({ screen: 'menu', sheet: null }, 'push')}>
            <T>{S.coupon}</T>
            <b>
              {brand.coupons.length}
              <T>{S.sheets}</T>
            </b>
          </button>
          <button type="button" onClick={() => go({ screen: 'me', sheet: null }, 'none')}>
            <T>{S.member}</T>
            <b>LV1</b>
          </button>
        </div>
        <div className="ok-section-title">
          <T>{S.newOnes}</T>
        </div>
        <div className="ok-fresh">
          {fresh.map((i) => (
            <button
              key={i.id}
              type="button"
              className="ok-fresh-tile"
              onClick={() => go({ screen: 'menu', sheet: { kind: 'spec', item: i.id, choices: defaultChoices(brand, i) } }, 'push')}
            >
              <MenuPhoto photo={i.photo} />
              <T className="ok-fresh-name">{i.zh}</T>
              <Price v={i.deal ?? i.price} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Banner() {
  const { brand } = useApp();
  return (
    <div className="ok-banner">
      <MenuPhoto photo={brand.banner.photo} />
      <span className="ok-banner-panel">
        <span className="ok-wordmark">
          <b>
            <T>{brand.name}</T>
          </b>
          <i>{brand.latin}</i>
        </span>
        <span className="ok-banner-text">
          <T>{brand.banner.zh}</T>
          <b>
            <T>{brand.banner.sub}</T>
          </b>
        </span>
      </span>
      <span className="ok-dots" aria-hidden>
        <i data-on /> <i /> <i />
      </span>
    </div>
  );
}

export function EmptyTab({ which }: { which: 'orders' | 'me' }) {
  return (
    <div className="ok-screen ok-empty-tab">
      <div className="ok-empty">
        <span className="ok-empty-mark" aria-hidden>
          ○
        </span>
        <T>{which === 'orders' ? S.noOrders : S.practice}</T>
      </div>
    </div>
  );
}

/* --------------------------------------------------- table: the landing */

export function LandingScreen() {
  const { brand, order, setOrder, go, toast } = useApp();
  const tea = brand.table?.tea ? groupOf(brand, brand.table.tea) : null;
  const teaFee = brand.fees.find((f) => f.zh === S.teaFee);
  const ready = !!order.diners && (!tea || !!order.tea);
  return (
    <div className="ok-screen ok-landing">
      <div className="ok-scroll">
        <Banner />
        <div className="ok-card">
          <div className="ok-kv">
            <T className="ok-k">{S.tableNo}</T>
            <b className="ok-table-no" data-read="table">
              <T>{brand.table?.no ?? ''}</T>
            </b>
          </div>
          <div className="ok-group-name">
            <T>{S.diners}</T>
          </div>
          <div className="ok-diners">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className="ok-pill"
                data-hint={`diners:${n}`}
                data-on={order.diners === n || undefined}
                onClick={() => setOrder((o) => ({ ...o, diners: n }))}
              >
                {n}
                <T>{S.people}</T>
              </button>
            ))}
          </div>
        </div>
        {tea && (
          <div className="ok-card">
            <div className="ok-group-name">
              <T>{S.chooseTea}</T>
              {teaFee && (
                <span className="ok-sub">
                  {' '}
                  <T>{S.teaFee}</T> ¥{yuan(teaFee.amount)}/<T>{S.perHead}</T>
                </span>
              )}
            </div>
            <div className="ok-pills">
              {tea.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="ok-pill"
                  data-hint={`tea:${o.id}`}
                  data-on={order.tea === o.id || undefined}
                  onClick={() => setOrder((x) => ({ ...x, tea: o.id }))}
                >
                  <T>{o.zh}</T>
                  {o.sub && <T className="ok-pill-sub">{o.sub}</T>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="ok-list-end" />
      </div>
      <div className="ok-paybar">
        <span className="ok-sub">
          {order.diners ? (
            <>
              {order.diners}
              <T>{S.people}</T>
            </>
          ) : (
            <T>{`${S.choose}${S.diners}`}</T>
          )}
        </span>
        <button
          type="button"
          className="ok-go"
          data-hint="landing-start"
          aria-disabled={!ready}
          data-off={!ready || undefined}
          onClick={() => {
            if (!order.diners) return toast(`${S.choose}${S.diners}`);
            if (tea && !order.tea) return toast(S.chooseTea);
            go({ screen: 'menu', sheet: null }, 'push');
          }}
        >
          <T>{S.start}</T>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

export function MenuScreen() {
  const { brand, order, setOrder, go, toast } = useApp();
  const list = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(brand.categories[0].id);
  const jumping = useRef(0);
  const sections = useMemo(
    () => brand.categories.map((c) => ({ c, items: brand.items.filter((i) => i.cats.includes(c.id)) })),
    [brand],
  );

  const onScroll = () => {
    const el = list.current;
    if (!el || Date.now() < jumping.current) return;
    let cur = brand.categories[0].id;
    for (const s of el.querySelectorAll<HTMLElement>('[data-cat]')) {
      if (s.offsetTop <= el.scrollTop + 8) cur = s.dataset.cat!;
    }
    // at the very bottom the last section is the one being read
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) cur = brand.categories[brand.categories.length - 1].id;
    setActive(cur);
  };

  // keep the active category in view in the rail
  useEffect(() => {
    const r = rail.current;
    const b = r?.querySelector<HTMLElement>(`[data-rail="${active}"]`);
    if (!r || !b) return;
    if (b.offsetTop < r.scrollTop) r.scrollTop = b.offsetTop - 8;
    else if (b.offsetTop + b.offsetHeight > r.scrollTop + r.clientHeight) r.scrollTop = b.offsetTop + b.offsetHeight - r.clientHeight + 8;
  }, [active]);

  const jump = (id: string) => {
    const el = list.current;
    const s = el?.querySelector<HTMLElement>(`[data-cat="${id}"]`);
    if (!el || !s) return;
    setActive(id);
    jumping.current = Date.now() + 500;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: s.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
  };

  const open = (item: MenuItem) =>
    go({ screen: 'menu', sheet: { kind: 'spec', item: item.id, choices: defaultChoices(brand, item) } }, 'none');

  const setMode = (m: '自提' | '外送') => {
    if (m === '外送' && !brand.delivery) return toast(S.deliverySoon);
    setOrder((o) => ({ ...o, mode: m }));
  };

  let firstButton = true;
  return (
    <div className="ok-screen ok-menu">
      {brand.model === 'table' ? (
        <div className="ok-storebar">
          <span className="ok-store">
            <b>
              <T>{S.tableNo}</T> <T>{brand.table?.no ?? ''}</T>
            </b>
            <span className="ok-sub">
              <T>{brand.store.zh}</T>
            </span>
          </span>
          <span className="ok-table-chip">
            {order.diners ?? '–'}
            <T>{S.people}</T>
          </span>
        </div>
      ) : (
        <div className="ok-storebar">
          <button type="button" className="ok-store" data-tour="store" onClick={() => toast(S.practice)}>
            <b>
              <T>{brand.store.zh}</T> ›
            </b>
            <span className="ok-sub">
              <T>{S.near}</T> {brand.store.distance}
            </span>
          </button>
          <span className="ok-seg" data-tour="mode" role="group">
            <button type="button" data-on={order.mode === '自提' || undefined} onClick={() => setMode('自提')}>
              <T>{S.pickup}</T>
            </button>
            <button type="button" data-on={order.mode === '外送' || undefined} onClick={() => setMode('外送')}>
              <T>{S.delivery}</T>
            </button>
          </span>
        </div>
      )}
      <div className="ok-menu-body">
        <div className="ok-rail" ref={rail} data-tour="rail">
          {brand.categories.map((c) => (
            <button key={c.id} type="button" data-rail={c.id} data-on={active === c.id || undefined} onClick={() => jump(c.id)}>
              <T>{c.zh}</T>
            </button>
          ))}
        </div>
        <div className="ok-list" ref={list} onScroll={onScroll}>
          {sections.map(({ c, items }) => (
            <section key={c.id} data-cat={c.id}>
              <h3 className="ok-cat-head">
                <T>{c.zh}</T>
              </h3>
              {items.map((i) => {
                const tour = firstButton && needsSheet(brand, i);
                if (tour) firstButton = false;
                return <ProductRow key={i.id} item={i} onOpen={() => open(i)} tour={tour} />;
              })}
            </section>
          ))}
          <div className="ok-list-end" />
        </div>
      </div>
      <CartBar />
    </div>
  );
}

const SPICY = [S.mild, S.medium, S.hot];

function ProductRow({ item, onOpen, tour }: { item: MenuItem; onOpen(): void; tour: boolean }) {
  const { brand, setOrder, toast } = useApp();
  const sheet = needsSheet(brand, item);
  const onlyIced = ['temp', 'ice'].some((g) => item.groups.includes(g) && item.only?.[g] && !item.only[g].includes('hot'));
  return (
    <div className="ok-row" role="button" tabIndex={0} data-hint={`item:${item.id}`} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <MenuPhoto photo={item.photo} />
      <div className="ok-row-text">
        <T className="ok-row-name">{item.zh}</T>
        {item.desc && <T className="ok-row-desc">{item.desc}</T>}
        <span className="ok-tags">
          {item.tags?.map((t) => (
            <T key={t} className="ok-tag">
              {t}
            </T>
          ))}
          {item.spicy ? <T className="ok-tag hot">{SPICY[item.spicy - 1]}</T> : null}
          {onlyIced && <T className="ok-tag quiet">{S.onlyIced}</T>}
        </span>
        <span className="ok-row-foot">
          <span className="ok-row-price">
            {item.deal !== undefined ? (
              <>
                <T className="ok-deal-label">{S.deal}</T>
                <Price v={item.deal} className="deal" />
                <Was v={item.price} />
              </>
            ) : (
              <>
                <Price v={item.price} className="deal" />
                {(item.per || (item.unit && item.unit !== '份')) && (
                  <span className="ok-sub">
                    /<T>{item.per ?? item.unit ?? ''}</T>
                  </span>
                )}
              </>
            )}
          </span>
          {sheet ? (
            <button
              type="button"
              className="ok-spec-btn"
              data-tour={tour ? 'add' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              <T>{S.spec}</T>
            </button>
          ) : (
            <button
              type="button"
              className="ok-plus"
              aria-label={`add ${item.zh}`}
              onClick={(e) => {
                e.stopPropagation();
                setOrder((o) => ({ ...o, lines: addLine(o.lines, { item: item.id, choices: defaultChoices(brand, item), qty: 1 }) }));
                toast(S.added);
              }}
            >
              +
            </button>
          )}
        </span>
        {item.sold && (
          <span className="ok-sold">
            <T>{S.sold}</T> {item.sold}+
          </span>
        )}
      </div>
    </div>
  );
}

export function CartBar() {
  const { brand, order, go, view } = useApp();
  const n = count(order.lines);
  const table = brand.model === 'table';
  const bill = price(brand, { ...order, placed: [] }, order.lines);
  const total = table ? subtotal(brand, order.lines) : bill.total - bill.fees.reduce((a, f) => a + f.amount, 0);
  return (
    <div className="ok-cartbar" data-tour="cart-bar">
      <button
        type="button"
        className="ok-cartbar-main"
        data-hint="cart-bar"
        disabled={!n}
        onClick={() => go({ screen: 'menu', sheet: view.sheet?.kind === 'cart' ? null : { kind: 'cart' } }, 'none')}
      >
        <span className="ok-cart-icon" data-full={n > 0 || undefined}>
          <CartIcon />
          {n > 0 && (
            <span className="ok-badge" key={n}>
              {n}
            </span>
          )}
        </span>
        {n ? (
          <span className="ok-cartbar-sum">
            <Price v={total} />
            {!table && bill.discount + bill.promo > 0 && <Was v={bill.items} />}
          </span>
        ) : (
          <T className="ok-cartbar-empty">{S.emptyCart}</T>
        )}
      </button>
      <button
        type="button"
        className="ok-go"
        data-hint="checkout-btn"
        data-tour="checkout-btn"
        disabled={!n}
        onClick={() => go({ screen: 'checkout', sheet: null }, 'push')}
      >
        <T>{table ? S.chosenDone : S.checkout}</T>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ spec sheet */

export function SpecSheet({ itemId, choices, qty }: { itemId: string; choices: Record<string, string[]>; qty: number }) {
  const { brand, go, setOrder, toast } = useApp();
  const item = itemOf(brand, itemId);
  const body = useRef<HTMLDivElement>(null);
  const set = (c: Record<string, string[]>, q = qty) => go({ screen: 'menu', sheet: { kind: 'spec', item: itemId, choices: c, qty: q } }, 'none');
  const close = () => go({ screen: 'menu', sheet: null }, 'none');
  const unit = unitPrice(brand, { item: itemId, choices });
  const table = brand.model === 'table';

  const add = (then: 'close' | 'checkout') => {
    const miss = missingRequired(brand, item, choices);
    if (miss) {
      toast(`${S.choose}${miss.zh}`);
      const g = body.current?.querySelector<HTMLElement>(`[data-hint="group:${miss.id}"]`);
      if (g && body.current) {
        body.current.scrollTop = g.offsetTop - body.current.offsetTop - 8;
        g.classList.remove('ok-pulse');
        void g.offsetWidth;
        g.classList.add('ok-pulse');
        window.setTimeout(() => g.classList.remove('ok-pulse'), 1000);
      }
      return;
    }
    setOrder((o) => ({ ...o, lines: addLine(o.lines, { item: itemId, choices, qty }) }));
    if (then === 'checkout') go({ screen: 'checkout', sheet: null }, 'push');
    else {
      toast(S.added);
      close();
    }
  };

  return (
    <Sheet onClose={close} label={item.zh} className="ok-spec">
      <button type="button" className="ok-x" aria-label="close" data-hint="spec-close" onClick={close}>
        ×
      </button>
      <div className="ok-spec-head">
        <MenuPhoto photo={item.photo} />
        <div>
          <T className="ok-spec-name">{item.zh}</T>
          {item.desc && <T className="ok-row-desc">{item.desc}</T>}
          <PhotoCredit photo={item.photo} />
        </div>
      </div>
      <div className="ok-spec-body" ref={body}>
        {visibleGroups(brand, item, choices).map((gid) => {
          const g = groupOf(brand, gid);
          const off = disabled(brand, choices, gid);
          return (
            <div key={gid} className="ok-group" data-hint={`group:${gid}`}>
              <div className="ok-group-name">
                <T>{g.zh}</T>
                {g.pick && (
                  <span className="ok-sub">
                    {' '}
                    ({choices[gid]?.length ?? 0}/{g.pick})
                  </span>
                )}
              </div>
              <div className="ok-pills">
                {offered(brand, item, gid).map((o) => {
                  const p = item.prices?.[o.id];
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className="ok-pill"
                      data-on={choices[gid]?.includes(o.id) || undefined}
                      data-hint={`opt:${gid}:${o.id}`}
                      disabled={off.has(o.id)}
                      onClick={() => set(choose(brand, choices, gid, o.id))}
                    >
                      <T>{o.zh}</T>
                      {o.sub && <T className="ok-pill-sub">{o.sub}</T>}
                      {p !== undefined ? <span className="ok-pill-sub">¥{yuan(p)}</span> : null}
                      {o.delta ? <span className="ok-pill-sub">+¥{yuan(o.delta)}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!item.groups.length && <div className="ok-group-none" />}
      </div>
      <div className="ok-spec-foot">
        <div className="ok-spec-sum">
          <span>
            <Price v={unit * qty} />
            <span className="ok-spec-picked">
              {specText(brand, { item: itemId, choices }).map((z, i) => (
                <span key={i}>
                  {i > 0 && '/'}
                  <T>{z}</T>
                </span>
              ))}
            </span>
          </span>
          <Stepper qty={qty} min={1} plusHint="spec-plus" onMinus={() => set(choices, Math.max(1, qty - 1))} onPlus={() => set(choices, Math.min(9, qty + 1))} />
        </div>
        <div className={table ? 'ok-spec-actions one' : 'ok-spec-actions'}>
          {!table && (
            <button type="button" className="ok-btn ghost" onClick={() => add('checkout')}>
              <T>{S.buyNow}</T>
            </button>
          )}
          <button type="button" className="ok-btn" data-hint="spec-add" onClick={() => add('close')}>
            <T>{S.addToCart}</T>
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ cart */

function Spec({ line }: { line: Pick<Line, 'item' | 'choices'> }) {
  const { brand } = useApp();
  return (
    <span className="ok-line-spec">
      {specText(brand, line).map((z, j) => (
        <span key={j}>
          {j > 0 && '/'}
          <T>{z}</T>
        </span>
      ))}
    </span>
  );
}

export function CartSheet() {
  const { brand, order, setOrder, go } = useApp();
  const close = () => go({ screen: 'menu', sheet: null }, 'none');
  useEffect(() => {
    if (!order.lines.length) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.lines.length]);
  return (
    <Sheet onClose={close} label={S.tabCart} className="ok-cart" closeHint="cart-close">
      <div className="ok-cart-head">
        <T>{S.chosenItems}</T>
        <button type="button" className="ok-link" onClick={() => setOrder((o) => ({ ...o, lines: [] }))}>
          <T>{S.clearCart}</T>
        </button>
      </div>
      <div className="ok-cart-lines">
        {order.lines.map((l, i) => (
          <div key={`${l.item}-${i}`} className="ok-line">
            <MenuPhoto photo={itemOf(brand, l.item).photo} className="sm" />
            <div className="ok-line-text">
              <T className="ok-line-name">{itemOf(brand, l.item).zh}</T>
              <Spec line={l} />
              <Price v={lineTotal(brand, l)} />
            </div>
            <Stepper
              qty={l.qty}
              minusHint={`cart-minus:${i}`}
              onMinus={() => setOrder((o) => ({ ...o, lines: setQty(o.lines, i, l.qty - 1) }))}
              onPlus={() => setOrder((o) => ({ ...o, lines: setQty(o.lines, i, l.qty + 1) }))}
            />
          </div>
        ))}
      </div>
      <div className="ok-cart-spacer" />
      <CartBar />
    </Sheet>
  );
}

/* -------------------------------------------------------------- checkout */

function Lines({ lines }: { lines: Line[] }) {
  const { brand } = useApp();
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className="ok-line">
          <MenuPhoto photo={itemOf(brand, l.item).photo} className="sm" />
          <div className="ok-line-text">
            <T className="ok-line-name">{itemOf(brand, l.item).zh}</T>
            <Spec line={l} />
          </div>
          <span className="ok-line-right">
            <Price v={lineTotal(brand, l)} />
            <span className="ok-sub">×{l.qty}</span>
          </span>
        </div>
      ))}
    </>
  );
}

function NoteRow() {
  const { order, go, view } = useApp();
  return (
    <button type="button" className="ok-kv link" data-hint="note-row" onClick={() => go({ screen: view.screen, sheet: { kind: 'note' } }, 'none')}>
      <T className="ok-k">{S.note}</T>
      <span className="ok-sub ok-note-val">
        {order.note.length || order.noteText ? (
          <>
            {order.note.map((x, i) => (
              <span key={x}>
                {i > 0 && '，'}
                <T>{x}</T>
              </span>
            ))}
            {order.noteText && (
              <span>
                {order.note.length ? '，' : ''}
                {order.noteText}
              </span>
            )}
          </>
        ) : (
          <T>{S.none}</T>
        )}{' '}
        ›
      </span>
    </button>
  );
}

function FeeRows({ fees, read }: { fees: ReturnType<typeof price>['fees']; read?: (k: ReadKey) => object }) {
  return (
    <>
      {fees.map((f) => (
        <div key={f.zh} className="ok-kv" data-fee={f.zh}>
          <T className="ok-k">{f.zh}</T>
          <span>
            <span className="ok-sub">
              ¥{yuan(f.each)}×{f.n}{' '}
            </span>
            {read && f.zh === S.teaFee ? (
              <button type="button" className="ok-readable" {...read('fee')}>
                <Price v={f.amount} />
              </button>
            ) : (
              <Price v={f.amount} />
            )}
          </span>
        </div>
      ))}
    </>
  );
}

export function CheckoutScreen() {
  const { brand, view } = useApp();
  return (
    <div className="ok-screen ok-checkout">
      {brand.model === 'table' ? <TableCheckout /> : <ShopCheckout />}
      {view.sheet?.kind === 'coupon' && <CouponSheet />}
      {view.sheet?.kind === 'note' && <NoteSheet />}
      {view.sheet?.kind === 'address' && <AddressSheet />}
      {view.sheet?.kind === 'cutlery' && <CutlerySheet />}
      {view.sheet?.kind === 'pay' && <PaySheet />}
    </div>
  );
}

function ShopCheckout() {
  const app = useApp();
  const { brand, order, setOrder, go, toast, times } = app;
  const bill = price(brand, order);
  const usableCount = brand.coupons.filter((c) => usable(brand, order.lines, c)).length;
  const n = count(order.lines);
  const delivery = order.mode === '外送';
  const address = brand.delivery?.addresses.find((a) => a.id === order.address);
  const short = delivery && brand.delivery ? Math.max(0, brand.delivery.min - bill.items) : 0;
  const [a, b] = brand.dine ?? [S.eatIn, S.takeAway];
  const setMode = (m: '自提' | '外送') => {
    if (m === '外送' && !brand.delivery) return toast(S.deliverySoon);
    setOrder((o) => ({ ...o, mode: m }));
  };

  return (
    <>
      <div className="ok-scroll">
        <div className="ok-card">
          <span className="ok-seg wide" role="group">
            <button type="button" data-on={!delivery || undefined} data-hint="mode:自提" onClick={() => setMode('自提')}>
              <T>{S.pickup}</T>
            </button>
            <button type="button" data-on={delivery || undefined} data-hint="mode:外送" onClick={() => setMode('外送')}>
              <T>{S.delivery}</T>
            </button>
          </span>
          {delivery ? (
            <>
              <button type="button" className="ok-kv link" data-hint="address-row" onClick={() => go({ screen: 'checkout', sheet: { kind: 'address' } }, 'none')}>
                <T className="ok-k">{S.address}</T>
                <span>
                  {address ? (
                    <>
                      <T>{address.zh}</T> <T className="ok-sub">{address.sub}</T>
                    </>
                  ) : (
                    <T className="ok-red">{S.chooseAddress}</T>
                  )}{' '}
                  ›
                </span>
              </button>
              <div className="ok-kv">
                <span />
                <span className="ok-accent">
                  <T>{S.arrive}</T> {times.ready}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="ok-kv">
                <T className="ok-k">{S.store}</T>
                <span>
                  <T>{brand.store.zh}</T>
                  <span className="ok-sub">
                    {' '}
                    <T>{S.near}</T> {brand.store.distance}
                  </span>
                </span>
              </div>
              <div className="ok-kv">
                <span />
                <span className="ok-accent">
                  <T>{S.expect}</T> {times.ready} <T>{S.ready}</T>
                </span>
              </div>
              <div className="ok-kv">
                <T className="ok-k">{S.dine}</T>
                <span className="ok-pills tight">
                  {[a, b].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="ok-pill"
                      data-hint={`dine:${d}`}
                      data-on={order.dine === d || undefined}
                      onClick={() => setOrder((o) => ({ ...o, dine: d }))}
                    >
                      <T>{d}</T>
                    </button>
                  ))}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="ok-card">
          <Lines lines={order.lines} />
          <div className="ok-kv sum">
            <span className="ok-sub">
              <T>{S.inAll}</T> {n} <T>{S.pieces}</T>
            </span>
            <span>
              <T className="ok-sub">{S.itemsTotal}</T> <Price v={bill.items} />
            </span>
          </div>
          <FeeRows fees={bill.fees} />
          {bill.promo > 0 && (
            <div className="ok-kv">
              <T className="ok-k">{S.promo}</T>
              <span className="ok-red">−¥{yuan(bill.promo)}</span>
            </div>
          )}
        </div>

        <div className="ok-card">
          <button type="button" className="ok-kv link" data-hint="coupon-row" onClick={() => go({ screen: 'checkout', sheet: { kind: 'coupon' } }, 'none')}>
            <T className="ok-k">{S.coupon}</T>
            <span className={bill.coupon ? 'ok-red' : 'ok-sub'}>
              {bill.coupon ? (
                <>
                  <T>{S.chosen}</T>1<T>{S.sheets}</T> −¥{yuan(bill.discount)}
                </>
              ) : usableCount ? (
                <>
                  {usableCount}
                  <T>{S.sheets}</T>
                  <T>{S.usable}</T>
                </>
              ) : (
                <T>{S.noCoupon}</T>
              )}{' '}
              ›
            </span>
          </button>
          <NoteRow />
          {delivery && (
            <button type="button" className="ok-kv link" data-hint="cutlery-row" onClick={() => go({ screen: 'checkout', sheet: { kind: 'cutlery' } }, 'none')}>
              <T className="ok-k">{S.cutlery}</T>
              <span className="ok-sub">
                {order.cutlery === null ? <T className="ok-red">{S.choose}</T> : order.cutlery === 0 ? <T>{S.noCutlery}</T> : (
                  <>
                    {order.cutlery}
                    <T>{S.sets}</T>
                  </>
                )}{' '}
                ›
              </span>
            </button>
          )}
          <div className="ok-kv">
            <T className="ok-k">{S.payMethod}</T>
            <span>
              <span className="ok-wxpay" aria-hidden>
                ✓
              </span>
              <T>{S.wechatPay}</T>
            </span>
          </div>
        </div>
        <div className="ok-list-end" />
      </div>

      <div className="ok-paybar">
        <span>
          <T className="ok-sub">{S.total}</T> <Price v={bill.total} className="big" />
          {bill.discount + bill.promo > 0 && (
            <span className="ok-sub">
              {' '}
              <T>{S.saved}</T>¥{yuan(bill.discount + bill.promo)}
            </span>
          )}
        </span>
        <button
          type="button"
          className="ok-go"
          data-hint="pay-btn"
          disabled={!n || short > 0}
          onClick={() => {
            if (delivery) {
              if (!order.address) return toast(`${S.choose}${S.address}`);
              if (order.cutlery === null) return toast(`${S.choose}${S.cutlery}`);
            } else if (!order.dine) return toast(`${S.choose}${S.dine}`);
            app.submit();
          }}
        >
          {short > 0 ? (
            <>
              <T>{S.short}</T>¥{yuan(short)}
              <T>{S.minOrder}</T>
            </>
          ) : (
            <T>{S.pay}</T>
          )}
        </button>
      </div>
    </>
  );
}

function TableCheckout() {
  const app = useApp();
  const { brand, order } = app;
  const n = count(order.lines);
  return (
    <>
      <div className="ok-scroll">
        <div className="ok-card">
          <div className="ok-kv">
            <T className="ok-k">{S.tableNo}</T>
            <b><T>{brand.table?.no ?? ''}</T></b>
          </div>
          <div className="ok-kv">
            <T className="ok-k">{S.diners}</T>
            <span>
              {order.diners}
              <T>{S.people}</T>
            </span>
          </div>
        </div>
        <div className="ok-card">
          {order.placed.length > 0 && (
            <div className="ok-sheet-title left">
              <T>{S.more}</T>
            </div>
          )}
          <Lines lines={order.lines} />
          <div className="ok-kv sum">
            <span className="ok-sub">
              <T>{S.inAll}</T> {n} <T>{S.pieces}</T>
            </span>
            <span>
              <T className="ok-sub">{S.dishes}</T> <Price v={subtotal(brand, order.lines)} />
            </span>
          </div>
        </div>
        <div className="ok-card">
          <NoteRow />
        </div>
        <div className="ok-list-end" />
      </div>
      <div className="ok-paybar">
        <span>
          <T className="ok-sub">{S.total}</T> <Price v={subtotal(brand, order.lines)} className="big" />
        </span>
        <button type="button" className="ok-go" data-hint="order-btn" disabled={!n} onClick={app.submit}>
          <T>{S.placeOrder}</T>
        </button>
      </div>
    </>
  );
}

function CouponSheet() {
  const { brand, order, setOrder, go } = useApp();
  const current = price(brand, order).coupon?.id ?? null;
  const close = () => go({ screen: 'checkout', sheet: null }, 'none');
  return (
    <Sheet onClose={close} label={S.chooseCoupon} className="ok-small-sheet">
      <div className="ok-sheet-title">
        <T>{S.chooseCoupon}</T>
      </div>
      <div className="ok-coupons">
        {brand.coupons.map((c) => {
          const ok = usable(brand, order.lines, c);
          return (
            <button
              key={c.id}
              type="button"
              className="ok-coupon"
              disabled={!ok}
              data-hint={`coupon:${c.id}`}
              data-on={current === c.id || undefined}
              onClick={() => setOrder((o) => ({ ...o, coupon: c.id }))}
            >
              <span className="ok-coupon-amt">{ok ? `−¥${yuan(saving(brand, order.lines, c))}` : '—'}</span>
              <span className="ok-coupon-text">
                <T className="ok-line-name">{c.zh}</T>
                <T className="ok-sub">{c.sub}</T>
              </span>
              <T className="ok-sub">{ok ? S.usable : S.unusable}</T>
              <span className="ok-radio" aria-hidden />
            </button>
          );
        })}
        <button type="button" className="ok-coupon plain" data-on={current === null || undefined} onClick={() => setOrder((o) => ({ ...o, coupon: null }))}>
          <T className="ok-line-name">{S.noCoupon}</T>
          <span className="ok-radio" aria-hidden />
        </button>
      </div>
      <button type="button" className="ok-btn block" data-hint="sheet-ok" onClick={close}>
        <T>{S.ok}</T>
      </button>
    </Sheet>
  );
}

function NoteSheet() {
  const { brand, order, setOrder, go, view } = useApp();
  const close = () => go({ screen: view.screen, sheet: null }, 'none');
  return (
    <Sheet onClose={close} label={S.note} className="ok-small-sheet">
      <div className="ok-sheet-title">
        <T>{S.note}</T>
      </div>
      <div className="ok-group-name">
        <T>{S.taste}</T>
      </div>
      <div className="ok-pills">
        {brand.notes.map((n) => (
          <button
            key={n}
            type="button"
            className="ok-pill"
            data-hint={`note:${n}`}
            data-on={order.note.includes(n) || undefined}
            onClick={() =>
              setOrder((o) => ({ ...o, note: o.note.includes(n) ? o.note.filter((x) => x !== n) : [...o.note, n] }))
            }
          >
            <T>{n}</T>
          </button>
        ))}
      </div>
      <div className="ok-group-name">
        <T>{S.other}</T>
      </div>
      <input
        className="ok-input"
        value={order.noteText}
        maxLength={40}
        onChange={(e) => setOrder((o) => ({ ...o, noteText: e.target.value }))}
        aria-label="other requests"
      />
      <button type="button" className="ok-btn block" data-hint="sheet-ok" onClick={close}>
        <T>{S.ok}</T>
      </button>
    </Sheet>
  );
}

function AddressSheet() {
  const { brand, order, setOrder, go } = useApp();
  const close = () => go({ screen: 'checkout', sheet: null }, 'none');
  return (
    <Sheet onClose={close} label={S.chooseAddress} className="ok-small-sheet">
      <div className="ok-sheet-title">
        <T>{S.chooseAddress}</T>
      </div>
      <div className="ok-coupons">
        {brand.delivery?.addresses.map((a) => (
          <button
            key={a.id}
            type="button"
            className="ok-coupon plain"
            data-hint={`addr:${a.id}`}
            data-on={order.address === a.id || undefined}
            onClick={() => {
              setOrder((o) => ({ ...o, address: a.id }));
              close();
            }}
          >
            <span className="ok-coupon-text">
              <T className="ok-line-name">{a.zh}</T>
              <T className="ok-sub">{a.sub}</T>
            </span>
            <span className="ok-radio" aria-hidden />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function CutlerySheet() {
  const { order, setOrder, go } = useApp();
  const close = () => go({ screen: 'checkout', sheet: null }, 'none');
  return (
    <Sheet onClose={close} label={S.cutlery} className="ok-small-sheet">
      <div className="ok-sheet-title">
        <T>{S.cutlery}</T>
      </div>
      <div className="ok-pills">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className="ok-pill"
            data-hint={`cut:${n}`}
            data-on={order.cutlery === n || undefined}
            onClick={() => {
              setOrder((o) => ({ ...o, cutlery: n }));
              close();
            }}
          >
            {n === 0 ? (
              <T>{S.noCutlery}</T>
            ) : (
              <>
                {n}
                <T>{S.sets}</T>
              </>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------- pay */

function PaySheet() {
  const { brand, order, go, paid, view } = useApp();
  const [digits, setDigits] = useState(0);
  const total = price(brand, order, brand.model === 'table' ? order.placed.flat() : order.lines).total;
  const done = digits >= 6;
  const back = () => go({ screen: view.screen, sheet: null }, 'none');
  return (
    <Sheet onClose={() => !done && back()} label={S.wechatPay} className="ok-pay">
      {done ? (
        <div className="ok-paid">
          <span className="ok-paid-tick" aria-hidden>
            ✓
          </span>
          <T className="ok-paid-title">{S.paid}</T>
          <span className="ok-pay-amount">¥{total.toFixed(2)}</span>
          <T className="ok-sub">{brand.merchant}</T>
          <button type="button" className="ok-btn green" data-hint="pay-pad" onClick={paid}>
            <T>{S.done}</T>
          </button>
        </div>
      ) : (
        <>
          <div className="ok-pay-head">
            <button type="button" className="ok-x inline" aria-label="close" onClick={back}>
              ×
            </button>
            <T>{S.pin}</T>
            <span />
          </div>
          <T className="ok-sub ok-center">{brand.merchant}</T>
          <span className="ok-pay-amount">¥{total.toFixed(2)}</span>
          <div className="ok-kv pay">
            <T className="ok-k">{S.payMethod}</T>
            <span>
              <T>{S.wallet}</T> ›
            </span>
          </div>
          <div className="ok-pin" aria-label={`${digits} of 6 digits`}>
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} data-on={i < digits || undefined} />
            ))}
          </div>
          <p className="ok-practice">Practice — tap any six digits; never type a real password here.</p>
          <div className="ok-pad" data-hint="pay-pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
              k ? (
                <button key={i} type="button" onClick={() => setDigits((d) => (k === '⌫' ? Math.max(0, d - 1) : Math.min(6, d + 1)))}>
                  {k}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------- table: during the meal */

export function TableScreen() {
  const { brand, order, go, toast, toBill } = useApp();
  return (
    <div className="ok-screen ok-checkout">
      <div className="ok-scroll">
        <div className="ok-card ok-center">
          <span className="ok-paid-tick small" aria-hidden>
            ✓
          </span>
          <T className="ok-paid-title">{S.placed}</T>
          <T className="ok-sub">{S.cooking}</T>
          <span className="ok-sub">
            <T>{S.tableNo}</T> <T>{brand.table?.no ?? ''}</T> · {order.diners}
            <T>{S.people}</T>
          </span>
        </div>
        <div className="ok-actions">
          <button type="button" className="ok-action" data-hint="more-btn" onClick={() => go({ screen: 'menu', sheet: null }, 'push')}>
            <b>＋</b>
            <T>{S.more}</T>
          </button>
          <button type="button" className="ok-action" onClick={() => toast(S.waiterCalled)}>
            <b>☏</b>
            <T>{S.callWaiter}</T>
          </button>
          <button type="button" className="ok-action" onClick={() => toast(S.hurried)}>
            <b>⏱</b>
            <T>{S.hurry}</T>
          </button>
        </div>
        <div className="ok-card">
          <div className="ok-sheet-title left">
            <T>{S.orderedDishes}</T>
          </div>
          {order.placed.map((batch, i) => (
            <div key={i}>
              {i > 0 && (
                <div className="ok-batch">
                  <T>{S.more}</T>
                </div>
              )}
              <Lines lines={batch} />
            </div>
          ))}
        </div>
        <div className="ok-list-end" />
      </div>
      <div className="ok-paybar">
        <span>
          <T className="ok-sub">{S.dishes}</T> <Price v={subtotal(brand, order.placed.flat())} />
        </span>
        <button type="button" className="ok-go" data-hint="bill-btn" onClick={toBill}>
          <T>{S.toBill}</T>
        </button>
      </div>
    </div>
  );
}

export function BillScreen() {
  const { brand, order, go, view } = useApp();
  const lines = order.placed.flat();
  const bill = price(brand, order, lines);
  return (
    <div className="ok-screen ok-checkout">
      <div className="ok-scroll">
        <div className="ok-card">
          <div className="ok-kv">
            <T className="ok-k">{S.tableNo}</T>
            <b><T>{brand.table?.no ?? ''}</T></b>
          </div>
          <Lines lines={lines} />
          <div className="ok-kv sum">
            <T className="ok-k">{S.dishes}</T>
            <Price v={bill.items} />
          </div>
          <FeeRows fees={bill.fees} />
          <div className="ok-kv sum">
            <T className="ok-k">{S.total}</T>
            <Price v={bill.total} className="big" />
          </div>
        </div>
        <div className="ok-list-end" />
      </div>
      <div className="ok-paybar">
        <span>
          <T className="ok-sub">{S.total}</T> <Price v={bill.total} className="big" />
        </span>
        <button type="button" className="ok-go" data-hint="pay-btn" onClick={() => go({ screen: 'bill', sheet: { kind: 'pay' } }, 'none')}>
          <T>{S.pay}</T>
        </button>
      </div>
      {view.sheet?.kind === 'pay' && <PaySheet />}
    </div>
  );
}

/* ---------------------------------------------------------------- pickup */

export function PickupScreen() {
  const { brand, order, times, reading, answer, finishOrder } = useApp();
  const table = brand.model === 'table';
  const lines = table ? order.placed.flat() : order.lines;
  const bill = price(brand, order, lines);
  const delivery = order.mode === '外送';
  const address = brand.delivery?.addresses.find((a) => a.id === order.address);
  const read = (k: ReadKey) => ({
    'data-read': k,
    onClick: () => reading?.state !== 'right' && answer(k),
  });
  const code = brand.code ?? { zh: S.code };

  return (
    <div className="ok-screen ok-pickup">
      <div className="ok-scroll">
        {reading && (
          <div className="ok-msg ok-reading" data-state={reading.state}>
            <span className="ok-avatar" aria-hidden>
              {brand.friend.slice(-1)}
            </span>
            <div className="ok-bubble">
              <T>{`${reading.zh}？`}</T>
              <span className="ok-reading-state">
                {reading.state === 'ask' && <T>{`${S.tapIt}。`}</T>}
                {reading.state === 'wrong' && <T>{`${S.wrong}，${S.lookAgain}。`}</T>}
                {reading.state === 'right' && <T>{`${S.right}！`}</T>}
              </span>
            </div>
          </div>
        )}
        {table ? (
          <div className="ok-card ok-center">
            <span className="ok-paid-tick" aria-hidden>
              ✓
            </span>
            <T className="ok-paid-title">{S.billPaid}</T>
            <T className="ok-sub">{S.welcome}</T>
            <button type="button" className="ok-readable" {...read('table')}>
              <T>{S.tableNo}</T> <T>{brand.table?.no ?? ''}</T>
            </button>
          </div>
        ) : delivery ? (
          <div className="ok-card ok-center">
            <ol className="ok-steps">
              <li data-done>
                <T>{S.accepted}</T>
              </li>
              <li data-on>
                <T>{S.riding}</T>
              </li>
            </ol>
            <T className="ok-sub">{S.arrive}</T>
            <button type="button" className="ok-code small" {...read('time')}>
              {times.ready}
            </button>
            {address && (
              <span className="ok-sub">
                <T>{address.zh}</T> <T>{address.sub}</T>
              </span>
            )}
          </div>
        ) : (
          <div className="ok-card ok-center">
            <ol className="ok-steps">
              <li data-done>
                <T>{S.ordered}</T>
              </li>
              <li data-on>
                <T>{S.making}</T>
              </li>
              <li>
                <T>{S.collect}</T>
              </li>
            </ol>
            <T className="ok-sub">{code.zh}</T>
            <button type="button" className="ok-code" {...read('code')}>
              {code.prefix ? `${code.prefix}${times.code.slice(1)}` : times.code}
            </button>
            {brand.model === 'counter' ? <T className="ok-accent">{S.listen}</T> : <FakeQr seed={times.code} />}
            <span className="ok-accent">
              <T>{S.expect}</T> {times.minutes} <T>{S.minutes}</T>
            </span>
            <button type="button" className="ok-readable" {...read('time')}>
              <T>{S.expect}</T> {times.ready} <T>{S.ready}</T>
            </button>
            <T className="ok-sub">{brand.store.zh}</T>
          </div>
        )}
        <div className="ok-card">
          <div className="ok-sheet-title left">
            <T>{S.details}</T>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="ok-kv">
              <span>
                <T>{itemOf(brand, l.item).zh}</T> <Spec line={l} /> <span className="ok-sub">×{l.qty}</span>
              </span>
              <Price v={lineTotal(brand, l)} />
            </div>
          ))}
          <FeeRows fees={bill.fees} read={read} />
          {!table && (
            <div className="ok-kv">
              <T className="ok-k">{S.saved}</T>
              <button type="button" className="ok-readable" {...read('saved')}>
                −¥{yuan(bill.discount + bill.promo)}
              </button>
            </div>
          )}
          <div className="ok-kv">
            <T className="ok-k">{S.paidAmount}</T>
            <button type="button" className="ok-readable" {...read('total')}>
              <Price v={bill.total} />
            </button>
          </div>
          {!table && !delivery && (
            <div className="ok-kv">
              <T className="ok-k">{S.dine}</T>
              <T>{order.dine ?? ''}</T>
            </div>
          )}
          <div className="ok-kv">
            <T className="ok-k">{S.orderTime}</T>
            <span className="ok-sub">{times.ordered}</span>
          </div>
        </div>
        <div className="ok-list-end" />
      </div>
      <div className="ok-paybar">
        <span />
        <button type="button" className="ok-go" data-hint="pickup-done" disabled={!!reading && reading.state !== 'right'} onClick={finishOrder}>
          <T>{S.done}</T>
        </button>
      </div>
    </div>
  );
}
