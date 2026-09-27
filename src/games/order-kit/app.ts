import { createContext, useContext } from 'react';
import type { View } from './order';
import type { Brand, Order, Task } from './types';

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
  /** null when just browsing */
  task: Task | null;
  /** 去支付: checked against the task; the pay sheet opens if it is right */
  submit(): void;
  /** 完成 on the payment sheet */
  paid(): void;
  /** 完成 on the pickup screen */
  finishOrder(): void;
  times: { ordered: string; ready: string; minutes: number; code: string };
  /** the question on the pickup screen, from level 2 */
  reading: { zh: string; key: ReadKey; state: 'ask' | 'wrong' | 'right' } | null;
  answer(key: ReadKey): void;
  /** the item whose sheet was open last, for the map's 选规格 */
  lastItem: string | null;
}

export type ReadKey = 'code' | 'total' | 'time' | 'saved';

export const AppContext = createContext<AppApi | null>(null);
export const AppProvider = AppContext.Provider;

export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error('outside the mini-app');
  return a;
}
