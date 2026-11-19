import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { explainPrompt, explanationOf, isExplained } from '../../domain/explainText';
import { paths } from '../../navigation/paths';
import { copyText } from '../../platform/clipboard';
import { explainText } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import './shelves.css';
import { tabStored } from '../../platform/storage';

const CLAUDE = 'https://claude.ai/new';

/** Claude's answer while it is being brought back, kept in this tab: a reload or a trip to Claude loses nothing. */
function useAnswer(key: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return tabStored.get(key) ?? '';
    } catch {
      return '';
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      if (v) tabStored.set(key, v);
      else tabStored.remove(key);
    } catch {
      /* kept on screen only */
    }
  };
  return [value, set];
}

/**
 * /read/explain/:textId (T4): a pasted text's English, words, grammar and
 * questions, from the learner's own chat with Claude — a prompt to copy, the
 * answer pasted back, checked against the text's own Chinese, and laid over
 * it. Free: no key, nothing sent from here.
 *
 * States: the prompt (nothing pasted); an answer that is not one; an answer
 * with some lines changed (named, the rest used); a good answer; a text that
 * has its English already.
 */
export function ExplainTextPage() {
  const { textId = '' } = useParams();
  const text = useStore((s) => s.texts.find((t) => t.id === textId));
  const navigate = useNavigate();
  const toast = useToast();
  useTitle('Explain it with Claude');
  const [answer, setAnswer] = useAnswer(`hanzi.explain.${textId}`);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => (text ? explainPrompt(text) : ''), [text]);
  const result = useMemo(() => (text && answer.trim() ? explanationOf(text, answer) : null), [text, answer]);

  if (!text) return <Navigate to={paths.read()} replace />;

  async function copy() {
    const ok = await copyText(prompt);
    setCopied(ok);
    toast(ok ? 'Copied — paste it into a new chat with Claude' : 'Could not reach the clipboard. Open the prompt below and copy it by hand.');
  }

  function use() {
    if (!text || !result?.patch) return;
    explainText(text.id, result.patch);
    setAnswer('');
    toast(`${result.matched} of ${result.total} lines have their English now`);
    navigate(paths.text(text.id), { replace: true });
  }

  const name = text.titleZh || text.title;
  return (
    <div className="add-text-page">
      <header className="page-head">
        <Link className="back-link" to={paths.text(text.id)}>
          <Icon name="back" />
          <span className="hanzi">{name}</span>
        </Link>
      </header>
      <h1>Explain it with Claude</h1>
      <p className="muted">
        Your own chat with Claude gives each line its English, and the words, grammar and a few questions. The free plan is enough; nothing
        is sent from here.
      </p>
      {isExplained(text) && <p className="small">This text has its English already. A new answer replaces what it has.</p>}

      <section className="block">
        <h2 className="block-title">1. Take it to Claude</h2>
        <div className="row">
          <button className="btn tonal" onClick={copy}>
            {copied ? 'Copied' : 'Copy the prompt'}
          </button>
          <a className="btn" href={CLAUDE} target="_blank" rel="noreferrer">
            Open Claude ↗
          </a>
        </div>
        <details className="explain-prompt">
          <summary className="small">What the prompt says</summary>
          <pre className="prompt-pre">{prompt}</pre>
        </details>
      </section>

      <form
        className="block add-text-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          use();
        }}
      >
        <h2 className="block-title">2. Bring the answer back</h2>
        <label className="field">
          <span className="sr-only">Claude’s answer</span>
          <textarea
            className="add-text-box explain-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Paste Claude’s whole answer here, the ```json block and all"
            rows={7}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <p className="small add-text-about" data-warn={(result && (!result.patch || result.problems.length > 0)) || undefined}>
          {!result
            ? 'Copy the whole answer in Claude (the copy button under it), then paste it here.'
            : !result.patch
              ? result.problems.join(' ')
              : [`${result.matched} of ${result.total} lines have their English.`, ...result.problems].join(' ')}
        </p>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!result?.patch}>
            Use this answer
          </button>
        </div>
      </form>
    </div>
  );
}
