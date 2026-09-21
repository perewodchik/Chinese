import type { AskKind } from '../../../shared/ask';
import { CLAUDE_TROUBLE, type ClaudeHelp } from './useClaude';

interface Props {
  claude: ClaudeHelp;
  kind: AskKind;
  /** the prompt as the clipboard would have had it */
  text: string;
  /** what the answer is called in the sentence about waiting: "the passages", "the words" */
  what: string;
  /** roughly how long it takes, in the same words the learner would use */
  takes: string;
  onAnswer: (text: string) => void;
}

/**
 * The button that skips the clipboard.
 *
 * It only exists where the server can reach Claude through the learner's own
 * subscription — their computer, not the iPad and not the website — so the
 * three steps below it are still the real instructions everywhere else, and
 * this is not a second way of doing it so much as the first two steps done
 * for you.
 *
 * While it waits it says how long it has been waiting. Nothing can report how
 * far through writing a passage Claude is, and a spinner that has been
 * spinning for four minutes is indistinguishable from one that has crashed.
 */
export function AskClaude({ claude, kind, text, what, takes, onAnswer }: Props) {
  const busy = claude.waiting !== null;

  if (!claude.ready) {
    return claude.why ? <p className="notice">{CLAUDE_TROUBLE[claude.why]}</p> : null;
  }

  async function run() {
    const answer = await claude.ask(text, kind);
    if (answer) onAnswer(answer);
  }

  return (
    <div className="ask-claude">
      <button className="btn primary" style={{ width: '100%' }} disabled={busy} onClick={() => void run()}>
        {busy ? `Claude is writing… ${clock(claude.waiting!)}` : `Ask Claude here — skip the copying`}
      </button>
      {busy ? (
        <>
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            Claude Code on this computer is writing {what}. It takes {takes}; the answer drops straight
            into the next step. You can leave this page — but then the answer is lost, and the prompt is
            still there to copy.
          </p>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={claude.cancel}>
            Stop waiting
          </button>
        </>
      ) : (
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          Through Claude Code on this computer, signed in to your subscription. The same prompt, the same
          answer — without the tab and the two pastes. It is not on the iPad, where the steps below are
          the way.
        </p>
      )}
      {claude.error && (
        <p className="notice error" style={{ marginTop: 10 }}>
          {claude.error}
        </p>
      )}
    </div>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
