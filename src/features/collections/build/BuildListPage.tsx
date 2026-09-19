import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  CEILINGS,
  emptyListPlan,
  LIST_IDEAS,
  LIST_LANGS,
  LIST_SIZES,
  LIST_STEPS,
  type ListLang,
  type ListStep,
  type WordListPlan,
} from '../../../domain/wordlist';
import { paths } from '../../../navigation/paths';
import { discardListPlan, patchListPlan } from '../../../store/commands';
import { useStore } from '../../../store/store';
import { Seg } from '../../../ui/Seg';
import { useTitle } from '../../../ui/useTitle';
import { ListImportStep } from './ListImportStep';
import { ListPromptStep } from './ListPromptStep';

/** A word list being written with Claude, at /collections/build/describe, …/prompt and …/paste. */
export function BuildListPage() {
  const { step } = useParams();
  const plan = useStore((s) => s.listPlan);
  if (!plan) return <NoList />;
  const current = LIST_STEPS.find((s) => s.id === step)?.id;
  if (!current) return <Navigate to={paths.buildList(plan.step)} replace />;
  return <Builder plan={plan} step={current} />;
}

function NoList() {
  useTitle('No word list in progress');
  return (
    <div className="empty">
      <span className="big">词</span>
      <p>There is no word list being written. It was saved or thrown away — here, or on another device.</p>
      <Link className="btn" to={paths.collections()}>
        Back to collections
      </Link>
    </div>
  );
}

/**
 * The same three steps as a writing session — say what you want, take the
 * prompt to Claude, bring the answer back — for a collection instead of a
 * passage. Saved the whole way, because the middle step happens elsewhere.
 */
function Builder({ plan, step }: { plan: WordListPlan; step: ListStep }) {
  useTitle(plan.name || 'Word list');
  const navigate = useNavigate();

  useEffect(() => {
    if (plan.step !== step) patchListPlan({ step });
  }, [plan.step, step]);

  const canGo = plan.request.trim().length > 0;
  if (!canGo && step !== 'describe') return <Navigate to={paths.buildList('describe')} replace />;

  const go = (id: ListStep) => navigate(paths.buildList(id));

  function discard() {
    if (!confirm('Throw this word list away? What you described and anything pasted go with it.')) return;
    navigate(paths.collections(), { replace: true, flushSync: true });
    discardListPlan();
  }

  return (
    <section className="studio">
      <div className="editor-bar">
        <Link className="btn ghost sm" to={paths.collections()} title="Back to all collections">
          ←
        </Link>
        <input
          className="title-input"
          value={plan.name}
          onChange={(e) => patchListPlan({ name: e.target.value })}
          aria-label="Name of this word list"
        />
        <div className="spacer" />
        <button className="btn danger sm" onClick={discard}>
          Discard
        </button>
      </div>

      <nav className="stepper" aria-label="Word list steps">
        {LIST_STEPS.map((s, i) => (
          <button
            key={s.id}
            className="step"
            aria-current={step === s.id}
            data-done={LIST_STEPS.findIndex((x) => x.id === step) > i}
            disabled={!canGo && s.id !== 'describe'}
            onClick={() => go(s.id)}
          >
            <span className="dot">{i + 1}</span>
            <span className="txt">
              <b>{s.label}</b>
              <i>{s.hint}</i>
            </span>
          </button>
        ))}
      </nav>

      {step === 'describe' && <Describe plan={plan} canGo={canGo} onNext={() => go('prompt')} />}
      {step === 'prompt' && (
        <ListPromptStep plan={plan} onBack={() => go('describe')} onNext={() => go('paste')} />
      )}
      {step === 'paste' && (
        <ListImportStep
          plan={plan}
          onBack={() => go('prompt')}
          onDone={(id) => navigate(paths.collection(id, 'words'), { replace: true, flushSync: true })}
        />
      )}
    </section>
  );
}

const isDefaultName = (name: string) =>
  !name.trim() || name === emptyListPlan('', 0).name || LIST_IDEAS.includes(name);

function Describe({ plan, canGo, onNext }: { plan: WordListPlan; canGo: boolean; onNext: () => void }) {
  return (
    <div className="split studio-split">
      <div className="card">
        <header>
          <h2>What do you need the words for?</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <textarea
            className="request-box"
            value={plan.request}
            autoFocus
            placeholder={
              'A topic — “the kitchen”, “emotions” — or a situation to get ready for, in as much detail as you like:\n\n' +
              '“On Thursday I see a doctor about my stomach. I want to explain what hurts, since when, what I ate, and understand what they tell me to do.”'
            }
            onChange={(e) => patchListPlan({ request: e.target.value })}
          />
          <div>
            <span className="tiny muted">Or start from one of these:</span>
            <div className="chips topic-chips" style={{ marginTop: 6 }}>
              {LIST_IDEAS.map((idea) => (
                <button
                  key={idea}
                  className="chip"
                  aria-pressed={plan.request.trim() === idea}
                  onClick={() =>
                    patchListPlan({
                      request: idea,
                      // Named after the idea unless you have named it yourself.
                      name: isDefaultName(plan.name) ? idea : plan.name,
                    })
                  }
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card side">
        <header>
          <h2>What to ask for</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            How many words
            <Seg
              size="sm"
              label="How many words"
              value={String(plan.size)}
              onChange={(v) => patchListPlan({ size: Number(v) })}
              options={LIST_SIZES.map((n) => ({ id: String(n), label: String(n) }))}
            />
          </div>

          <label className="field">
            How hard
            <select value={plan.ceiling} onChange={(e) => patchListPlan({ ceiling: Number(e.target.value) })}>
              {CEILINGS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            Explanations in
            <Seg
              size="sm"
              label="Language of the explanations"
              value={plan.lang}
              onChange={(lang: ListLang) => patchListPlan({ lang })}
              options={LIST_LANGS.map((l) => ({ id: l.id, label: l.label }))}
            />
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={plan.phrases}
              onChange={(e) => patchListPlan({ phrases: e.target.checked })}
            />
            <span>
              Set phrases too
              <span className="d">A few chunks said as one piece — 请问, 怎么办 — where the situation needs them</span>
            </span>
          </label>

          <p className="tiny muted" style={{ margin: 0 }}>
            Each word comes back with its reading, its HSK band, what it is for and how it is used, and two or
            three example sentences. It is told which characters you can read, so the examples lean on them.
            The characters you have not learned yet become the collection, ready for practice sheets.
          </p>
        </div>
        <footer className="card-foot">
          <span className="tiny muted">Step 1 of 3</span>
          <div className="spacer" />
          <button className="btn primary" disabled={!canGo} onClick={onNext}>
            Build the prompt →
          </button>
        </footer>
      </div>
    </div>
  );
}
