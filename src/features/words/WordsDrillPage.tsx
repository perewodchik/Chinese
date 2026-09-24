import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { idValue, type ItemId } from '../../domain/ids';
import type { Rating } from '../../domain/memory';
import { hskLabel } from '../../domain/text';
import { planWordSitting } from '../../domain/wordReview';
import { wordInfo } from '../../domain/words';
import { paths } from '../../navigation/paths';
import { say } from '../../platform/audio/voiceOut';
import { getState } from '../../store/store';
import { Say } from '../../ui/Say';
import { useTitle } from '../../ui/useTitle';
import { DrillDone, DrillFrame, RatingRow, useDrillRun, useRevealKeys } from '../review/DrillFrame';
import { sittingSize } from '../review/drills';
import { useLibrary } from '../shared/library';
import './words.css';
import { WordPicture } from './WordPicture';

/** One sitting of words, at /review/words?n=30. */
export function WordsDrillPage() {
  useTitle('Words');
  const [query] = useSearchParams();
  const size = sittingSize(query.get('n'));
  return <Sitting key={size} size={size} />;
}

function Sitting({ size }: { size: number }) {
  const navigate = useNavigate();
  // Chosen once, as the sitting starts — see DrillPage for why. Which of them
  // are new is fixed then too: a new word is shown, not asked.
  const [sitting] = useState(() => {
    const { recall, collections, settings } = getState();
    const { ids } = planWordSitting(recall, collections, size, settings.newWordsPerDay, Date.now());
    return { ids, fresh: new Set(ids.filter((id) => !recall[id]?.recognise)) };
  });
  const exit = () => navigate(paths.review(), { replace: true });

  if (!sitting.ids.length) {
    return (
      <div className="empty">
        <span className="big">空</span>
        <p>No word is due, and none is waiting to be learned today.</p>
        <Link className="btn" to={paths.review()} replace>
          Back to Review
        </Link>
      </div>
    );
  }
  return <WordsDrill ids={sitting.ids} fresh={sitting.fresh} onExit={exit} />;
}

/**
 * See the word, know what it means — the one question a word is asked.
 *
 * A word due for review is shown bare: say to yourself what it means, then
 * look, and say how it went. A new word cannot be recalled, only met, so it
 * arrives with its answer showing and one question: did you know it already?
 * Either way its first interval is short — "new to me" brings it back within
 * the day, "knew it" in a day or two — so a word is never counted as known
 * on the strength of having been looked at once.
 */
function WordsDrill({ ids, fresh, onExit }: { ids: ItemId[]; fresh: ReadonlySet<ItemId>; onExit: () => void }) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'recognise');
  const isNew = Boolean(run.id && fresh.has(run.id));
  const [shown, setShown] = useState(isNew);
  const w = run.id ? idValue(run.id) : '';
  const info = useMemo(() => (w ? wordInfo(lib, w) : null), [lib, w]);

  useEffect(() => setShown(isNew), [run.id, isNew]);
  useEffect(() => {
    if (shown && w) void say(w);
  }, [shown, w]);

  useRevealKeys(Boolean(run.id) && !isNew, shown, () => setShown(true), run.answer);

  if (!run.id) {
    return (
      <DrillFrame title="Words" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="recognise" onExit={onExit} />
      </DrillFrame>
    );
  }

  const ex = info?.ex?.[0];

  return (
    <DrillFrame
      title="Words"
      hint={isNew ? 'A new word. Read it, hear it — did you know it already?' : 'What does it mean? Say it to yourself, then look.'}
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <div className="prompt-card">
        <span className="word-drill-han hanzi" lang="zh-CN" data-len={Math.min(5, [...w].length)}>
          {w}
        </span>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          {isNew ? 'new word' : shown ? (info?.listed ? hskLabel(info.hsk) : 'off the HSK lists') : 'What does this word mean?'}
        </p>
      </div>

      {shown ? (
        <div className="answer-card">
          <div className="reading">
            {info?.py}
            <Say text={w} />
          </div>
          <div className="gloss">{info?.d ?? '—'}</div>
          {/* only once the answer is out: a picture beside the question would be the answer */}
          <WordPicture word={w} compact />
          {info?.cl?.length ? <span className="tiny muted">counted with {info.cl.join('、')}</span> : null}
          {ex && (
            <p className="word-drill-ex">
              <span className="hanzi">{ex.zh}</span>
              <i>{ex.py}</i>
              <span className="tiny muted">{ex.en}</span>
            </p>
          )}
        </div>
      ) : (
        <button className="btn primary reveal" onClick={() => setShown(true)}>
          Show me<span className="key-hint"> — space</span>
        </button>
      )}

      {shown && (isNew ? <FirstMeeting onRate={run.answer} /> : <RatingRow onRate={run.answer} />)}
    </DrillFrame>
  );
}

/** The two answers a word you have only just been shown can take. */
function FirstMeeting({ onRate }: { onRate: (r: Rating) => void }) {
  return (
    <div className="rating-row word-first">
      <button className="rate hard" onClick={() => onRate('hard')}>
        <b>New to me</b>
        <span>Ask me again soon</span>
      </button>
      <button className="rate good" onClick={() => onRate('good')}>
        <b>Knew it</b>
        <span>Check again in a day or two</span>
      </button>
    </div>
  );
}
