import { useMemo, useState } from 'react';
import { charId } from '../../domain/ids';
import { isDue } from '../../domain/memory';
import { buildBrief, buildPrompt, HANDOFF_STEPS, type PromptExtras } from '../../domain/prompt';
import type { TextPlan } from '../../domain/text';
import { readableWords } from '../../domain/vocab';
import { copyText } from '../../platform/clipboard';
import { downloadText } from '../../platform/files';
import { patchPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';

interface Props {
  plan: TextPlan;
  onNext: () => void;
  onBack: () => void;
}

/** As many words as make a useful list without burying the rest of the prompt. */
const MAX_WORDS = 400;

const CLAUDE = 'https://claude.ai/new';

/**
 * The handover.
 *
 * No key, no endpoint, no billing: the prompt is a piece of text, and the
 * subscription you already pay for is on the other side of a copy and a paste.
 * The prompt is shown in full rather than hidden behind a button, because it
 * is the thing being sent on your behalf and you should be able to read it —
 * and because sometimes the right move is to edit one line before sending.
 */
export function PromptStep({ plan, onNext, onBack }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const [tab, setTab] = useState<'prompt' | 'json'>('prompt');
  const [copied, setCopied] = useState(false);
  const recall = useStore((s) => s.recall);

  /**
   * Two things the app knows and the plan does not carry: which compounds are
   * actually readable out of the inventory, and which previously-taught
   * characters the schedule says are slipping. Both are computed here, at the
   * moment the prompt is built, rather than frozen into the plan — a session
   * finished tomorrow should ask for what is falling due tomorrow.
   */
  const extra: PromptExtras = useMemo(() => {
    const known = new Set([...plan.basis, ...plan.met]);
    const now = Date.now();
    return {
      words: readableWords(lib, known)
        .slice(0, MAX_WORDS)
        .map((w) => w.w),
      revisit: plan.met.filter((c) => {
        const r = recall[charId(c)]?.recognise;
        return Boolean(r && isDue(r, now));
      }),
    };
  }, [lib, plan.basis, plan.met, recall]);

  const text = useMemo(
    () => (tab === 'prompt' ? buildPrompt(plan, extra) : buildBrief(plan, extra)),
    [plan, tab, extra],
  );

  async function copy() {
    const ok = await copyText(text);
    setCopied(ok);
    patchPlan({ copiedAt: Date.now() });
    toast(
      ok
        ? 'Prompt copied — paste it into a new Claude chat'
        : 'Could not reach the clipboard. Select the text and copy it by hand.',
    );
  }

  const words = Math.round(text.length / 5);

  return (
    <div className="split studio-split">
      <div className="card">
        <header>
          <div className="chips">
            <button className="chip" aria-pressed={tab === 'prompt'} onClick={() => setTab('prompt')}>
              Prompt
            </button>
            <button className="chip" aria-pressed={tab === 'json'} onClick={() => setTab('json')}>
              JSON brief
            </button>
          </div>
          <div className="spacer" />
          <span className="tiny muted">
            {plan.specs.length} passages · roughly {words.toLocaleString()} words
          </span>
          <button className="btn sm" onClick={() => downloadText(fileName(plan, tab), text)}>
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
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            The JSON tab says the same thing as data, if you would rather hand over a brief than a letter.
            Either one comes back as the same JSON block.
          </p>
          <p className="notice" style={{ marginTop: 12 }}>
            Nothing is sent to Claude from this app. The plan is saved to your account, so you can close
            the tab, sleep on it, and finish tomorrow — on the iPad, if you like.
          </p>
        </div>
        <footer className="card-foot">
          <button className="btn ghost sm" onClick={onBack}>
            ← Change the plan
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

const fileName = (plan: TextPlan, tab: 'prompt' | 'json') =>
  `${plan.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'session'}.${tab === 'json' ? 'json' : 'md'}`;
