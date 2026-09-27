import { useEffect, useState } from 'react';
import { say, unlockAudio } from '../../platform/audio/voiceOut';
import { ChoiceGame } from '../kit/ChoiceGame';
import { gist } from '../kit/pool';
import { Photo } from '../kit/Photo';
import type { GameProps } from '../types';
import { buildListen, itemsOf, type ListenRound } from './content';
import './game.css';

/** A word said by a native speaker; which photo is it? */
export default function ListenGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildListen(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({ ...o, label: `photo ${o.id}`, body: <Photo word={o.id} /> })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      describe={(r) => ({ prompt: gist(r.word.d), answer: r.word.w, items: itemsOf(r) })}
      stage={(r, s) => <Hear key={r.word.w} round={r} done={s.done} />}
      answer={(r) => (
        <>
          <span className="hanzi">{r.word.w}</span> {r.word.py} — {gist(r.word.d)}
        </>
      )}
    />
  );
}

function Hear({ round, done }: { round: ListenRound; done: boolean }) {
  // Said as soon as the prompt appears; the button says it again.
  useEffect(() => {
    void say(round.word.w);
  }, [round.word.w]);
  return (
    <div className="g-listen">
      <button
        type="button"
        className="g-hear"
        onClick={() => {
          unlockAudio();
          void say(round.word.w);
        }}
        aria-label="Hear it again"
      >
        <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
          <path d="M8 18h8l10-8v28l-10-8H8z" />
          <path d="M32 16a10 10 0 0 1 0 16M36 11a16 16 0 0 1 0 26" fill="none" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>
      <div className="g-ask" style={{ minHeight: 44 }}>
        {done ? round.word.w : ' '}
      </div>
      <div className="g-ask-py">{done ? round.word.py : 'Listen, then tap the photo.'}</div>
    </div>
  );
}
