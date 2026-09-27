import { OrderGame } from '../order-kit/OrderGame';
import type { GameProps } from '../types';
import { luckin } from './menu';

/** 瑞幸咖啡: the kit's mini-app, with luckin's menu. */
export default function LuckinGame(props: GameProps) {
  return <OrderGame brand={luckin} {...props} />;
}
