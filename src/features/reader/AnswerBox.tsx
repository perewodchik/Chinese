import { useState } from 'react';
import { checkPrompt, readCheck, type AnswerCheck } from '../../domain/answer';
import type { GeneratedText, TextLine } from '../../domain/text';
import { copyText } from '../../platform/clipboard';
import { useClaude } from '../shared/useClaude';

const SAID: Record<AnswerCheck['verdict'], string> = {
  right: 'Right',
  nearly: 'Nearly',
  wrong: 'Not quite',
};

/**
 * Somewhere to answer a question, and a way to find out whether you were right.
 *
 * Where the server can reach Claude, Check asks it and the verdict appears
 * under the answer. Where it cannot — the iPad, the website — the same prompt
 * goes on the clipboard and the reply is pasted back, which is how every other
 * Claude step in the app works there. The model answer the writer left is
 * always a tap away either way, and needs neither.
 */
export function AnswerBox({ text, question }: { text: GeneratedText; question: TextLine }) {
  const claude = useClaude();
  const [answer, setAnswer] = useState('');
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [relay, setRelay] = useState<'idle' | 'copied'>('idle');
  const [pasted, setPasted] = useState('');
  const [trouble, setTrouble] = useState<string | null>(null);

  const prompt = () => checkPrompt(text, question, answer);

  async function ask() {
    setTrouble(null);
    const reply = await claude.ask(prompt(), 'check');
    if (reply === null) return;
    const read = readCheck(reply);
    if (read) setCheck(read);
    else setTrouble('Claude answered, but not with a verdict this page can read. Try again.');
  }

  async function copy() {
    setTrouble(null);
    const ok = await copyText(prompt());
    setRelay('copied');
    if (!ok) setTrouble('Could not reach the clipboard. Try once more, or check on the computer.');
  }

  function takePaste(value: string) {
    setPasted(value);
    const read = readCheck(value);
    setTrouble(value.trim() && !read ? 'That does not look like Claude’s verdict yet — paste the whole reply.' : null);
    if (read) {
      setCheck(read);
      setRelay('idle');
      setPasted('');
    }
  }

  const waiting = claude.waiting !== null;
  const empty = !answer.trim();

  return (
    <div className="answer">
      <textarea
        className="answer-input"
        value={answer}
        rows={2}
        placeholder="Your answer — in Chinese if you can, English is fine"
        aria-label={`Your answer to: ${question.zh}`}
        onChange={(e) => {
          setAnswer(e.target.value);
          setCheck(null);
        }}
      />
      <div className="answer-actions">
        {claude.ready ? (
          <button className="btn sm primary check-btn" disabled={empty || waiting} onClick={() => void ask()}>
            {waiting ? `Checking… ${claude.waiting}s` : 'Check answer'}
          </button>
        ) : (
          <button
            className="btn sm check-btn"
            disabled={empty}
            onClick={() => void copy()}
            title="Copy a short prompt to paste into Claude, then paste its reply back here"
          >
            {relay === 'copied' ? 'Copied ✓' : 'Check with Claude'}
          </button>
        )}
        {waiting && (
          <button className="btn ghost sm" onClick={claude.cancel}>
            Stop
          </button>
        )}
        {question.a && (
          <button className="btn ghost sm" onClick={() => setShowModel((s) => !s)} aria-pressed={showModel}>
            Model answer
          </button>
        )}
      </div>

      {relay === 'copied' && !claude.ready && (
        <textarea
          className="answer-input"
          rows={2}
          value={pasted}
          placeholder="Paste Claude’s reply here"
          aria-label="Claude’s reply"
          onChange={(e) => takePaste(e.target.value)}
        />
      )}

      {showModel && question.a && (
        <p className="answer-model">
          <span className="tiny muted">The writer’s answer</span>
          <span className="hanzi">{question.a}</span>
        </p>
      )}

      {check && (
        <div className="answer-verdict" data-state={check.verdict}>
          <b>{SAID[check.verdict]}</b>
          {check.feedback && <span>{check.feedback}</span>}
          {check.better && <span className="hanzi">{check.better}</span>}
        </div>
      )}

      {(trouble || claude.error) && <p className="tiny muted">{trouble ?? claude.error}</p>}
    </div>
  );
}
