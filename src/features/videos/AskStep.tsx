import { useMemo, useState } from 'react';
import { readFixedPinyin } from '../../domain/videoPack';
import { explainLinePrompt, freePrompt, mistakesPrompt, pinyinPrompt } from '../../domain/videoPrompt';
import { latestChecks } from '../../domain/video';
import { saveAsk, setVideoLine } from '../../store/videoCommands';
import { ClaudeBox } from './ClaudeBox';
import { useLearner } from './hooks';
import { useVideoCtx } from './context';

type Kind = 'free' | 'line' | 'pinyin' | 'mistakes';

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'free', label: 'Anything' },
  { id: 'line', label: 'Explain a line' },
  { id: 'mistakes', label: 'My mistakes' },
  { id: 'pinyin', label: 'Fix a line’s pinyin' },
];

/**
 * Questions to Claude about the part, and the answers kept with the video.
 *
 * Every question carries the part's transcript and who the learner is, so
 * "what does 呢 do in line 7?" needs nothing else said. The answers stay on
 * the video, on every device, under the part they were about.
 */
export function AskStep() {
  const { video: v, part, lines, offset } = useVideoCtx();
  const learner = useLearner();
  const [kind, setKind] = useState<Kind>('free');
  const [q, setQ] = useState('');
  const [n, setN] = useState(1);
  const [fix, setFix] = useState<{ n: number; py: string } | null>(null);
  const check = latestChecks(v).get(part);
  const detailed = check?.way === 'detailed' && check.marks?.length ? check : null;

  const thread = useMemo(() => v.asks.filter((a) => a.part === part).sort((a, b) => b.at - a.at), [v.asks, part]);

  const question = (): string => {
    if (kind === 'line') return `Explain line ${n}: ${lines[n - 1]?.zh ?? ''}`;
    if (kind === 'pinyin') return `The pinyin of line ${n} looks wrong: ${lines[n - 1]?.py ?? ''}`;
    if (kind === 'mistakes') return 'What is the pattern in my notebook mistakes?';
    return q.trim();
  };

  const prompt = (): string => {
    if (kind === 'line') return explainLinePrompt(v, part, n, learner);
    if (kind === 'pinyin') return pinyinPrompt(v, part, n, learner);
    if (kind === 'mistakes') return mistakesPrompt(v, part, detailed?.marks ?? [], learner);
    return freePrompt(v, part, q.trim(), learner);
  };

  const needsLine = kind === 'line' || kind === 'pinyin';
  const ready = kind === 'free' ? !!q.trim() : kind === 'mistakes' ? !!detailed : n >= 1 && n <= lines.length;

  return (
    <div className="video-step ask-step">
      <div className="chips" role="group" aria-label="What to ask">
        {KINDS.map((k) => (
          <button key={k.id} className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="ask-form">
        {kind === 'free' && (
          <textarea rows={3} placeholder="What does 吧 do in line 4? Why is it 在 and not 是?" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        {needsLine && (
          <label className="small ask-line">
            Line
            <select value={n} onChange={(e) => setN(Number(e.target.value))}>
              {lines.map((l, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}. {l.zh}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'mistakes' && !detailed && (
          <p className="small muted">Check this part in the detailed way first: Claude needs to see what you wrote.</p>
        )}
        <ClaudeBox
          kind="check"
          label="Ask"
          what="an answer"
          disabled={!ready}
          prompt={prompt}
          onAnswer={(a) => {
            const text = a.trim();
            if (kind === 'pinyin') {
              const py = readFixedPinyin(text, lines[n - 1]?.zh ?? '');
              if (py) setFix({ n, py });
            }
            saveAsk(v.id, part, question(), text);
            if (kind === 'free') setQ('');
            return null;
          }}
        />
        {fix && (
          <div className="notice">
            <p className="small" style={{ margin: '0 0 6px' }}>
              Claude’s pinyin for line {fix.n}: <b>{fix.py}</b>
              <br />
              <span className="tiny muted">now: {lines[fix.n - 1]?.py}</span>
            </p>
            <button
              className="btn sm primary"
              onClick={() => {
                setVideoLine(v.id, offset + fix.n - 1, { py: fix.py });
                setFix(null);
              }}
            >
              Use it
            </button>{' '}
            <button className="btn sm ghost" onClick={() => setFix(null)}>
              Keep mine
            </button>
          </div>
        )}
      </div>

      {thread.length > 0 && (
        <div className="ask-thread">
          {thread.map((a) => (
            <div key={a.id} className="ask-item">
              <p className="small ask-q">{a.q}</p>
              <p className="small ask-a">{a.a}</p>
              <span className="tiny muted">{new Date(a.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
