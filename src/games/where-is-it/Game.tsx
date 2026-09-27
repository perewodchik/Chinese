import { useCallback, useRef, useState } from 'react';
import { say } from '../../platform/audio/voiceOut';
import { Feedback } from '../kit/Feedback';
import { useGameKeys } from '../kit/keys';
import { Photo } from '../kit/Photo';
import { Tiles } from '../kit/Tiles';
import { useDrag } from '../kit/useDrag';
import { useRounds, type Rounds } from '../kit/useRounds';
import type { GameProps } from '../types';
import {
  buildWhere,
  itemsOf,
  sentence,
  sentencePy,
  spotFor,
  zonesOf,
  type DragRound,
  type PickRound,
  type WhereRound,
} from './content';
import { AnchorDrawing } from './Scene';
import './game.css';

const START = { x: 0.12, y: 0.16 };

/** 「猫在桌子下面。」 — drag the cat there. Or: which sentence says where it is? */
export default function WhereGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() => buildWhere(ctx));
  const r = useRounds<WhereRound>(rounds, { report, finish }, (round) => ({
    prompt: sentence(round),
    answer: round.place.w,
    items: itemsOf(round),
  }));
  const round = r.round;
  return round.kind === 'drag' ? <Drag key={r.index} round={round} r={r} /> : <Pick key={r.index} round={round} r={r} />;
}

function Ask({ round, r }: { round: WhereRound; r: Rounds<WhereRound> }) {
  const [py, setPy] = useState(false);
  return (
    <>
      <button type="button" className="g-ask g-ask-btn" onClick={() => setPy(true)} title="Show the pinyin">
        {sentence(round)}
      </button>
      <div className="g-ask-py">{py || r.done ? sentencePy(round) : 'Tap the sentence for pinyin.'}</div>
    </>
  );
}

function Drag({ round, r }: { round: DragRound; r: Rounds<WhereRound> }) {
  const stage = useRef<HTMLDivElement>(null);
  // "outside" has to be a move: for that one the thing starts inside
  const start = round.place.rel === 'out' ? spotFor('in', round.anchor) : START;
  const [at, setAt] = useState<{ x: number; y: number }>(start);
  const onDrop = useCallback(
    (_: string, p: { x: number; y: number }) => {
      if (r.done) return;
      const ok = zonesOf(p, round.anchor).has(round.place.rel);
      setAt(p);
      if (ok) void say(sentence(round));
      r.answer(ok);
      if (!ok) window.setTimeout(() => setAt(start), 700);
    },
    [r, round, start],
  );
  const drag = useDrag(stage, onDrop, r.done);
  const { style: dragStyle, ...handlers } = drag.bind('mover');
  const spot = r.status === 'shown' ? spotFor(round.place.rel, round.anchor) : null;
  const pos = spot ?? at;
  return (
    <div className="g-where">
      <Ask round={round} r={r} />
      <div className="g-where-stage" ref={stage}>
        <AnchorDrawing anchor={round.anchor} />
        <span className="g-where-label hanzi" style={{ left: `${(round.anchor.box.x + round.anchor.box.w / 2) * 100}%`, top: `${(round.anchor.box.y + round.anchor.box.h) * 100 + 3}%` }}>
          {round.anchor.w}
        </span>
        <span
          className="g-where-token"
          data-state={r.status}
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, ...dragStyle }}
          {...handlers}
          aria-label={`drag the ${round.mover.w}`}
        >
          <Photo word={round.mover.w} />
          <span className="g-where-name hanzi">{round.mover.w}</span>
        </span>
      </div>
      <Feedback
        r={r}
        answer={
          <>
            <span className="hanzi">{round.place.w}</span> {round.place.py} — there.
          </>
        }
      >
        {r.status === 'asking' && !r.misses && <span className="tiny muted">Drag the {round.mover.w} into place.</span>}
      </Feedback>
    </div>
  );
}

function Pick({ round, r }: { round: PickRound; r: Rounds<WhereRound> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const spot = spotFor(round.place.rel, round.anchor);
  const pick = useCallback(
    (id: string) => {
      if (r.done || picked.includes(id)) return;
      setPicked((p) => [...p, id]);
      if (id === round.right) void say(round.right);
      r.answer(id === round.right);
    },
    [r, picked, round],
  );
  useGameKeys(
    useCallback((n: number) => round.options[n] && pick(round.options[n].id), [round, pick]),
    r.status === 'shown' ? r.next : null,
  );
  return (
    <div className="g-where">
      <div className="g-ask">{round.mover.w}在哪儿？</div>
      <div className="g-ask-py">{r.done ? sentencePy(round) : `${round.mover.py} zài nǎr? — where is it?`}</div>
      <div className="g-where-stage" data-depth={spot.behind ? 'behind' : 'front'}>
        <span
          className="g-where-token"
          data-fixed
          data-behind={spot.behind || undefined}
          style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, transform: `translate(-50%, -50%) scale(${spot.scale})` }}
        >
          <Photo word={round.mover.w} />
        </span>
        <AnchorDrawing anchor={round.anchor} />
      </div>
      <Tiles
        options={round.options.map((o) => ({ ...o, body: <span className="hanzi g-where-option">{o.label}</span> }))}
        right={round.right}
        picked={picked}
        r={r as Rounds<unknown>}
        onPick={pick}
      />
      <Feedback r={r} answer={<span className="hanzi">{round.right}</span>} />
    </div>
  );
}
