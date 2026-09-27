import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { haidilao } from './menu';

/** 海底捞: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={haidilao} {...props} />;
}
