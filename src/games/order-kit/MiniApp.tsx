import type { ReactNode } from 'react';
import { useApp } from './app';
import { T } from './help';
import { CartSheet, ChatScreen, CheckoutScreen, EmptyTab, HomeScreen, MenuScreen, PickupScreen, SpecSheet } from './screens';
import { S } from './strings';

/**
 * The phone: a WeChat mini-program frame around the current screen.
 *
 * A nav bar with the page title in the middle and the WeChat capsule on the
 * right (every mini-program has it; it is WeChat's, not the shop's — here a
 * tap on it only says 练习模式), the screen itself, and the tab bar on the
 * pages that have one. Screens slide in when pushed and out when popped.
 */
export function MiniApp({
  dir,
  toast,
  overlay,
}: {
  dir: 'push' | 'pop' | 'none';
  toast: { zh: string; id: number } | null;
  overlay?: ReactNode;
}) {
  const app = useApp();
  const { brand, view, go } = app;
  const s = view.screen;
  const title =
    s === 'chat'
      ? brand.friend
      : s === 'checkout'
        ? S.confirm
        : s === 'pickup'
          ? S.details
          : s === 'orders'
            ? S.tabOrders
            : s === 'me'
              ? S.tabMe
              : brand.name;
  const back = s === 'checkout' ? () => go({ screen: 'menu', sheet: null }, 'pop') : s === 'menu' ? () => go({ screen: 'home', sheet: null }, 'pop') : null;
  const tabs = s === 'home' || s === 'menu' || s === 'orders' || s === 'me';

  return (
    <div className="ok-app" data-screen={s} data-chat={s === 'chat' || undefined}>
      <div className="ok-status" aria-hidden />
      <div className="ok-nav">
        <span className="ok-nav-side">
          {back && (
            <button type="button" className="ok-back" aria-label="back" data-hint="nav-back" onClick={back}>
              ‹
            </button>
          )}
        </span>
        <span className="ok-nav-title">
          <T>{title}</T>
        </span>
        <span className="ok-nav-side right">
          {s !== 'chat' && (
            <button type="button" className="ok-capsule" aria-label="WeChat menu" onClick={() => app.toast(S.practice)}>
              <span aria-hidden>···</span>
              <i aria-hidden />
              <span aria-hidden>◎</span>
            </button>
          )}
        </span>
      </div>
      <div className="ok-stack">
        <div className="ok-page" key={s} data-dir={dir}>
          {s === 'chat' && <ChatScreen />}
          {s === 'home' && <HomeScreen />}
          {s === 'menu' && <MenuScreen />}
          {(s === 'orders' || s === 'me') && <EmptyTab which={s} />}
          {s === 'checkout' && <CheckoutScreen />}
          {s === 'pickup' && <PickupScreen />}
        </div>
        {s === 'menu' && view.sheet?.kind === 'spec' && (
          <SpecSheet key={view.sheet.item} itemId={view.sheet.item} choices={view.sheet.choices} />
        )}
        {s === 'menu' && view.sheet?.kind === 'cart' && <CartSheet />}
      </div>
      {tabs && <TabBar />}
      {toast && (
        <div className="ok-toast" role="status" key={toast.id}>
          <T>{toast.zh}</T>
        </div>
      )}
      {overlay}
    </div>
  );
}

function TabBar() {
  const { view, go, order, toast } = useApp();
  const tab = (id: 'home' | 'menu' | 'cart' | 'orders' | 'me', zh: string, icon: ReactNode) => {
    const on =
      id === 'cart' ? view.sheet?.kind === 'cart' : id === 'menu' ? view.screen === 'menu' && view.sheet?.kind !== 'cart' : view.screen === id;
    return (
      <button
        type="button"
        data-on={on || undefined}
        data-hint={`tab:${id}`}
        onClick={() =>
          id === 'cart'
            ? order.lines.length
              ? go({ screen: 'menu', sheet: { kind: 'cart' } }, 'none')
              : toast(S.emptyCart)
            : go({ screen: id, sheet: null }, 'none')
        }
      >
        <span className="ok-tab-icon" aria-hidden>
          {icon}
        </span>
        <T>{zh}</T>
      </button>
    );
  };
  return (
    <nav className="ok-tabbar">
      {tab('home', S.tabHome, <Icon d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />)}
      {tab('menu', S.tabMenu, <Icon d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2" />)}
      {tab('cart', S.tabCart, <Icon d="M3 5h2.5l2.2 10h10l2-7H7M9.5 19.5h.01M16.5 19.5h.01" />)}
      {tab('orders', S.tabOrders, <Icon d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />)}
      {tab('me', S.tabMe, <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />)}
    </nav>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
