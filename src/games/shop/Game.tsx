import { useState } from 'react';
import { say } from '../../platform/audio/voiceOut';
import { Feedback } from '../kit/Feedback';
import { Photo } from '../kit/Photo';
import { useRounds } from '../kit/useRounds';
import type { GameProps } from '../types';
import { buildShop, itemsOf, MONEY, priceZh, pricePy, total, type ShopRound } from './content';
import './game.css';

/** Read the price tag, put the money in the tray; or say which is cheaper. */
export default function ShopGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() => buildShop(ctx));
  const r = useRounds<ShopRound>(rounds, { report, finish }, (round) =>
    round.kind === 'pay'
      ? { prompt: `${round.thing.w}：${priceZh(round.price)}`, answer: priceZh(round.price), items: itemsOf(round) }
      : {
          prompt: '哪个便宜？',
          answer: round.pa < round.pb ? round.a.w : round.b.w,
          items: itemsOf(round),
        },
  );
  const round = r.round;
  return (
    <div className="g-shop">
      {round.kind === 'pay' ? (
        <Pay key={r.index} round={round} r={r} />
      ) : (
        <Cheaper key={r.index} round={round} r={r} />
      )}
    </div>
  );
}

function Tag({ word, price, done }: { word: string; price: number; done: boolean }) {
  return (
    <div className="g-tag">
      <Photo word={word} />
      <div className="g-tag-price">
        <span className="hanzi">{priceZh(price)}</span>
        <span className="tiny" style={{ color: 'var(--accent)' }}>
          {done ? pricePy(price) : ' '}
        </span>
      </div>
    </div>
  );
}

function Pay({ round, r }: { round: Extract<ShopRound, { kind: 'pay' }>; r: ReturnType<typeof useRounds<ShopRound>> }) {
  const [tray, setTray] = useState<number[]>([]);
  const sum = total(tray);
  return (
    <>
      <p className="g-prompt small muted">Put the money for it in the tray, then pay.</p>
      <Tag word={round.thing.w} price={round.price} done={r.done} />
      <div className="g-tray" aria-label={`in the tray: ${sum}`}>
        {tray.length === 0 && <span className="tiny muted">the tray is empty</span>}
        {tray.map((v, i) => (
          <button
            key={i}
            type="button"
            className="g-money"
            data-v={v}
            disabled={r.done}
            onClick={() => setTray(tray.filter((_, j) => j !== i))}
            aria-label={`take back ${v}`}
          >
            ¥{v}
          </button>
        ))}
        <span className="g-tray-sum">¥{sum}</span>
      </div>
      <div className="g-purse">
        {MONEY.map((v) => (
          <button
            key={v}
            type="button"
            className="g-money"
            data-v={v}
            disabled={r.done || tray.length >= 12}
            onClick={() => setTray([...tray, v].sort((a, b) => b - a))}
            aria-label={`add ${v}`}
          >
            ¥{v}
          </button>
        ))}
      </div>
      <div className="g-shop-pay">
        <button
          type="button"
          className="btn primary"
          disabled={r.done || tray.length === 0}
          onClick={() => {
            const ok = sum === round.price;
            if (ok) void say(priceZh(round.price));
            r.answer(ok);
          }}
        >
          Pay
        </button>
      </div>
      <Feedback
        r={r}
        answer={
          <>
            It was <span className="hanzi">{priceZh(round.price)}</span> — ¥{round.price}
          </>
        }
      />
    </>
  );
}

function Cheaper({
  round,
  r,
}: {
  round: Extract<ShopRound, { kind: 'cheaper' }>;
  r: ReturnType<typeof useRounds<ShopRound>>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const right = round.pa < round.pb ? round.a.w : round.b.w;
  const pick = (w: string) => {
    if (r.done || picked.includes(w)) return;
    setPicked([...picked, w]);
    if (w === right) void say(w);
    r.answer(w === right);
  };
  return (
    <>
      <div className="g-ask">哪个便宜？</div>
      <div className="g-ask-py">nǎge piányi? — which is cheaper?</div>
      <div className="g-cheaper">
        {[
          [round.a.w, round.pa],
          [round.b.w, round.pb],
        ].map(([w, p]) => (
          <button
            key={w}
            type="button"
            className="g-tile"
            data-state={r.done && w === right ? 'right' : picked.includes(w as string) && w !== right ? 'wrong' : undefined}
            disabled={r.done}
            onClick={() => pick(w as string)}
          >
            <Tag word={w as string} price={p as number} done={r.done} />
          </button>
        ))}
      </div>
      <Feedback r={r} answer={<span className="hanzi">{right}</span>} />
    </>
  );
}
