import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { SyllabusWord } from '../../data/types';
import {
  collectedItems,
  firstOpenBand,
  nextMark,
  splitMarks,
  SWEEP_BANDS,
  SWEEP_PAGE,
  sweepOf,
  wordsPresetId,
  type SweepMark,
} from '../../domain/sweep';
import { paths } from '../../navigation/paths';
import { useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { saveSweep } from '../../store/wordCommands';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import './words.css';

const BANDS = SWEEP_BANDS.map((b) => ({ id: String(b), label: `HSK ${b}` }));

const MARK_LABEL: Record<SweepMark, string> = { know: '', unsure: 'not sure', new: 'new' };

/**
 * Sorting a band's words into the ones you know, the ones you are not sure
 * of, and the ones you have never met — a screenful at a time, touching only
 * the exceptions. See `domain/sweep.ts` for what each answer does.
 *
 * The words are shown bare. Seeing 东西 with "thing" under it, anybody would
 * say they know it; the question is whether you knew before you looked, which
 * is exactly the difference between knowing 东 and 西 and knowing 东西. The
 * meanings can be shown to check afterwards.
 */
export function SweepPage() {
  useTitle('Sort your words');
  const lib = useLibrary();
  const toast = useToast();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const [query, setQuery] = useQuery();
  const [marks, setMarks] = useState<Map<string, SweepMark>>(new Map());
  const [reveal, setReveal] = useState(false);

  const collected = useMemo(() => collectedItems(collections), [collections]);

  // Opened without a band, it starts at the first one with anything left —
  // and says so in the address, so that finishing that band shows it finished
  // rather than sliding on to the next.
  const asked = Number(query.get('band'));
  const band = SWEEP_BANDS.includes(asked) ? asked : null;
  useEffect(() => {
    if (band === null) setQuery('band', String(firstOpenBand(lib, recall, collected)));
    // Only when there is no band to show; the answer must not move under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  const sweep = useMemo(
    () => sweepOf(lib, band ?? SWEEP_BANDS[0], recall, collected),
    [lib, band, recall, collected],
  );
  const page = sweep.unsorted.slice(0, SWEEP_PAGE);
  const markOf = (w: SyllabusWord): SweepMark => marks.get(w.w) ?? 'know';
  const tally = page.reduce(
    (t, w) => ({ ...t, [markOf(w)]: t[markOf(w)] + 1 }),
    { know: 0, unsure: 0, new: 0 } as Record<SweepMark, number>,
  );

  function tap(w: SyllabusWord) {
    setMarks((prev) => new Map(prev).set(w.w, nextMark(prev.get(w.w) ?? 'know')));
  }

  function save() {
    const all = new Map(page.map((w) => [w.w, markOf(w)]));
    saveSweep(sweep.band, splitMarks(all));
    const parts = [
      tally.know && `${tally.know} known`,
      tally.unsure && `${tally.unsure} to review today`,
      tally.new && `${tally.new} to learn`,
    ].filter(Boolean);
    toast(`Saved: ${parts.join(', ')}`);
    setMarks(new Map());
    window.scrollTo({ top: 0 });
  }

  if (band === null) return null;

  const total = sweep.words.length;
  const sorted = total - sweep.unsorted.length;
  const next = SWEEP_BANDS.find((b) => b > sweep.band);
  const home = collections.find((c) => c.presetId === wordsPresetId(sweep.band));

  return (
    <section className="sweep">
      <div className="row" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0 }}>Which words do you know?</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            HSK {sweep.band} · {sorted} of {total} sorted
          </p>
        </div>
        <div className="spacer" />
        <Seg
          value={String(sweep.band)}
          options={BANDS}
          onChange={(v) => {
            setMarks(new Map());
            setQuery('band', v);
          }}
          size="sm"
          label="Band"
        />
      </div>

      {page.length === 0 ? (
        <div className="card sweep-done">
          <div className="body">
            <p style={{ margin: 0 }}>
              <b>Every HSK {sweep.band} word is sorted.</b>
            </p>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>
              {sweep.counts.known} you know · {sweep.counts.reviewing} being reviewed ·{' '}
              {sweep.counts['to-learn']} to learn
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {next && (
                <button className="btn primary" onClick={() => setQuery('band', String(next))}>
                  Sort HSK {next}
                </button>
              )}
              {home && (
                <Link className="btn" to={paths.collection(home.id, 'items')}>
                  {home.name}
                </Link>
              )}
              <Link className="btn ghost" to={paths.review()}>
                Back to Review
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="small muted sweep-how">
            Leave the words you know. Tap one you are not sure of; tap it again if it is new to you.
            Know it only if you know what the word means — knowing 东 and 西 is not knowing 东西.
          </p>

          <div className="sweep-bar">
            <div className="chips">
              <button className="chip" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
                Meanings
              </button>
            </div>
            <span className="spacer" />
            <span className="tiny muted sweep-tally">
              {tally.know} know · {tally.unsure} not sure · {tally.new} new
            </span>
          </div>

          <div className="sweep-grid" data-reveal={reveal || undefined}>
            {page.map((w) => {
              const m = markOf(w);
              return (
                <button
                  key={w.w}
                  type="button"
                  className="sweep-word"
                  data-mark={m}
                  data-len={Math.min(5, [...w.w].length)}
                  aria-label={`${w.w}: ${m === 'know' ? 'known' : MARK_LABEL[m]}`}
                  onClick={() => tap(w)}
                >
                  <span className="han" lang="zh-CN">
                    {w.w}
                  </span>
                  {reveal && (
                    <>
                      <span className="py">{w.py}</span>
                      <span className="gloss">{w.d}</span>
                    </>
                  )}
                  <span className="mark">{MARK_LABEL[m]}</span>
                </button>
              );
            })}
          </div>

          <div className="sweep-foot">
            <span className="tiny muted">
              {sweep.unsorted.length > page.length
                ? `${sweep.unsorted.length - page.length} more after these`
                : 'The last of this band'}
            </span>
            <span className="spacer" />
            <button className="btn primary sweep-save" onClick={save}>
              Save and go on
            </button>
          </div>
        </>
      )}
    </section>
  );
}
