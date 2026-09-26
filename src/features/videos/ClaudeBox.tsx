import { useState } from 'react';
import type { AskKind } from '../../../shared/ask';
import { copyText } from '../../platform/clipboard';
import { CLAUDE_TROUBLE, useClaude } from '../shared/useClaude';

interface Props {
  /** built when it is needed — a pack prompt carries the whole word inventory */
  prompt: () => string;
  kind: AskKind;
  /** the button's words: "Prepare with Claude", "Ask" */
  label: string;
  /** what is being waited for, for the line under the button: "the study pack" */
  what: string;
  /** takes the answer; returns a problem to show when it could not be used, or null */
  onAnswer: (text: string) => string | null;
  primary?: boolean;
  disabled?: boolean;
}

/**
 * Asking Claude from a video page, whichever way Claude can be reached.
 *
 * On the home computer the server asks Claude Code, signed in to the
 * subscription, and the answer comes straight back. Everywhere else — the
 * iPad, the website — the prompt is copied, pasted into a Claude chat, and
 * the answer pasted back here: the same prompt, the same reading of the
 * answer, two more steps.
 */
export function ClaudeBox({ prompt, kind, label, what, onAnswer, primary, disabled }: Props) {
  const claude = useClaude();
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const busy = claude.waiting !== null;

  async function ask() {
    setProblem(null);
    const answer = await claude.ask(prompt(), kind);
    if (answer) setProblem(onAnswer(answer));
  }

  async function copy() {
    const ok = await copyText(prompt());
    setCopied(ok);
    if (!ok) setProblem('The prompt could not be copied here. Try again, or use the home computer.');
  }

  function use() {
    const p = onAnswer(paste);
    setProblem(p);
    if (!p) {
      setPaste('');
      setCopied(false);
    }
  }

  if (claude.ready) {
    return (
      <div className="claude-box">
        <button className={`btn ${primary ? 'primary' : ''}`} disabled={busy || disabled} onClick={() => void ask()}>
          {busy ? `Claude is writing… ${clock(claude.waiting!)}` : label}
        </button>
        {busy && (
          <>
            <span className="tiny muted">
              Claude on this computer is writing {what}.
              {/* Only a study pack is kept by the server while it is written (routes/ask.ts). */}
              {kind === 'video' ? ' You can leave this page; asking again picks up the answer.' : ' It takes up to a minute.'}
            </span>
            <button className="btn ghost sm" onClick={claude.cancel}>
              Stop waiting
            </button>
          </>
        )}
        {(problem || claude.error) && <p className="notice error">{problem ?? claude.error}</p>}
      </div>
    );
  }

  return (
    <div className="claude-box relay">
      {claude.why && <p className="notice">{CLAUDE_TROUBLE[claude.why]}</p>}
      <div className="claude-relay-row">
        <button className={`btn ${primary && !copied ? 'primary' : ''}`} disabled={disabled} onClick={() => void copy()}>
          {copied ? 'Copied — copy again' : `${label}: copy the prompt`}
        </button>
        <span className="tiny muted">Paste it into a Claude chat, then paste the whole answer below.</span>
      </div>
      <textarea
        className="claude-paste"
        rows={copied || paste ? 5 : 2}
        placeholder="Claude's answer"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <div>
        <button className={`btn sm ${paste.trim() ? 'primary' : ''}`} disabled={!paste.trim()} onClick={use}>
          Use the answer
        </button>
      </div>
      {problem && <p className="notice error">{problem}</p>}
    </div>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
