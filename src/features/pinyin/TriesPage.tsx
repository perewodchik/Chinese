import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { OwnTextDto } from '../../../shared/narration';
import type { AttemptOut, EvalResult } from '../../../shared/speechEval';
import { ownTexts } from '../../api/narration';
import { attemptResult, listAttempts } from '../../api/speechEval';
import { isHanzi } from '../../domain/text';
import { partsOf, type Attempt, type CharSummary } from '../../domain/phrases';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { band, ScoredLine } from './ScoredLine';
import { flush } from './speechHistory';
import './phrases.css';

type Period = 'today' | 'week' | 'month' | 'all';
type Outcome = 'all' | 'fix' | 'clean';

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** A day's heading: Today, Yesterday, or the date. */
function dayName(t: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(t);
  if (day === today) return 'Today';
  if (day === today - DAY) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Every try at a line, kept in the account, to look back over: filtered by
 * when, by whether something was wrong, by text, or by a character in it;
 * grouped by day; each opened to the line as it was scored — every
 * character's number, colour and what was wrong — from the service's answer
 * kept with it.
 */
export function TriesPage() {
  useTitle('Your tries');
  const texts = useStore((s) => s.texts);
  const [attempts, setAttempts] = useState<AttemptOut[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [own, setOwn] = useState<OwnTextDto[]>([]);
  const [period, setPeriod] = useState<Period>('week');
  const [outcome, setOutcome] = useState<Outcome>('all');
  const [source, setSource] = useState('');
  const [find, setFind] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setFailed(null);
    setAttempts(null);
    // What waits on this device is sent first, so a try just said is in the list.
    void flush()
      .then(() => listAttempts('phrase'))
      .then(setAttempts, (err: Error) => setFailed(err.message));
  }
  useEffect(() => {
    load();
    void ownTexts().then(setOwn, () => undefined);
  }, []);

  const titleOf = useMemo(() => {
    const m = new Map<string, string>([['everyday', 'Everyday phrases']]);
    for (const t of texts) m.set(t.id, t.titleZh || t.title);
    for (const t of own) m.set(`own:${t.id}`, t.title || 'Your own text');
    return (id: string | null) => (id ? (m.get(id) ?? 'A text no longer here') : 'Before texts were noted');
  }, [texts, own]);

  const shown = useMemo(() => {
    if (!attempts) return [];
    const since = period === 'today' ? startOfDay(Date.now()) : period === 'week' ? Date.now() - 7 * DAY : period === 'month' ? Date.now() - 30 * DAY : 0;
    const q = find.trim();
    return attempts.filter(
      (a) =>
        a.at >= since &&
        (outcome === 'all' || (outcome === 'clean') === a.good) &&
        (!source || a.sourceId === source) &&
        (!q || a.text.includes(q)),
    );
  }, [attempts, period, outcome, source, find]);

  const sources = useMemo(() => [...new Set((attempts ?? []).map((a) => a.sourceId ?? ''))].filter(Boolean), [attempts]);
  const days = useMemo(() => {
    const out: Array<{ day: number; list: AttemptOut[] }> = [];
    for (const a of shown) {
      const day = startOfDay(a.at);
      if (out[out.length - 1]?.day === day) out[out.length - 1]!.list.push(a);
      else out.push({ day, list: [a] });
    }
    return out;
  }, [shown]);
  const avg = shown.length ? Math.round(shown.reduce((n, a) => n + ((a.summary as Attempt | null)?.total ?? 0), 0) / shown.length) : null;

  return (
    <section className="ph ph-tries-page">
      <Link className="back-link" to={paths.speaking()}>
        <Icon name="back" /> Phrases
      </Link>
      <div className="page-head">
        <h1>Your tries</h1>
      </div>

      <div className="ph-filters">
        <Seg<Period>
          size="sm"
          label="When"
          value={period}
          onChange={setPeriod}
          options={[
            { id: 'today', label: 'Today' },
            { id: 'week', label: '7 days' },
            { id: 'month', label: '30 days' },
            { id: 'all', label: 'All' },
          ]}
        />
        <Seg<Outcome>
          size="sm"
          label="Which"
          value={outcome}
          onChange={setOutcome}
          options={[
            { id: 'all', label: 'All' },
            { id: 'fix', label: 'To fix' },
            { id: 'clean', label: 'Clean' },
          ]}
        />
        <select className="ph-filter-text" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Text">
          <option value="">Every text</option>
          {sources.map((id) => (
            <option key={id} value={id}>
              {titleOf(id)}
            </option>
          ))}
        </select>
        <label className="search ph-filter-find">
          <Icon name="search" />
          <input type="search" placeholder="A character or word" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
      </div>

      {failed ? (
        <div className="ph-failed" role="alert">
          <b>Your tries could not be fetched</b>
          <span className="small">{failed}</span>
          <span className="ph-failed-actions">
            <button className="btn tonal sm" onClick={load}>
              Try again
            </button>
          </span>
        </div>
      ) : attempts === null ? (
        <div className="ph-scoring" role="status">
          <span className="spinner ph-scoring-spin" aria-hidden />
          <b>Fetching your tries…</b>
        </div>
      ) : (
        <>
          <p className="small muted ph-tries-count">
            {shown.length ? `${shown.length} ${shown.length === 1 ? 'try' : 'tries'}, ${avg} on average.` : attempts.length ? 'No tries match these filters.' : 'No tries yet: say a line in Phrases and it is kept here.'}
          </p>
          {days.map(({ day, list }) => (
            <section key={day} className="block ph-day">
              <h2 className="block-title">{dayName(day)}</h2>
              <div className="list">
                {list.map((a) => (
                  <TryRow key={a.id} a={a} title={titleOf(a.sourceId)} open={open === a.id} onToggle={() => setOpen((o) => (o === a.id ? null : a.id))} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

/** One try: its time, the line coloured by how each character was said, its number; opened, the whole of it. */
function TryRow({ a, title, open, onToggle }: { a: AttemptOut; title: string; open: boolean; onToggle: () => void }) {
  const summary = a.summary as Attempt | null;
  const chars = summary?.chars;
  const total = summary?.total;
  const time = new Date(a.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="ph-try" data-open={open || undefined}>
      <button className="ph-try-row" onClick={onToggle} aria-expanded={open}>
        <span className="tiny muted ph-try-time">{time}</span>
        <span className="ph-try-main">
          <span className="hanzi ph-try-line">
            <Coloured text={a.text} chars={chars} />
          </span>
          <span className="tiny muted ph-try-sub">{title}</span>
        </span>
        <span className="ph-score" data-band={total === undefined ? 'none' : band(total)}>
          {total === undefined ? '–' : Math.round(total)}
        </span>
        <Icon name="chevron" className="muted ph-try-chev" />
      </button>
      {open && <TryDetail a={a} />}
    </div>
  );
}

/** The line with each character in the colour it was said in, when the try kept that. */
function Coloured({ text, chars }: { text: string; chars?: CharSummary[] }) {
  if (!chars?.length) return <>{text}</>;
  let k = 0;
  return (
    <>
      {[...text].map((c, i) => {
        if (!isHanzi(c)) return <span key={i}>{c}</span>;
        // Characters follow the scored ones in order; one only takes a colour when it is that character.
        while (k < chars.length && chars[k]!.char !== c) k++;
        const s = chars[k];
        if (s) k++;
        return (
          <span key={i} data-band={s?.band}>
            {c}
          </span>
        );
      })}
    </>
  );
}

const results = new Map<string, Promise<EvalResult>>();

/** A try opened: the line scored as it was, from the service's answer kept with it; or what the try kept of it. */
function TryDetail({ a }: { a: AttemptOut }) {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!a.full) return;
    let live = true;
    setFailed(null);
    let p = results.get(a.id);
    if (!p) {
      p = attemptResult(a.id);
      results.set(a.id, p);
      p.catch(() => results.delete(a.id));
    }
    p.then((r) => live && setResult(r), (err: Error) => live && setFailed(err.message));
    return () => {
      live = false;
    };
  }, [a, n]);

  // Each character's pinyin, from the readings the service scored.
  const readings = useMemo(() => {
    if (!result) return [];
    const said = result.syllables.filter((s) => s.said !== 'added');
    return [...a.text].filter(isHanzi).map((_, i) => (said[i] ? partsOf(said[i]!.symbol).marked : ''));
  }, [result, a.text]);

  if (!a.full) {
    const chars = (a.summary as Attempt | null)?.chars ?? [];
    const notes = chars.filter((c) => c.notes.length);
    return (
      <div className="ph-try-detail">
        {notes.length ? (
          notes.map((c, i) => (
            <p key={i} className="small" style={{ margin: 0 }}>
              <b className="hanzi">{c.char}</b> {c.notes.join(' · ')}
            </p>
          ))
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            This try was kept before each character was; only its number is here.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="ph-try-detail">
      {failed ? (
        <div className="ph-failed" role="alert">
          <b>This try could not be opened</b>
          <span className="small">{failed}</span>
          <span className="ph-failed-actions">
            <button className="btn tonal sm" onClick={() => setN((x) => x + 1)}>
              Try again
            </button>
          </span>
        </div>
      ) : result ? (
        <ScoredLine zh={a.text} readings={readings} result={result} />
      ) : (
        <div className="ph-scoring" role="status">
          <span className="spinner ph-scoring-spin" aria-hidden />
          <b>Opening…</b>
        </div>
      )}
    </div>
  );
}
