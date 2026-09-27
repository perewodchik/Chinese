import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { dimsum } from './menu';

/** 点都德: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={dimsum} {...props} />;
}
