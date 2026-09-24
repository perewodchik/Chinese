import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bestHeard, missed, understood } from '../../domain/pinyin/heard';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { canRecognise } from '../../platform/audio/recognition';
import { useLibrary } from '../shared/library';
import { allTakes, BENCHMARK, monthName, monthOf, saveTake, type Take } from './benchmark';
import { RecordButton } from './RecordButton';
import type { ShadowSentence } from './ShadowPage';
import { useSayIt } from './useSayIt';
import { playSamples, say } from '../../platform/audio/voiceOut';

/**
 * This month's check, against the first one.
 *
 * Six sentences, each said once and kept. Beside each, the take from the
 * first month there was one, so the two can be heard back to back — which is
 * where progress becomes audible — and at the top the number understood,
 * then and now.
 */
export function BenchmarkCard({ sentences }: { sentences: ShadowSentence[] }) {
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const blocked = micUnavailable();
  const month = monthOf(Date.now());

  useEffect(() => {
    void allTakes().then(setTakes);
  }, []);

  const rows = useMemo(
    () => BENCHMARK.map((zh) => sentences.find((s) => s.zh === zh)).filter((s): s is ShadowSentence => !!s),
    [sentences],
  );
  const months = useMemo(() => [...new Set((takes ?? []).map((t) => t.month))].sort(), [takes]);
  const first = months[0];
  const count = (m: string | undefined) => (takes ?? []).filter((t) => t.month === m && t.ok).length;
  const said = (m: string | undefined) => (takes ?? []).filter((t) => t.month === m).length;

  const onTake = useCallback(async (take: Take) => {
    const ok = await saveTake(take);
    setSaveFailed(!ok);
    setTakes((ts) => [...(ts ?? []).filter((t) => t.id !== take.id), take]);
  }, []);

  if (!takes) return <p className="small muted">Loading your checks…</p>;

  return (
    <div className="drill-stage benchmark-stage">
      <div className="benchmark-head">
        <p className="small muted" style={{ margin: 0 }}>
          The same six sentences once a month, read from the page. Each one is kept on this device, so you can hear
          how you sounded before — the clearest sign of progress there is.
        </p>
        <div className="benchmark-score">
          <span>
            <b>
              {count(month)}/{rows.length}
            </b>
            <span className="tiny muted">understood in {monthName(month)}</span>
          </span>
          {first && first !== month && (
            <span>
              <b>
                {count(first)}/{said(first)}
              </b>
              <span className="tiny muted">in {monthName(first)}, the first check</span>
            </span>
          )}
        </div>
      </div>

      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}
      {saveFailed && (
        <p className="notice speak-notice">This browser would not keep the recording — a private window cannot.</p>
      )}
      {!canRecognise() && (
        <p className="tiny muted" style={{ margin: 0 }}>
          Without speech recognition in this browser the takes are kept, but nothing can say whether they were
          understood. Safari on the iPad has one, with Siri and Dictation on.
        </p>
      )}

      <div className="benchmark-rows">
        {rows.map((s) => (
          <BenchmarkRow
            key={s.id}
            sentence={s}
            month={month}
            now={takes.find((t) => t.id === `${month}|${s.zh}`) ?? null}
            then={first && first !== month ? (takes.find((t) => t.id === `${first}|${s.zh}`) ?? null) : null}
            thenLabel={first ? monthName(first) : ''}
            disabled={!!blocked}
            onTake={onTake}
          />
        ))}
      </div>
    </div>
  );
}

function BenchmarkRow({
  sentence,
  month,
  now,
  then,
  thenLabel,
  disabled,
  onTake,
}: {
  sentence: ShadowSentence;
  month: string;
  now: Take | null;
  then: Take | null;
  thenLabel: string;
  disabled: boolean;
  onTake: (t: Take) => void;
}) {
  const lib = useLibrary();
  // A ref, not state: the recording and what recognition made of it arrive
  // separately, and the second must find the first however the renders fall.
  const samples = useRef<Float32Array | null>(null);
  const syllables = sentence.py.split(' ');

  const keep = useCallback(
    (ok: boolean, heard: string) =>
      samples.current &&
      onTake({ id: `${month}|${sentence.zh}`, month, sentence: sentence.zh, at: Date.now(), samples: samples.current, ok, heard }),
    [sentence, month, onTake],
  );
  const onRecorded = useCallback(
    (s: Float32Array) => {
      samples.current = s;
      // With nothing to say whether it was understood, the take is still worth keeping to hear later.
      if (!canRecognise()) keep(false, '');
    },
    [keep],
  );
  const onHeard = useCallback(
    (alternatives: string[]) => {
      const h = bestHeard(sentence.py, alternatives, (ch) => lib.byChar.get(ch)?.py ?? [], sentence.zh);
      keep(understood(h, sentence.zh), h?.text ?? '');
    },
    [sentence, lib, keep],
  );
  const rec = useSayIt(onRecorded, onHeard, 2500 + 500 * syllables.length);

  const heardMisses = useMemo(() => {
    if (!now?.heard) return null;
    const h = bestHeard(sentence.py, [now.heard], (ch) => lib.byChar.get(ch)?.py ?? [], sentence.zh);
    return h?.syllables.filter(missed).length ?? null;
  }, [now, sentence, lib]);

  return (
    <div className="benchmark-row" data-state={now ? (now.ok ? 'right' : 'wrong') : undefined}>
      <div className="benchmark-text">
        <span className="hanzi" lang="zh-CN">
          {sentence.zh}
        </span>
        <span className="tiny benchmark-py">{sentence.py}</span>
        <span className="tiny muted">
          {now
            ? now.ok
              ? `Understood · it wrote ${now.heard}`
              : `Not quite · it wrote ${now.heard || 'nothing'}${heardMisses ? ` (${heardMisses} off)` : ''}`
            : 'Not said this month'}
        </span>
      </div>
      <div className="benchmark-controls">
        <RecordButton compact state={rec.state} level={rec.level} onToggle={rec.toggle} disabled={disabled} />
        <div className="benchmark-plays">
          <button className="btn ghost sm" disabled={!now} onClick={() => now && void playSamples(now.samples)}>
            ▶ Now
          </button>
          {then && (
            <button className="btn ghost sm" onClick={() => void playSamples(then.samples)} title={thenLabel}>
              ▶ {thenLabel.split(' ')[0]}
            </button>
          )}
          <button className="btn ghost sm" onClick={() => void say(sentence.zh)}>
            🔊 Native
          </button>
        </div>
      </div>
    </div>
  );
}
