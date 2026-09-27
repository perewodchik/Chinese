import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { mixue } from './menu';

/** 蜜雪冰城: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={mixue} {...props} />;
}
