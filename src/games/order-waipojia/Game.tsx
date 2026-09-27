import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { waipojia } from './menu';

/** 外婆家: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={waipojia} {...props} />;
}
