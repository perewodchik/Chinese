import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { xijiade } from './menu';

/** 喜家德: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={xijiade} {...props} />;
}
