import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { majiyong } from './menu';

/** 马记永: the kit's mini-app, with its menu. */
export default function Game(props: GameProps) {
  return <OrderGame brand={majiyong} {...props} />;
}
