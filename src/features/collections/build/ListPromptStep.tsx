import { useMemo, useState } from 'react';
import { charId } from '../../../domain/ids';
import { HANDOFF_STEPS } from '../../../domain/prompt';
import { buildListPrompt, type WordListPlan } from '../../../domain/wordlist';
import { copyText } from '../../../platform/clipboard';
import { downloadText } from '../../../platform/files';
import { patchListPlan } from '../../../store/commands';
import { useStore } from '../../../store/store';
import { useToast } from '../../../ui/toast';
import { useLibrary } from '../../shared/library';

interface Props {
  plan: WordListPlan;
  onNext: () => void;
  onBack: () => void;
}

/** Enough of what you can read to write examples in, without burying the brief under it. */
const MAX_KNOWN = 1200;

const CLAUDE = 'https://claude.ai/new';

/** The brief, shown in full, to copy into Claude. */
export function ListPromptStep({ plan, onNext, onBack }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const learned = useStore((s) => s.learned);
  const [copied, setCopied] = useState(false);

  // Worked out now rather than frozen into the plan: a list finished tomorrow
  // should know what you had learned by tomorrow.
  const known = useMemo(
    () =>
      lib.characters
        .filter((c) => learned.has(charId(c.c)))
        .sort((a, b) => a.freq - b.freq)
        .slice(0, MAX_KNOWN)
        .map((c) => c.c),
    [lib, learned],
  );
  const text = useMemo(() => buildListPrompt(plan, known), [plan, known]);

  async function copy() {
    const ok = await copyText(text);
    setCopied(ok);
    patchListPlan({ copiedAt: Date.now() });
    toast(
      ok
        ? 'Prompt copied — paste it into a new Claude chat'
        : 'Could not reach the clipboard. Select the text and copy it by hand.',
    );
  }

  const fileName = `${plan.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'word list'}.md`;

  return (
    <div className="split studio-split">
      <div className="card">
        <header>
          <h2>Prompt</h2>
          <div className="spacer" />
          <span className="tiny muted">
            {plan.size} words · {known.length ? `${known.length} characters you can read` : 'no characters learned yet'}
          </span>
          <button className="btn sm" onClick={() => downloadText(fileName, text)}>
            Save as file
          </button>
          <button className="btn primary sm" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </header>
        <pre className="prompt-pre">{text}</pre>
      </div>

      <div className="card side">
        <header>
          <h2>Taking it to Claude</h2>
        </header>
        <div className="body">
          <ol className="handoff">
            {HANDOFF_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <a className="btn" href={CLAUDE} target="_blank" rel="noreferrer" style={{ width: '100%', marginTop: 4 }}>
            Open Claude ↗
          </a>
          <p className="notice" style={{ marginTop: 12 }}>
            Nothing is sent to Claude from this app. The list is saved to your account, so you can close the
            tab and finish later — on the iPad, if you like.
          </p>
        </div>
        <footer className="card-foot">
          <button className="btn ghost sm" onClick={onBack}>
            ← Change the request
          </button>
          <div className="spacer" />
          <button className="btn primary" onClick={onNext}>
            I have the answer →
          </button>
        </footer>
      </div>
    </div>
  );
}
