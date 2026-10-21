import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';

const GOAL_MINUTES = [10, 15, 20, 30, 45];

/** What counts as a day done. Everything about the cards is on the Cards tab. */
export function LearningSettings() {
  const settings = useStore((s) => s.settings);
  return (
    <div className="card">
      <header>
        <h2>Learning</h2>
      </header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          A day counts when
          <select
            value={settings.dailyGoal === 'minutes' ? String(settings.goalMinutes) : 'plan'}
            onChange={(e) =>
              e.target.value === 'plan'
                ? setSettings({ dailyGoal: 'plan' })
                : setSettings({ dailyGoal: 'minutes', goalMinutes: Number(e.target.value) })
            }
          >
            <option value="plan">any work is done that day</option>
            {GOAL_MINUTES.map((n) => (
              <option key={n} value={n}>
                {n} minutes are worked
              </option>
            ))}
          </select>
          <span className="tiny muted">What keeps the streak going, on Today and in Your progress.</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={settings.restDays} onChange={(e) => setSettings({ restDays: e.target.checked })} />
          <span>
            A rest day a week
            <span className="d">
              One missed day in a week does not break the streak, as long as the next day counts.
            </span>
          </span>
        </label>

        <p className="small muted" style={{ margin: 0 }}>
          How many cards a day, what they ask, and how many new words come in are on the{' '}
          <Link to={paths.cards()}>Cards</Link> tab. The streak itself is in <Link to={paths.stats()}>Your progress</Link>.
        </p>
      </div>
    </div>
  );
}
