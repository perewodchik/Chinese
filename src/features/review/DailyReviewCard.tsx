import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { dayKey } from '../../domain/activity';
import { planReview } from '../../domain/reviewSession';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useLibrary } from '../shared/library';
import './session.css';

const MINUTES = [5, 10, 15, 20].map((n) => ({ id: String(n), label: `${n} min` }));

/**
 * The first thing in Review: everything due, as one mixed session of so many
 * minutes, and the day's lesson beside it. The single drills are still there
 * underneath, for working on one skill.
 */
export function DailyReviewCard() {
  const lib = useLibrary();
  const navigate = useNavigate();
  const recall = useStore((s) => s.recall);
  const minutes = useStore((s) => s.settings.reviewMinutes);
  const hard = useStore((s) => s.settings.hardMode);
  const lesson = useStore((s) => s.activity[dayKey(Date.now())]?.lesson ?? null);
  const plan = useMemo(() => planReview(lib, recall, Date.now(), minutes), [lib, recall, minutes]);

  return (
    <div className="daily-cards">
      <button
        type="button"
        className="drill-card daily-card"
        disabled={!plan.targets.length}
        data-due={plan.dueItems > 0 || undefined}
        onClick={() => navigate(paths.reviewSession())}
      >
        <span className="mark hanzi">复</span>
        <span className="name">Daily review</span>
        <span className="blurb">
          Everything due, mixed: one question per item, in whatever form fits how well you know it.
        </span>
        <span className="figures">
          {plan.dueItems > 0 ? <b className="due">{plan.dueItems} due</b> : <i>nothing due</i>}
          {plan.targets.length > 0 && <i>{plan.targets.length} in this session</i>}
          {plan.catchUp && <i className="shaky">catching up</i>}
        </span>
      </button>
      <button
        type="button"
        className="drill-card daily-card"
        data-due={!lesson?.done || undefined}
        onClick={() => navigate(paths.learn())}
      >
        <span className="mark hanzi">新</span>
        <span className="name">Learn</span>
        <span className="blurb">A few new characters and words: meet them, practise them, check them.</span>
        <span className="figures">{lesson?.done ? <i>today’s lesson is done — more?</i> : <b className="due">today’s lesson</b>}</span>
      </button>
      <div className="daily-tools">
        <span className="tiny muted">Session</span>
        <Seg value={String(minutes)} options={MINUTES} onChange={(v) => setSettings({ reviewMinutes: Number(v) })} size="sm" />
        <button type="button" className="chip" aria-pressed={hard} onClick={() => setSettings({ hardMode: !hard })} title="Typed answers wherever a card has them">
          Hard mode
        </button>
      </div>
    </div>
  );
}
