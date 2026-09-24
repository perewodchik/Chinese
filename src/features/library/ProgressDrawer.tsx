import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { SKILL_META } from '../../domain/memory';
import { bandName, progressOf, type BandProgress } from '../../domain/progress';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { useSheetDrag } from '../../ui/useSheetDrag';
import { useLibrary } from '../shared/library';

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const HOLDING = [
  { key: 'solid', label: 'Solid' },
  { key: 'holding', label: 'Holding' },
  { key: 'shaky', label: 'Shaky' },
  { key: 'new', label: 'Just met' },
] as const;

/**
 * The whole answer to "how am I doing", opened from the meter in the header.
 *
 * The meter has room for one band and one number. This has the rest: every
 * band, how much of what is ticked a review has confirmed, how firmly the
 * characters in rotation are held, what each skill has waiting, and the week
 * so far — ending in the one or two things worth doing about it.
 */
export function ProgressDrawer({ onClose }: { onClose: () => void }) {
  const lib = useLibrary();
  const recall = useStore((s) => s.recall);
  const learned = useStore((s) => s.learned);
  const sheets = useStore((s) => s.sheets);
  const sheet = useSheetDrag(onClose);
  const { close } = sheet;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Worked out when the record changes rather than on a clock, like the
  // character drawer: a panel that ticks would be the only moving thing.
  const p = useMemo(() => progressOf(lib, recall, learned, sheets, Date.now()), [lib, recall, learned, sheets]);
  const rotation = Object.values(p.holding).reduce((a, b) => a + b, 0);
  const lastStarted = p.current ? p.current.band : 0;

  /** Opens the library on what is left in one band. */
  const leftIn = (b: BandProgress) => ({
    to: `${paths.library()}?show=todo`,
    onClick: () => setSettings({ hskBand: b.band }),
  });

  return (
    <div className="drawer" data-leaving={sheet.leaving || undefined} onClick={close}>
      <div />
      <div
        className="sheet progress-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Your progress"
        onClick={(e) => e.stopPropagation()}
        {...sheet.sheetProps}
      >
        <div className="sheet-head">
          <div className="grip" {...sheet.gripProps} aria-hidden="true">
            <span />
          </div>
          <div className="row sheet-top" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost sm close" onClick={close}>
              ✕ Close
            </button>
          </div>
        </div>

        <h1 style={{ margin: '12px 0 2px' }}>
          {p.current ? `${bandName(p.current.band)}: ${pct(p.current.done, p.current.size)}%` : 'Every band learned'}
        </h1>
        <p className="small muted" style={{ margin: 0 }}>
          {plural(p.learned, 'character')} learned
          {p.learned > 0 && (
            <>
              , {p.proven === p.learned ? 'every one' : p.proven} of them confirmed in a review
            </>
          )}
          .
        </p>

        <div className="progress-next">
          {p.due > 0 ? (
            <Link className="btn primary" to={paths.review()}>
              Go over {p.due} due
            </Link>
          ) : (
            <span className="small muted">Nothing is due right now.</span>
          )}
          {p.current && (
            <Link className="btn" {...leftIn(p.current)}>
              {p.current.size - p.current.done} left in {bandName(p.current.band)}
            </Link>
          )}
          {p.sheetsWaiting > 0 && (
            <Link className="btn" to={paths.review()}>
              {plural(p.sheetsWaiting, 'sheet')} to mark
            </Link>
          )}
        </div>

        <div className="progress-stats">
          <Stat value={p.learned} label="learned" />
          <Stat value={p.proven} label="confirmed in review" />
          <Stat value={p.inRotation} label="in rotation" />
          <Stat value={p.week.answered} label="answered this week" />
        </div>

        <h3 className="progress-label">By band</h3>
        <ul className="progress-bands">
          {p.bands
            .filter((b) => b.size)
            .map((b) => {
              const complete = b.done >= b.size;
              // Bands far ahead of where you are are listed but kept quiet.
              const ahead = !complete && b.done === 0 && b.band > lastStarted;
              return (
                <li key={b.band} data-current={b === p.current || undefined} data-ahead={ahead || undefined}>
                  <Link {...leftIn(b)} title={complete ? `All of ${bandName(b.band)}` : `What is left in ${bandName(b.band)}`}>
                    <b>{bandName(b.band)}</b>
                    <span className="meter-band" data-complete={complete || undefined}>
                      <i className="believed" style={{ width: `${pct(b.done, b.size)}%` }} />
                      <i className="proven" style={{ width: `${pct(b.proven, b.size)}%` }} />
                    </span>
                    <span className="count">
                      {b.done}
                      <span className="of">/{b.size}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          <span className="swatch believed" /> ticked as learned <span className="swatch proven" /> confirmed in a
          review. Tap a band for what is left in it.
        </p>

        <h3 className="progress-label">How they are holding</h3>
        {rotation ? (
          <>
            <div className="holding-bar" aria-hidden>
              {HOLDING.map(({ key }) =>
                p.holding[key] ? (
                  <i key={key} data-band={key} style={{ flexGrow: p.holding[key] }} />
                ) : null,
              )}
            </div>
            <ul className="holding-legend">
              {HOLDING.map(({ key, label }) => (
                <li key={key}>
                  <span className="swatch" data-band={key} />
                  <span className="band" data-band={key}>
                    {label}
                  </span>
                  <b>{p.holding[key]}</b>
                </li>
              ))}
            </ul>
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>
              Over all four skills: a character you recognise but cannot yet say or write is still holding, not
              solid.
            </p>
          </>
        ) : (
          <p className="small muted">Nothing in rotation yet. Mark a few characters learned and they start coming round.</p>
        )}

        <h3 className="progress-label">By skill</h3>
        <table className="progress-skills">
          <thead>
            <tr>
              <th />
              <th>asked</th>
              <th>due</th>
              <th>shaky</th>
              <th>firm</th>
            </tr>
          </thead>
          <tbody>
            {p.skills.map((s) => (
              <tr key={s.skill} data-none={!s.seen || undefined}>
                <th scope="row" title={SKILL_META[s.skill].blurb}>
                  {SKILL_META[s.skill].label}
                </th>
                <td>{s.seen}</td>
                <td className={s.due ? 'due' : undefined}>{s.due}</td>
                <td className={s.shaky ? 'shaky' : undefined}>{s.shaky}</td>
                <td>{s.firm}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          Firm means it would still hold a month from now. Shaky means missed more than once.
        </p>

        <h3 className="progress-label">This week</h3>
        <p className="small" style={{ margin: 0 }}>
          {p.week.answered
            ? `${plural(p.week.answered, 'character')} answered for in a review`
            : 'No reviews answered yet this week'}
          {p.week.started > 0 && <>, {plural(p.week.started, 'new character')} started</>}.
          {p.words.inRotation > 0 && (
            <>
              {' '}
              {plural(p.words.learned, 'word')} learned, {p.words.inRotation} in rotation.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
