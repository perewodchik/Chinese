import { useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { basisPool, emptySpec, renumber, taughtAlready } from '../../domain/teach';
import {
  LEVELS,
  hanziIn,
  PLAN_STEPS,
  pickTopic,
  type Level,
  type PlanStep,
  type TextLength,
  type TextPlan,
  type TextSpec,
} from '../../domain/text';
import { paths } from '../../navigation/paths';
import { discardPlan, patchPlan, setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { ImportStep } from './ImportStep';
import { PromptStep } from './PromptStep';
import { SpecCard } from './SpecCard';

/** The writing session in progress, at /texts/session/plan, …/prompt and …/paste. */
export function SessionPage() {
  const { step } = useParams();
  const plan = useStore((s) => s.plan);
  if (!plan) return <NoSession />;
  const current = PLAN_STEPS.find((s) => s.id === step)?.id;
  if (!current) return <Navigate to={paths.session(plan.step)} replace />;
  return <Studio plan={plan} step={current} />;
}

function NoSession() {
  useTitle('No session in progress');
  return (
    <div className="empty">
      <span className="big">读</span>
      <p>There is no writing session in progress. It was saved or thrown away — here, or on another device.</p>
      <Link className="btn" to={paths.texts()}>
        Back to the shelf
      </Link>
    </div>
  );
}

/**
 * A writing session, on its own page.
 *
 * It used to be a dialog with four controls, which was the right size for
 * asking one question and the wrong size for planning an evening's reading.
 * Three steps, each at an address of its own: decide what to ask for, take the
 * prompt to Claude, bring the answer back. The session is saved the whole way,
 * because the middle step happens in another tab and sometimes on another day.
 */
function Studio({ plan, step }: { plan: TextPlan; step: PlanStep }) {
  useTitle(plan.name || 'Writing session');
  const lib = useLibrary();
  const navigate = useNavigate();
  const learned = useStore((s) => s.learned);
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const collections = useStore((s) => s.collections);

  // Where the session was left is saved with it, so Continue on the shelf —
  // on this device or another — comes back to this step.
  useEffect(() => {
    if (plan.step !== step) patchPlan({ step });
  }, [plan.step, step]);

  // Everything earlier texts have already taught. Told to the writer as mine:
  // fair to reuse — I need the practice — but not new, and not to be re-taught.
  const met = useMemo(() => [...taughtAlready(texts)], [texts]);
  // A sorted pass over three thousand characters, once — not once per
  // keystroke in the topic field.
  const pool = useMemo(() => basisPool(lib, learned), [lib, learned]);

  const specs = plan.specs;
  const budget = specs.reduce((n, s) => n + s.newCount, 0);
  const canGo = plan.basis.length >= 10 && specs.length > 0;

  // Too little in the plan to prompt for: an address typed by hand goes back to planning.
  if (!canGo && step !== 'plan') return <Navigate to={paths.session('plan')} replace />;

  const go = (id: PlanStep) => navigate(paths.session(id));

  /**
   * `basisCount` is what was asked for, `basis` is what there was — the ask is
   * kept un-clamped so that marking another fifty characters learned next week
   * widens the basis to the number that was chosen, rather than to the number
   * there happened to be on the day the dial was last touched.
   */
  function setBasis(count: number) {
    const basis = pool.slice(0, Math.max(1, Math.min(count, pool.length)));
    const inBasis = new Set(basis);
    patchPlan({ basisCount: count, basis, met: met.filter((c) => !inBasis.has(c)) });
    setSettings({ basisCount: count });
  }

  const update = (next: TextSpec[]) => patchPlan({ specs: renumber(next) });

  const takenTopics = (except?: string) =>
    new Set(
      specs
        .filter((s) => s.id !== except)
        .map((s) => s.topic.trim())
        .filter(Boolean),
    );

  /** A session that is all the same is a session you stop reading halfway. */
  function vary() {
    const order: Level[] = LEVELS.map((d) => d.id);
    const lengths: TextLength[] = ['short', 'medium', 'long'];
    const used = takenTopics();
    update(
      specs.map((s, i): TextSpec => {
        const topic = s.topic.trim() || pickTopic(used);
        used.add(topic);
        return { ...s, level: order[i % order.length], length: lengths[i % lengths.length], topic };
      }),
    );
  }

  function discard() {
    if (!confirm('Throw this session away? The plan and anything pasted go with it.')) return;
    // Off the page first: once the session is gone there is nothing here to show.
    navigate(paths.texts(), { replace: true, flushSync: true });
    discardPlan();
  }

  return (
    <section className="studio">
      <div className="editor-bar">
        <Link className="btn ghost sm" to={paths.texts()} title="Back to all texts">
          ←
        </Link>
        <input
          className="title-input"
          value={plan.name}
          onChange={(e) => patchPlan({ name: e.target.value })}
          aria-label="Name of this session"
        />
        <div className="spacer" />
        <button className="btn danger sm" onClick={discard}>
          Discard session
        </button>
      </div>

      <nav className="stepper" aria-label="Session steps">
        {PLAN_STEPS.map((s, i) => (
          <button
            key={s.id}
            className="step"
            aria-current={step === s.id}
            data-done={PLAN_STEPS.findIndex((x) => x.id === step) > i}
            disabled={!canGo && s.id !== 'plan'}
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

      {step === 'plan' && (
        <div className="split studio-split">
          <div>
            <div className="board-bar row">
              <b>
                {specs.length} passage{specs.length === 1 ? '' : 's'}
              </b>
              <span className="tiny muted">
                · about {budget} new character{budget === 1 ? '' : 's'} between them
              </span>
              <div className="spacer" />
              <button className="btn sm" onClick={vary} title="Spread the levels out">
                Vary them
              </button>
              <button
                className="btn sm"
                onClick={() =>
                  update([
                    ...specs,
                    emptySpec({
                      level: specs[specs.length - 1]?.level ?? 'edge',
                      length: specs[specs.length - 1]?.length ?? 'medium',
                      newCount: specs[specs.length - 1]?.newCount ?? 5,
                      hsk: specs[specs.length - 1]?.hsk ?? 2,
                      ceiling: specs[specs.length - 1]?.ceiling ?? 3,
                      structure: specs[specs.length - 1]?.structure ?? 'flow',
                    }),
                  ])
                }
              >
                + Add a passage
              </button>
            </div>

            <div className="spec-grid">
              {specs.map((s, i) => (
                <SpecCard
                  key={s.id}
                  spec={s}
                  index={i}
                  onChange={(p) => update(specs.map((x) => (x.id === s.id ? { ...x, ...p } : x)))}
                  onRollTopic={() =>
                    update(specs.map((x) => (x.id === s.id ? { ...x, topic: pickTopic(takenTopics(s.id)) } : x)))
                  }
                  onDuplicate={() =>
                    update([...specs.slice(0, i + 1), { ...emptySpec(), ...s, id: `${s.id}-copy` }, ...specs.slice(i + 1)])
                  }
                  onRemove={() => update(specs.filter((x) => x.id !== s.id))}
                  canRemove={specs.length > 1}
                />
              ))}
            </div>
          </div>

          <div className="card side">
            <header>
              <h2>What it may assume</h2>
            </header>
            <div className="body" style={{ display: 'grid', gap: 14 }}>
              <p className="tiny muted" style={{ margin: 0 }}>
                The <b>{pool.length}</b> character{pool.length === 1 ? '' : 's'} you have marked learned, and
                nothing else. Not a band you are partway through: a passage written as though HSK 1 were
                finished is a passage you cannot read.
              </p>

              {pool.length < 10 ? (
                <p className="notice">
                  Only {pool.length} learned so far. Mark some in the Library — ten is enough for a first
                  passage, a hundred makes a good one.
                </p>
              ) : (
                <label className="field">
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span>How many of them</span>
                    <b>{plan.basis.length}</b>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={pool.length}
                    value={Math.min(plan.basisCount, pool.length)}
                    onChange={(e) => setBasis(Number(e.target.value))}
                  />
                  <span className="tiny muted">
                    The {plan.basis.length} most common of the {pool.length}. Fewer reads more simply; more
                    reads more like real Chinese.
                  </span>
                </label>
              )}

              <div className="subtle-rule" style={{ margin: 0 }} />

              <div>
                <h3 className="field-title" style={{ marginTop: 0 }}>
                  What it is asked for
                </h3>
                <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                  {specs.length} passage{specs.length === 1 ? '' : 's'}, and about <b>{budget}</b> new character
                  {budget === 1 ? '' : 's'} between them — which ones is Claude's decision, made while it writes.
                  You find out when the answer comes back, and they go straight onto practice sheets.
                </p>
                {met.length > 0 && (
                  <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                    It is also told the {met.length} character{met.length === 1 ? '' : 's'} your earlier texts
                    taught: fair to reuse, but they will not be taught to you twice.
                  </p>
                )}
              </div>

              <div className="subtle-rule" style={{ margin: 0 }} />

              <label className="field">
                <span>Also let it use</span>
                <input
                  type="text"
                  value={plan.supplement}
                  placeholder="Characters you are studying now — 咖啡茶"
                  onChange={(e) => patchPlan({ supplement: e.target.value })}
                />
                <span className="tiny muted">
                  {hanziIn(plan.supplement).length
                    ? `${hanziIn(plan.supplement).length} more it may treat as known — never reported as new.`
                    : 'Treated as known, beside the ones you have marked learned.'}
                </span>
              </label>
              {collections.length > 0 && (
                <select
                  aria-label="Fill from a collection"
                  value=""
                  onChange={(e) => {
                    const c = collections.find((x) => x.id === e.target.value);
                    if (!c) return;
                    const chars = hanziIn(plan.supplement + c.items.join(''));
                    patchPlan({ supplement: chars.join('') });
                  }}
                >
                  <option value="">Add a collection’s characters…</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.items.length})
                    </option>
                  ))}
                </select>
              )}

              <label className="field">
                Script
                <select
                  value={plan.script}
                  onChange={(e) => patchPlan({ script: e.target.value === 'both' ? 'both' : 'simplified' })}
                >
                  <option value="simplified">Simplified</option>
                  <option value="both">Simplified, with traditional alongside</option>
                </select>
                <span className="tiny muted">
                  The reading is always checked in simplified; traditional is a switch on the reader.
                </span>
              </label>

              {sets.length > 0 && (
                <label className="field">
                  Where it lands
                  <select value={plan.setId ?? ''} onChange={(e) => patchPlan({ setId: e.target.value || null })}>
                    <option value="">A new collection</option>
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        Add to “{s.name}”
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <footer className="card-foot">
              <span className="tiny muted">Step 1 of 3</span>
              <div className="spacer" />
              <button className="btn primary" disabled={!canGo} onClick={() => go('prompt')}>
                Build the prompt →
              </button>
            </footer>
          </div>
        </div>
      )}

      {step === 'prompt' && <PromptStep plan={plan} onBack={() => go('plan')} onNext={() => go('paste')} />}

      {step === 'paste' && (
        <ImportStep
          plan={plan}
          onBack={() => go('prompt')}
          onDone={(textId) => navigate(paths.text(textId), { replace: true, flushSync: true })}
        />
      )}
    </section>
  );
}
