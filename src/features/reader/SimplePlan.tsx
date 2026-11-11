import { Link } from 'react-router';
import { emptySpec } from '../../domain/teach';
import type { Level, TextSpec } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import './shelves.css';

const COUNTS = [
  { id: '1', label: '1' },
  { id: '3', label: '3' },
  { id: '5', label: '5' },
];
const HARD: Array<{ id: Level; label: string }> = [
  { id: 'comfort', label: 'Easy' },
  { id: 'edge', label: 'A little harder' },
  { id: 'stretch', label: 'Hard' },
];

/** The value all the passages share, or '' when they differ (and no choice shows pressed). */
const shared = <T,>(values: T[]): T | '' => (values.length && values.every((v) => v === values[0]) ? values[0]! : '');

/**
 * The writing form as most people want it, on one phone screen: what it is
 * about, how many texts, how hard — and Build the prompt. Everything else
 * (each passage's length, form, band, words to teach, what it may assume)
 * is under More options, as it was.
 *
 * With nothing marked known yet it does not stop: the prompt asks for the
 * learner's HSK band instead of a list (domain/prompt.ts), and one line says
 * how to get texts that fit better.
 *
 * States: passages that agree (their count and level pressed); passages
 * changed under More options so they differ (nothing pressed until a choice
 * sets them all); nothing marked yet (the line and its link); fewer than ten
 * marked (the same line); More options open (the toggle says so).
 */
export function SimplePlan({
  specs,
  marked,
  band,
  more,
  onMore,
  onChange,
  onBuild,
}: {
  specs: TextSpec[];
  /** how many characters are marked known */
  marked: number;
  band: number;
  more: boolean;
  onMore: () => void;
  onChange: (next: TextSpec[]) => void;
  onBuild: () => void;
}) {
  const topic = shared(specs.map((s) => s.topic.trim()));
  const count = COUNTS.some((c) => c.id === String(specs.length)) ? String(specs.length) : '';
  const level = shared(specs.map((s) => s.level));

  function resize(n: number) {
    const next = specs.slice(0, n);
    // A new passage is like the last, with a topic of its own (or the one they all share).
    const { id: _id, topic: _topic, ...like } = specs[specs.length - 1] ?? emptySpec();
    while (next.length < n) next.push(emptySpec({ ...like, topic }));
    onChange(next);
  }

  return (
    <section className="simple-plan">
      <label className="field">
        What about
        <input
          type="text"
          value={topic}
          placeholder={specs.length > 1 && !topic && specs.some((s) => s.topic.trim()) ? 'Each has its own: see More options' : 'Anything: a cat, the weather, a trip'}
          maxLength={160}
          onChange={(e) => onChange(specs.map((s) => ({ ...s, topic: e.target.value })))}
        />
      </label>
      <div className="field">
        How many texts
        <Seg value={count} options={COUNTS} onChange={(v) => resize(Number(v))} label="How many texts" />
      </div>
      <div className="field">
        How hard
        <Seg value={level} options={HARD} onChange={(v) => v && onChange(specs.map((s) => ({ ...s, level: v })))} label="How hard" />
      </div>
      {marked < 10 && (
        <p className="small muted simple-plan-note">
          {marked ? `Only ${marked} characters are marked known` : 'Nothing is marked known yet'}, so they are written for HSK {band}.{' '}
          <Link to={paths.sweep(band <= 4 ? band : undefined)}>Mark what you know</Link> for texts that fit you better.
        </p>
      )}
      <div className="simple-plan-foot">
        <button className="btn quiet" aria-expanded={more} onClick={onMore}>
          {more ? 'Fewer options' : 'More options'}
          <Icon name="chevron" size={16} className="simple-plan-chevron" />
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={onBuild} disabled={!specs.length}>
          Build the prompt
        </button>
      </div>
    </section>
  );
}
