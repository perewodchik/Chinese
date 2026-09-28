import { createContext, useContext } from 'react';
import type { View } from './order';
import type { Brand, Order, Stage, Task } from './types';

/**
 * What every screen of the mini-app can see and do. The game (OrderGame)
 * holds the state; the screens only read it and call these.
 */
export interface AppApi {
  brand: Brand;
  order: Order;
  setOrder(fn: (o: Order) => Order): void;
  view: View;
  go(v: View, dir?: 'push' | 'pop' | 'none'): void;
  toast(zh: string): void;
  /**
   * The WeChat capsule, when the mini-app fills a phone's screen: ··· opens
   * the guide and ◎ leaves the shop, as they open the menu and close the
   * mini-program in WeChat. Absent beside the guide, where both are in view.
   */
  capsule: { more(): void; close(): void } | null;
  /** null when just browsing */
  task: Task | null;
  /** the 加菜 message, once it has arrived */
  later: Stage | null;
  /**
   * 去支付 (chain, counter) or 下单 (table): checked against the task; the pay
   * sheet opens, or the batch goes to the kitchen, when it is right
   */
  submit(): void;
  /** 去买单 (table): whatever the friend still wants is checked first */
  toBill(): void;
  /** 完成 on the payment sheet */
  paid(): void;
  /** 完成 on the pickup screen */
  finishOrder(): void;
  times: { ordered: string; ready: string; minutes: number; code: string };
  /** the question on the last screen, from level 2 */
  reading: { zh: string; key: ReadKey; state: 'ask' | 'wrong' | 'right' } | null;
  answer(key: ReadKey): void;
  /** the item whose sheet was open last, for the map's 选规格 */
  lastItem: string | null;
}

export type ReadKey = 'code' | 'total' | 'time' | 'saved' | 'table' | 'fee';

export const AppContext = createContext<AppApi | null>(null);
export const AppProvider = AppContext.Provider;

export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error('outside the mini-app');
  return a;
}
