import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { drillPools, summarise, type SkillSummary } from '../../domain/drill';
import { pendingSheets, SKILLS } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { SweepCard } from '../words/SweepCard';
import { WordsCard } from '../words/WordsCard';
import {
  DEFAULT_SITTING,
  DRILLS,
  planSitting,
  SITTING_SIZES,
  sittingSize,
  type DrillInfo,
} from './drills';

const SIZES = SITTING_SIZES.map((n) => ({ id: String(n), label: String(n) }));

/**
 * The front door.
 *
 * Everywhere else in the app you decide what to do; here the app decides, and
 * the only question it puts to you is how long you have got. That inversion is
 * the point of keeping a schedule at all — the value of knowing when a memory
 * is about to go is that you no longer have to guess what to study.
 */
export function ReviewPage() {
  useTitle('Review');
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
      <div className="empty">
        <span className="big">空</span>
        <p>Nothing to review yet.</p>
        <p className="small">
          Reviewing works from the characters you have marked as learned — not from everything you
          have collected to study. Mark a few in the library and they will start coming round.
        </p>
        <Link className="btn primary" to={paths.library()} style={{ marginTop: 10 }}>
          Go to the library
        </Link>
        <div style={{ marginTop: 18, width: '100%', maxWidth: 560 }}>
          <SweepCard />
        </div>
      </div>
    );
  }

  const dueTotal = SKILLS.reduce((n, s) => n + counts.bySkill[s].due, 0);
  const inRotation = `${pools.all.length} character${pools.all.length === 1 ? '' : 's'}`;

  return (
    <section>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>{dueTotal ? `${dueTotal} to go over` : 'Nothing is due'}</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            {dueTotal
              ? `Out of ${inRotation} in rotation.`
              : `${inRotation} in rotation, all of them holding. Start something new below.`}
          </p>
        </div>
        <div className="spacer" />
        <label className="field" style={{ width: 'auto' }}>
          <span className="tiny muted" style={{ display: 'block', marginBottom: 4 }}>
            Questions per sitting
          </span>
          <Seg
            value={String(size)}
            options={SIZES}
            onChange={(v) => setQuery('n', v, String(DEFAULT_SITTING))}
            size="sm"
          />
        </label>
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
        tightest for the same reason. Tones and look-alikes sharpen the reading and the recognition
        they belong to rather than keeping schedules of their own.
      </p>
    </section>
  );
}
