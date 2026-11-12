import { useMemo } from 'react';
import { Link } from 'react-router';
import type { Activity } from '../../domain/activity';
import { firstUnread } from '../../domain/text';
import { whereYouAre, type BandFit, type WordBand } from '../../domain/wordProgress';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';

const FIT: Record<BandFit, string> = { comfortable: 'comfortably', stretch: 'as a stretch', hard: 'only with help' };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const bandName = (b: number) => (b >= 7 ? 'HSK 7–9' : `HSK ${b}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/**
 * The top of Progress (G1), without a chart: where you are in words, what
 * you can read and how, the one thing to do next, and the four skills in a
 * line each.
 *
 * States: nothing known (HSK 1, 0%, Check what you know); a band in hand
 * and the next a stretch; a text not read yet (Read it, named); every text
 * read (Check what you know of the band).
 */
export function WhereYouAre({ words, activity }: { words: WordBand[]; activity: Activity }) {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const at = useMemo(() => whereYouAre(words), [words]);
  const next = useMemo(() => firstUnread(texts, sets), [texts, sets]);
  const skills = useMemo(() => {
    let spoken = 0;
    let answers = 0;
    for (const day of Object.values(activity)) {
      spoken += day.spoken;
      answers += day.answers;
    }
    const copied = texts.reduce((n, t) => n + (t.study?.copied ?? 0), 0);
    const knownWords = words.reduce((n, b) => n + b.done, 0);
    return [
      { label: 'Reading', value: `${plural(texts.filter((t) => t.read).length, 'text')} read` },
      { label: 'Words', value: `${plural(knownWords, 'word')} known` },
      { label: 'Speaking', value: `${plural(spoken, 'line')} said` },
      { label: 'Writing', value: `${plural(copied, 'character')} copied out · ${plural(answers, 'card')} answered` },
    ];
  }, [activity, texts, words]);

  return (
    <section className="card st-card st-where">
      <div className="body">
        <p className="st-where-level">
          About <b>{bandName(at.band)}</b> · {pct(at.share)} of its words
        </p>
        <p className="small st-where-reach">
          {at.reach.map((r, i) => (
            <span key={r.band}>
              {i > 0 ? ' ' : ''}
              {bandName(r.band)} texts read {FIT[r.fit]} ({pct(r.share)} of the words known).
            </span>
          ))}
        </p>
        <div className="row">
          {next ? (
            <Link className="btn primary st-where-next" to={paths.reading(next.set.id, { page: next.page })}>
              Read <span className="hanzi">{next.text.titleZh || next.text.title}</span>
            </Link>
          ) : (
            <Link className="btn primary" to={paths.sweep(at.band <= 4 ? at.band : undefined)}>
              Check what you know of {bandName(at.band)}
            </Link>
          )}
        </div>
        <ul className="list st-skills">
          {skills.map((s) => (
            <li key={s.label} className="st-skill">
              <b>{s.label}</b>
              <span className="small muted">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
