import { useMemo, useState } from 'react';
import { charId } from '../../domain/ids';
import { sortByLibrary } from '../../domain/library';
import { matchToSpecs, parseResponse, toText } from '../../domain/parse';
import {
  coverageOf,
  lengthLabel,
  hanziIn,
  levelLabel,
  sentenceRange,
  textCharCount,
  type TextPlan,
} from '../../domain/text';
import { addTexts, createCollection, discardPlan, patchPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';

interface Props {
  plan: TextPlan;
  onBack: () => void;
  /** where to go once the texts are saved, which is before the session closes */
  onDone: (textId: string) => void;
}

/**
 * Bringing the answer home.
 *
 * The paste is checked rather than trusted, and checked against something the
 * model never saw twice: the inventory. Every passage gets a coverage figure,
 * every character that should not be there is named, and anything that looks
 * wrong can be left behind without abandoning the rest. That check is the one
 * piece of work a reader cannot do for himself — noticing the character he
 * does not know is exactly what he cannot do.
 */
export function ImportStep({ plan, onBack, onDone }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const modelName = useStore((s) => s.settings.modelName);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [collect, setCollect] = useState(true);

  const known = useMemo(
    () => new Set([...plan.basis, ...plan.met, ...hanziIn(plan.supplement)]),
    [plan.basis, plan.met, plan.supplement],
  );
  const parsed = useMemo(() => parseResponse(plan.response), [plan.response]);
  const reviews = useMemo(() => {
    const matches = matchToSpecs(parsed.drafts, plan.specs);
    return matches.map((m) => {
      const text = toText(m, plan, modelName);
      return { match: m, text, cover: coverageOf(text, known) };
    });
  }, [parsed.drafts, plan, known, modelName]);

  const keeping = reviews.filter((_, i) => !skipped.has(i));
  const newChars = [...new Set(keeping.flatMap((r) => r.text.teach))];

  function toggle(i: number) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function save() {
    if (!keeping.length) return;
    const { set, texts } = addTexts(
      keeping.map((r) => r.text),
      { setId: plan.setId, name: plan.name },
    );
    let extra = '';
    if (collect && newChars.length) {
      const c = createCollection({
        name: `New from “${set.name}”`,
        items: sortByLibrary(lib, newChars.map(charId)),
      });
      extra = ` · ${c.items.length} characters queued in Collections`;
    }
    toast(`Saved ${texts.length} texts into “${set.name}”${extra}`);
    // To the first of them before the session closes: with the session gone
    // there would be no page left here to stand on.
    onDone(texts[0].id);
    discardPlan();
  }

  return (
    <div className="split studio-split">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card">
          <header>
            <h2>Paste Claude’s reply</h2>
            <div className="spacer" />
            {plan.response && (
              <button className="btn ghost sm" onClick={() => patchPlan({ response: '' })}>
                Clear
              </button>
            )}
          </header>
          <div className="body">
            <textarea
              className="paste-box"
              value={plan.response}
              spellCheck={false}
              placeholder="Paste the whole reply — the JSON block, and anything Claude said around it. If the answer came in two messages, paste them one after the other."
              onChange={(e) => patchPlan({ response: e.target.value })}
            />
            {plan.response.trim() && (
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                {parsed.route === 'clean' && 'Read cleanly.'}
                {parsed.route === 'repaired' &&
                  'Read after tidying a few things — a trailing comma or a stray newline. Worth a glance below.'}
                {parsed.route === 'salvaged' &&
                  'The reply was not valid JSON, so the passages were pulled out one at a time.'}
                {parsed.route === 'none' && 'Nothing readable in there yet.'}
              </p>
            )}
            {parsed.problems.map((p) => (
              <p key={p} className="notice error" style={{ marginTop: 10 }}>
                {p}
              </p>
            ))}
          </div>
        </div>

        {reviews.map((r, i) => {
          const spec = r.match.spec;
          const [lo, hi] = sentenceRange(r.text.length);
          const short = r.text.lines.length < lo || r.text.lines.length > hi;
          const over = Boolean(spec) && r.text.teach.length > (spec?.newCount ?? 0) + 3;
          const gone = skipped.has(i);
          return (
            <article key={i} className={`review${gone ? ' skipped' : ''}`}>
              <header>
                <label className="toggle" style={{ padding: 0 }}>
                  <input type="checkbox" checked={!gone} onChange={() => toggle(i)} />
                  <span />
                </label>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b className="hanzi" style={{ fontSize: 17 }}>
                      {r.text.titleZh}
                    </b>
                    <span className="small muted">{r.text.title}</span>
                  </div>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    {spec ? `brief ${spec.id} · ${spec.topic || 'no topic'}` : 'no matching brief'} ·{' '}
                    {lengthLabel(r.text.length)}, {levelLabel(r.text.level)} · {r.text.lines.length} sentences ·{' '}
                    {textCharCount(r.text)} characters
                  </p>
                </div>
                <div className="spacer" />
                <span className={`pct${r.cover.ratio > 0.9 ? ' good' : ''}`}>{Math.round(r.cover.ratio * 100)}%</span>
              </header>

              <div className="review-body">
                <p className="passage-peek hanzi">{r.text.lines[0]?.zh}</p>

                <div className="review-facts">
                  <span className={`fact${over ? '' : ' good'}`}>
                    {r.text.teach.length} new character{r.text.teach.length === 1 ? '' : 's'}
                    {spec ? ` · asked for about ${spec.newCount}` : ''}
                  </span>
                  {short && (
                    <span className="fact warn">
                      asked for {lo}–{hi} sentences
                    </span>
                  )}
                  {r.text.questions.length > 0 && <span className="fact">{r.text.questions.length} questions</span>}
                  {r.text.grammar.length > 0 && <span className="fact">{r.text.grammar.length} grammar notes</span>}
                </div>

                {r.text.teach.length > 0 && (
                  <div className="teach-chips" style={{ marginTop: 10 }}>
                    {r.text.teach.map((c) => (
                      <span key={c} className="teach-chip" title={r.text.glosses[c]?.d ?? lib.byChar.get(c)?.def ?? ''}>
                        <Glyph char={c} strokes={lib.strokes} size={24} />
                        <i>{r.text.glosses[c]?.py ?? lib.byChar.get(c)?.py[0] ?? ''}</i>
                      </span>
                    ))}
                  </div>
                )}

                {over && (
                  <p className="notice" style={{ marginTop: 10 }}>
                    That is {r.text.teach.length - (spec?.newCount ?? 0)} more than this one was meant to teach.
                    Still readable, but it will be a longer evening — and all of them go onto the practice sheets.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="card side">
        <header>
          <h2>Ready to save</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 14 }}>
          <div className="summary row">
            <span className="summary-n">{keeping.length}</span>
            <span className="small">
              passage{keeping.length === 1 ? '' : 's'} into
              <br />
              <b>{plan.name}</b>
            </span>
          </div>

          <div>
            <h3 className="field-title" style={{ marginTop: 0 }}>
              New characters you will have met
            </h3>
            {newChars.length ? (
              <div className="teach-chips" style={{ marginTop: 6 }}>
                {newChars.map((c) => (
                  <span key={c} className="teach-chip mini">
                    <Glyph char={c} strokes={lib.strokes} size={22} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="tiny muted" style={{ margin: 0 }}>
                None yet — paste an answer and they appear here.
              </p>
            )}
          </div>

          <label className="toggle">
            <input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} />
            <span>
              Queue them for handwriting
              <span className="d">
                A collection of these {newChars.length || 0} characters, ready to print as practice sheets
              </span>
            </span>
          </label>

          {keeping.length > 0 && keeping.length < plan.specs.length && (
            <p className="notice">
              {plan.specs.length} passages were asked for and {keeping.length} are being saved. Saving closes the
              session — if the rest are still coming, paste them in above first.
            </p>
          )}
        </div>
        <footer className="card-foot">
          <button className="btn ghost sm" onClick={onBack}>
            ← Prompt
          </button>
          <div className="spacer" />
          <button className="btn primary" disabled={!keeping.length} onClick={save}>
            Save {keeping.length || ''} text{keeping.length === 1 ? '' : 's'}
          </button>
        </footer>
      </div>
    </div>
  );
}
