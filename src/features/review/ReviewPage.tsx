import { useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { drillPools, summarise, type SkillSummary } from '../../domain/drill';
import { pendingSheets, SKILLS } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';
import { SweepCard } from '../words/SweepCard';
import { WordsCard } from '../words/WordsCard';
import {
  DEFAULT_SITTING,
  DRILLS,
  drillById,
  planSitting,
  SITTING_SIZES,
  sittingSize,
  type DrillInfo,
} from './drills';

const SIZES = SITTING_SIZES.map((n) => ({ id: String(n), label: String(n) }));

/**
 * Everything Review can ask, as one section of the Today page.
 *
 * It used to be the front door on its own. It is now the second half of
 * Today, under the day's plan: the plan says what to do, and this is where
 * the choice is still yours — which drill, and how long a sitting.
 */
export function ReviewSection() {
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const size = sittingSize(query.get('n'));

  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const sheets = useStore((s) => s.sheets);

  const waiting = useMemo(() => pendingSheets(sheets), [sheets]);
  const pools = useMemo(
    () => drillPools(lib, recall, learned),
    [lib, recall, learned],
  );
  const counts = useMemo(() => {
    const now = Date.now();
    return {
      bySkill: summarise(recall, pools.all, SKILLS, now),
      confuse: summarise(recall, pools.confusable, ['recognise'], now).recognise,
      word: summarise(recall, pools.inWords, ['use'], now).use,
    };
  }, [recall, pools]);

  const countsFor = (d: DrillInfo): SkillSummary =>
    d.id === 'confuse' ? counts.confuse : d.id === 'word' ? counts.word : counts.bySkill[d.skill];

  function start(d: DrillInfo) {
    if (!planSitting(d, pools, recall, size, Date.now()).ids.length) {
      toast('Nothing due for that, and nothing new to introduce.');
      return;
    }
    navigate(paths.drill(d.id, size === DEFAULT_SITTING ? undefined : size));
  }

  if (!pools.all.length) {
    return (
      <section className="review-section" id="review">
        <div className="review-head">
          <h2>Review</h2>
        </div>
        <p className="small muted" style={{ margin: '0 0 10px', maxWidth: 560 }}>
          Nothing to review yet. Reviewing works from the characters you have marked as learned — not from
          everything you have collected. Mark a few in the <Link to={paths.library()}>library</Link> and they
          start coming round.
        </p>
        <SweepCard />
        <WordsCard size={size} />
      </section>
    );
  }

  const dueTotal = SKILLS.reduce((n, s) => n + counts.bySkill[s].due, 0);
  const inRotation = `${pools.all.length} character${pools.all.length === 1 ? '' : 's'}`;

  return (
    <section className="review-section" id="review">
      <div className="review-head">
        <h2>
          Review
          <span className="muted">
            {dueTotal ? ` · ${dueTotal} due of ${inRotation}` : ` · ${inRotation}, all holding`}
          </span>
        </h2>
        <div className="spacer" />
        <span className="tiny muted">Per sitting</span>
        <Seg
          value={String(size)}
          options={SIZES}
          onChange={(v) => setQuery('n', v, String(DEFAULT_SITTING))}
          size="sm"
        />
      </div>

      <SweepCard />

      {waiting.length > 0 && (
        <div className="waiting-sheets">
          {waiting.map((w) => (
            <Link key={w.id} className="waiting" to={paths.gradeSheet(w.id)}>
              <span className="mark hanzi">纸</span>
              <span className="meta">
                <b>{w.name}</b>
                <i>
                  {w.items.length} characters, printed {new Date(w.printedAt).toLocaleDateString()} — not
                  marked yet
                </i>
              </span>
              <span className="go">Mark it →</span>
            </Link>
          ))}
        </div>
      )}

      <WordsCard size={size} />

      <div className="drill-grid">
        {DRILLS.map((d) => {
          const c = countsFor(d);
          const nothing = c.due === 0 && c.fresh === 0;
          return (
            <button
              key={d.id}
              className="drill-card"
              disabled={nothing}
              onClick={() => start(d)}
              data-due={c.due > 0 || undefined}
            >
              <span className="mark hanzi">{d.mark}</span>
              <span className="name">{d.name}</span>
              <span className="blurb">{d.blurb}</span>
              <span className="figures">
                {c.due > 0 && <b className="due">{c.due} due</b>}
                {d.shares && (c.due > 0 || c.fresh > 0) && (
                  <i className="shares">same cards as {drillById(d.shares)?.name}</i>
                )}
                {c.fresh > 0 && <i>{c.fresh} new</i>}
                {nothing && <i>nothing waiting</i>}
                {c.shaky > 0 && <i className="shaky">{c.shaky} shaky</i>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="tiny muted" style={{ marginTop: 18, maxWidth: 620 }}>
        Recognising, saying and writing are counted separately, because they are forgotten
        separately — a character can be solid on sight and gone from your hand. Writing is scheduled
        tightest for the same reason. Tones and look-alikes work through the same cards as Say it and
        Recognise, so finishing one clears the other; a right pick there counts for half, because
        choosing from what is on screen is easier than coming up with it.
      </p>
    </section>
  );
}

/** Review is a section of Today now; an old address or bookmark lands there. */
export function ReviewPage() {
  const { search } = useLocation();
  return <Navigate to={`${paths.today()}${search}`} replace />;
}
