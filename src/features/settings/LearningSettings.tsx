import { Link } from 'react-router';
import { NEW_PER_DAY } from '../../domain/lesson';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';

const SESSION_MINUTES = [5, 10, 15, 20, 30];
const GOAL_MINUTES = [10, 15, 20, 30, 45];

/** How much is new each day, how long a review runs, how answers are given, and what counts as a day done. */
export function LearningSettings() {
  const settings = useStore((s) => s.settings);
  return (
    <div className="card">
      <header>
        <h2>Learning</h2>
      </header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          New a day
          <select value={settings.newPerDay} onChange={(e) => setSettings({ newPerDay: Number(e.target.value) })}>
            {NEW_PER_DAY.map((n) => (
              <option key={n} value={n}>
                {n} characters and words
              </option>
            ))}
          </select>
          <span className="tiny muted">
            How many new things the day’s lesson brings in. Each is back in review within a day or two, so every
            one taken today is a review tomorrow — and when reviews pile up, the lesson takes fewer on its own.
          </span>
        </label>

        <label className="field">
          Daily review
          <select value={settings.reviewMinutes} onChange={(e) => setSettings({ reviewMinutes: Number(e.target.value) })}>
            {SESSION_MINUTES.map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
          <span className="tiny muted">How long one review session runs. What does not fit stays due for the next.</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={settings.hardMode} onChange={(e) => setSettings({ hardMode: e.target.checked })} />
          <span>
            Hard mode
            <span className="d">
              Type the answers — pinyin, characters with the Chinese keyboard, or the meaning — wherever a card can be
              typed. A typed answer counts in full.
            </span>
          </span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={settings.fourButtons} onChange={(e) => setSettings({ fourButtons: e.target.checked })} />
          <span>
            Grade with four buttons
            <span className="d">
              Again / Hard / Good / Easy instead of Forgot / Got it. With two, how long you took to answer decides the rest.
            </span>
          </span>
        </label>

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
          <span className="tiny muted">What keeps the streak going, on Today and on the Stats page.</span>
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
          Sorting the words of a band into known, not sure and new is under{' '}
          <Link to={paths.sweep()}>Review → Which words do you know?</Link> — the ones you mark new are what lessons
          teach first. Your progress is on the <Link to={paths.stats()}>Stats page</Link>.
        </p>
      </div>
    </div>
  );
}
