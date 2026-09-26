import { useEffect, useMemo, useState } from 'react';
import { bestHeard, describeMiss, heardShare, missed, understood, type HeardResult } from '../../domain/pinyin/heard';
import { hanOf, syllablesOf } from '../../domain/video';
import { canRecognise } from '../../platform/audio/recognition';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { patchVideo } from '../../store/videoCommands';
import { recordSaid, useSaidLog } from '../pinyin/progress';
import { RecordButton } from '../pinyin/RecordButton';
import { useSayIt } from '../pinyin/useSayIt';
import { useLibrary } from '../shared/library';
import { useVideoCtx } from './context';

/**
 * Saying the part's lines, one at a time: hear it from the video, say it,
 * and find out whether a listener would have understood.
 *
 * The listener is the browser's speech recognition, which hears a whole
 * sentence the way a person does. It is an extra, not a step the method
 * needs — the notebook is the method — and it is the only piece of the old
 * sentence shadowing kept, working on the video's own lines.
 */
export function SayStep() {
  const { video: v, lines, offset, canPlay, playLine, player } = useVideoCtx();
  const lib = useLibrary();
  const [at, setAt] = useState(0);
  const [heard, setHeard] = useState<HeardResult | null>(null);
  const log = useSaidLog();
  const line = lines[at]!;
  const id = (i: number) => `video:${v.id}:${offset + i}`;

  const say = useSayIt(
    () => undefined,
    (alternatives) => {
      const h = bestHeard(syllablesOf(line).join(' '), alternatives, (ch) => lib.byChar.get(ch)?.py ?? [], line.zh);
      setHeard(h);
      if (h) recordSaid({ id: id(at), mode: 'video', ok: understood(h, line.zh), share: heardShare(h) });
    },
    Math.max(4000, Math.min(15000, (line.end - line.at) * 1000 * 2 + 1500)),
  );

  useEffect(() => setHeard(null), [at]);

  const ever = useMemo(() => {
    const ok = new Set(log.filter((s) => s.mode === 'video' && s.ok).map((s) => s.id));
    return lines.map((_, i) => ok.has(id(i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, lines, v.id, offset]);

  // Every line of the part understood at least once: it can be said.
  useEffect(() => {
    if (ever.length && ever.every(Boolean) && !v.marks.said) patchVideo(v.id, { marks: { said: true } });
  }, [ever, v.id, v.marks.said]);

  const noMic = micUnavailable();
  if (noMic) return <p className="notice">{MIC_MESSAGE[noMic]}</p>;

  const han = hanOf(line.zh);
  return (
    <div className="video-step say-step">
      {!canRecognise() && (
        <p className="notice">
          This browser has no speech recognition, so it cannot tell whether you were understood. Safari on the iPad has it.
        </p>
      )}
      <div className="say-line">
        <span className="tiny muted">
          Line {at + 1} of {lines.length}
        </span>
        <div className="say-syls">
          {syllablesOf(line).map((py, j) => {
            const s = heard?.syllables[j];
            return (
              <span key={j} className="syl" data-state={heard ? (missed(s) ? 'wrong' : 'right') : undefined} title={s && missed(s) ? describeMiss(s) : undefined}>
                <span className="syl-han hanzi">{han[j]}</span>
                <span className="syl-py">{py}</span>
              </span>
            );
          })}
        </div>
        {line.en && <p className="tiny muted" style={{ margin: '4px 0 0' }}>{line.en}</p>}
        <p className="small say-verdict" data-state={heard ? (understood(heard, line.zh) ? 'right' : 'wrong') : undefined}>
          {heard
            ? understood(heard, line.zh)
              ? `Understood — ${Math.round(heardShare(heard) * 100)}% of it came through as meant.`
              : `Not quite: heard “${heard.text}”.`
            : ' '}
        </p>
      </div>
      <div className="row say-controls">
        <button className="btn" disabled={at === 0} onClick={() => setAt(at - 1)} aria-label="Previous line">
          ←
        </button>
        {canPlay && (
          <button className="btn line-play" onClick={() => playLine(at)}>
            {player.playing ? 'Playing…' : 'Hear it'}
          </button>
        )}
        <RecordButton state={say.state} level={say.level} onToggle={say.toggle} compact />
        <button className="btn" disabled={at >= lines.length - 1} onClick={() => setAt(at + 1)}>
          Next →
        </button>
      </div>
      {(say.error || say.heardError) && <p className="notice error">{say.error ?? say.heardError}</p>}
      <div className="line-strip" aria-label="Lines">
        {lines.map((_, i) => (
          <button key={i} aria-current={i === at || undefined} data-state={ever[i] ? 'right' : undefined} onClick={() => setAt(i)}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
