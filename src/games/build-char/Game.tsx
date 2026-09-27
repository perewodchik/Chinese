import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { say } from '../../platform/audio/voiceOut';
import { Feedback } from '../kit/Feedback';
import { Photo } from '../kit/Photo';
import { useRounds } from '../kit/useRounds';
import type { GameProps } from '../types';
import { buildChars, itemsOf, type BuildRound } from './content';
import './game.css';

/** The meaning and the reading; put two parts from the tray into the frame. */
export default function BuildGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() => buildChars(ctx));
  const r = useRounds<BuildRound>(rounds, { report, finish }, (round) => ({
    prompt: `${round.char.py[0]} — ${round.gloss}`,
    answer: round.char.c,
    items: itemsOf(round),
  }));
  return <Round key={r.index} round={r.round} r={r} hasPhoto={Boolean(ctx.pictureOf(r.round.char.c))} />;
}

function Round({
  round,
  r,
  hasPhoto,
}: {
  round: BuildRound;
  r: ReturnType<typeof useRounds<BuildRound>>;
  hasPhoto: boolean;
}) {
  const [slots, setSlots] = useState<Array<string | null>>([null, null]);
  const place = (part: string) => {
    if (r.done || slots.includes(part)) return;
    const i = slots.indexOf(null);
    if (i < 0) return;
    const next = [...slots];
    next[i] = part;
    setSlots(next);
    if (next.every(Boolean)) {
      const ok = next[0] === round.parts[0] && next[1] === round.parts[1];
      if (ok) void say(round.char.c);
      r.answer(ok);
      if (!ok) window.setTimeout(() => setSlots([null, null]), 700);
    }
  };
  const shown = r.status === 'shown' ? round.parts : slots;
  return (
    <div className="g-build">
      <div className="g-build-top">
        {hasPhoto && (
          <span className="g-build-photo">
            <Photo word={round.char.c} />
          </span>
        )}
        <div>
          <div className="g-build-py">{round.char.py[0]}</div>
          <div className="g-build-gloss">{round.gloss}</div>
        </div>
      </div>
      <div className="g-build-frame" data-layout={round.layout} data-done={r.done || undefined}>
        {r.done ? (
          <span className="g-build-whole hanzi">{round.char.c}</span>
        ) : (
          [0, 1].map((i) => (
            <button
              key={i}
              type="button"
              className="g-build-slot hanzi"
              data-filled={shown[i] ? true : undefined}
              data-state={r.status === 'wrong' ? 'wrong' : undefined}
              onClick={() => {
                if (!shown[i] || r.done) return;
                const next = [...slots];
                next[i] = null;
                setSlots(next);
              }}
              aria-label={shown[i] ? `take ${shown[i]} out` : 'empty'}
            >
              {shown[i] ?? ''}
            </button>
          ))
        )}
      </div>
      <div className="g-build-tray">
        {round.tray.map((p) => (
          <button
            key={p}
            type="button"
            className="g-build-part hanzi"
            disabled={r.done || slots.includes(p)}
            onClick={() => place(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <Feedback
        r={r}
        answer={
          <>
            <span className="hanzi">
              {round.parts[0]} + {round.parts[1]} = {round.char.c}
            </span>
          </>
        }
      >
        {r.done && round.char.radNum ? (
          <Link className="tiny" to={paths.family(round.char.radNum)}>
            its radical’s family
          </Link>
        ) : null}
      </Feedback>
    </div>
  );
}
