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
  unitPrice,
  usable,
  yuan,
} from './order';
import { S } from './strings';
import { CartIcon, FakeQr, MenuPhoto, PhotoCredit, Price, Sheet, Stepper, Was } from './ui';
import type { MenuItem } from './types';

/**
 * The screens of a chain-shop mini-program — 瑞幸 now, 蜜雪冰城 next — in
 * the order the learner meets them. Each reads the app state from useApp()
 * and draws itself in the WeChat look; every Chinese string goes through <T>.
 */

/* ------------------------------------------------------------------ chat */

export function ChatScreen() {
  const { brand, task, go } = useApp();
  return (
    <div className="ok-screen ok-chat">
      <div className="ok-scroll">
        {task && (
          <div className="ok-msg">
            <span className="ok-avatar" aria-hidden>
              {brand.friend.slice(-1)}
            </span>
            <div className="ok-bubble">
              <T>{task.message}</T>
            </div>
          </div>
        )}
        <div className="ok-msg">
          <span className="ok-avatar" aria-hidden>
            {brand.friend.slice(-1)}
          </span>
          <button type="button" className="ok-mp-card" data-hint="chat-card" onClick={() => go({ screen: 'home', sheet: null }, 'push')}>
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
              <T>{S.miniProgram}</T>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ home */

export function HomeScreen() {
  const { brand, go, toast } = useApp();
  const fresh = brand.items.filter((i) => i.cats.includes('new')).slice(0, 3);
  return (
    <div className="ok-screen ok-home">
      <div className="ok-scroll">
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
        <div className="ok-entries">
          <button type="button" className="ok-entry" data-hint="home-pickup" onClick={() => go({ screen: 'menu', sheet: null }, 'push')}>
            <b>
              <T>{S.pickupHere}</T>
            </b>
            <T className="ok-sub">{S.skipQueue}</T>
          </button>
          <button type="button" className="ok-entry" onClick={() => toast(S.deliverySoon)}>
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

/* ------------------------------------------------------------------ menu */

export function MenuScreen() {
  const { brand, go, toast } = useApp();
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

  let firstButton = true;
  return (
    <div className="ok-screen ok-menu">
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
          <button type="button" data-on>
            <T>{S.pickup}</T>
          </button>
          <button type="button" onClick={() => toast(S.deliverySoon)}>
            <T>{S.delivery}</T>
          </button>
        </span>
      </div>
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

function ProductRow({ item, onOpen, tour }: { item: MenuItem; onOpen(): void; tour: boolean }) {
  const { brand, setOrder, toast } = useApp();
  const sheet = needsSheet(brand, item);
  const only = item.only?.temp?.length === 1 && item.only.temp[0] === 'ice';
  return (
    <div className="ok-row" role="button" tabIndex={0} data-hint={`item:${item.id}`} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <MenuPhoto photo={item.photo} />
      <div className="ok-row-text">
        <T className="ok-row-name">{item.zh}</T>
        <T className="ok-row-desc">{item.desc}</T>
        <span className="ok-tags">
          {item.tags?.map((t) => (
            <T key={t} className="ok-tag">
              {t}
            </T>
          ))}
          {only && <T className="ok-tag quiet">{S.onlyIced}</T>}
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
              <Price v={item.price} className="deal" />
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
  const bill = price(brand, order);
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
            <Price v={bill.total} />
            {bill.discount > 0 && <Was v={bill.items} />}
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
        <T>{S.checkout}</T>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ spec sheet */

export function SpecSheet({ itemId, choices }: { itemId: string; choices: Record<string, string[]> }) {
  const { brand, go, setOrder, toast } = useApp();
  const item = itemOf(brand, itemId);
  const [qty, setQtyState] = useState(1);
  const body = useRef<HTMLDivElement>(null);
  const set = (c: Record<string, string[]>) => go({ screen: 'menu', sheet: { kind: 'spec', item: itemId, choices: c } }, 'none');
  const close = () => go({ screen: 'menu', sheet: null }, 'none');
  const unit = unitPrice(brand, { item: itemId, choices });

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
          <T className="ok-row-desc">{item.desc}</T>
          <PhotoCredit photo={item.photo} />
        </div>
      </div>
      <div className="ok-spec-body" ref={body}>
        {item.groups.map((gid) => {
          const g = groupOf(brand, gid);
          const off = disabled(brand, choices, gid);
          return (
            <div key={gid} className="ok-group" data-hint={`group:${gid}`}>
              <div className="ok-group-name">
                <T>{g.zh}</T>
              </div>
              <div className="ok-pills">
                {offered(brand, item, gid).map((o) => (
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
                    {o.delta ? <span className="ok-pill-sub">+¥{yuan(o.delta)}</span> : null}
                  </button>
                ))}
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
          <Stepper qty={qty} min={1} onMinus={() => setQtyState(Math.max(1, qty - 1))} onPlus={() => setQtyState(Math.min(9, qty + 1))} />
        </div>
        <div className="ok-spec-actions">
          <button type="button" className="ok-btn ghost" onClick={() => add('checkout')}>
            <T>{S.buyNow}</T>
          </button>
          <button type="button" className="ok-btn" data-hint="spec-add" onClick={() => add('close')}>
            <T>{S.addToCart}</T>
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ cart */

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
              <span className="ok-line-spec">
                {specText(brand, l).map((z, j) => (
                  <span key={j}>
                    {j > 0 && '/'}
                    <T>{z}</T>
                  </span>
                ))}
              </span>
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

export function CheckoutScreen() {
  const app = useApp();
  const { brand, order, setOrder, go, toast, times, view } = app;
  const bill = price(brand, order);
  const usableCount = brand.coupons.filter((c) => usable(brand, order.lines, c)).length;
  const n = count(order.lines);

  return (
    <div className="ok-screen ok-checkout">
      <div className="ok-scroll">
        <div className="ok-card">
          <span className="ok-seg wide" role="group">
            <button type="button" data-on>
              <T>{S.pickup}</T>
            </button>
            <button type="button" onClick={() => toast(S.deliverySoon)}>
              <T>{S.delivery}</T>
            </button>
          </span>
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
              {([S.eatIn, S.takeAway] as const).map((d) => (
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
        </div>

        <div className="ok-card">
          {order.lines.map((l, i) => (
            <div key={i} className="ok-line">
              <MenuPhoto photo={itemOf(brand, l.item).photo} className="sm" />
              <div className="ok-line-text">
                <T className="ok-line-name">{itemOf(brand, l.item).zh}</T>
                <span className="ok-line-spec">
                  {specText(brand, l).map((z, j) => (
                    <span key={j}>
                      {j > 0 && '/'}
                      <T>{z}</T>
                    </span>
                  ))}
                </span>
              </div>
              <span className="ok-line-right">
                <Price v={lineTotal(brand, l)} />
                <span className="ok-sub">×{l.qty}</span>
              </span>
            </div>
          ))}
          <div className="ok-kv sum">
            <span className="ok-sub">
              <T>{S.inAll}</T> {n} <T>{S.pieces}</T>
            </span>
            <span>
              <T className="ok-sub">{S.itemsTotal}</T> <Price v={bill.items} />
            </span>
          </div>
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
          <button type="button" className="ok-kv link" data-hint="note-row" onClick={() => go({ screen: 'checkout', sheet: { kind: 'note' } }, 'none')}>
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
                  {order.noteText && <span>{order.note.length ? '，' : ''}{order.noteText}</span>}
                </>
              ) : (
                <T>{S.none}</T>
              )}{' '}
              ›
            </span>
          </button>
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
          {bill.discount > 0 && (
            <span className="ok-sub">
              {' '}
              <T>{S.saved}</T>¥{yuan(bill.discount)}
            </span>
          )}
        </span>
        <button
          type="button"
          className="ok-go"
          data-hint="pay-btn"
          disabled={!n}
          onClick={() => {
            if (!order.dine) {
              toast(`${S.choose}${S.dine}`);
              return;
            }
            app.submit();
          }}
        >
          <T>{S.pay}</T>
        </button>
      </div>

      {view.sheet?.kind === 'coupon' && <CouponSheet />}
      {view.sheet?.kind === 'note' && <NoteSheet />}
      {view.sheet?.kind === 'pay' && <PaySheet />}
    </div>
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
  const { brand, order, setOrder, go } = useApp();
  const close = () => go({ screen: 'checkout', sheet: null }, 'none');
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

/* ------------------------------------------------------------------- pay */

function PaySheet() {
  const { brand, order, go, paid } = useApp();
  const [digits, setDigits] = useState(0);
  const total = price(brand, order).total;
  const done = digits >= 6;
  return (
    <Sheet onClose={() => !done && go({ screen: 'checkout', sheet: null }, 'none')} label={S.wechatPay} className="ok-pay">
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
            <button type="button" className="ok-x inline" aria-label="close" onClick={() => go({ screen: 'checkout', sheet: null }, 'none')}>
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

/* ---------------------------------------------------------------- pickup */

export function PickupScreen() {
  const { brand, order, times, reading, answer, finishOrder } = useApp();
  const bill = price(brand, order);
  const read = (k: ReadKey) => ({
    'data-read': k,
    onClick: () => reading?.state !== 'right' && answer(k),
  });
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
          <T className="ok-sub">{S.code}</T>
          <button type="button" className="ok-code" {...read('code')}>
            {times.code}
          </button>
          <FakeQr seed={times.code} />
          <span className="ok-accent">
            <T>{S.expect}</T> {times.minutes} <T>{S.minutes}</T>
          </span>
          <button type="button" className="ok-readable" {...read('time')}>
            <T>{S.expect}</T> {times.ready} <T>{S.ready}</T>
          </button>
          <T className="ok-sub">{brand.store.zh}</T>
        </div>
        <div className="ok-card">
          <div className="ok-sheet-title left">
            <T>{S.details}</T>
          </div>
          {order.lines.map((l, i) => (
            <div key={i} className="ok-kv">
              <span>
                <T>{itemOf(brand, l.item).zh}</T>{' '}
                <span className="ok-sub">
                  {specText(brand, l).map((z, j) => (
                    <span key={j}>
                      {j > 0 && '/'}
                      <T>{z}</T>
                    </span>
                  ))}{' '}
                  ×{l.qty}
                </span>
              </span>
              <Price v={lineTotal(brand, l)} />
            </div>
          ))}
          <div className="ok-kv">
            <T className="ok-k">{S.saved}</T>
            <button type="button" className="ok-readable" {...read('saved')}>
              −¥{yuan(bill.discount)}
            </button>
          </div>
          <div className="ok-kv">
            <T className="ok-k">{S.paidAmount}</T>
            <button type="button" className="ok-readable" {...read('total')}>
              <Price v={bill.total} />
            </button>
          </div>
          <div className="ok-kv">
            <T className="ok-k">{S.dine}</T>
            <T>{order.dine ?? ''}</T>
          </div>
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
