import { useEffect } from 'react';
import { Link } from 'react-router';
import type { RadicalForm } from '../../data/radicals';
import type { StrokeMap } from '../../data/types';
import { ordinal, POSITION_PHRASE } from '../../domain/radicals/forms';
import { paths } from '../../navigation/paths';
import { AnimatedGlyph, Glyph } from '../../ui/Glyph';
import { useRadicalLibrary } from './radicalData';

interface Props {
  n: number;
  onClose: () => void;
}

/**
 * Everything about one radical: what it means, what it is called, every way it
 * is written, and what each of those ways turns up in.
 *
 * The forms are the point. A radical is not one shape — 心 is 忄 beside 快, 心
 * under 想 and ⺗ under 恭 — and until they are laid out side by side, with the
 * characters each is actually used in, they look like three unrelated things.
 *
 * Nothing here can be ticked, queued or scheduled. A radical is not a thing
 * you learn and are then tested on; it is a thing you look up, the way you
 * look up what a prefix means, and it stops being interesting the moment you
 * can see it inside a character. So this is a reference page and only that —
 * no "mark as known", no collection to add it to, and nothing that a review
 * could ever ask you about.
 */
export function RadicalDrawer({ n, onClose }: Props) {
  const rlib = useRadicalLibrary();
  const r = rlib.byNumber.get(n) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="drawer" onClick={onClose}>
      <div />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={r ? `Radical ${r.r}` : 'Not found'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost sm close" onClick={onClose}>
            ✕ Close
          </button>
          <span className="tiny muted">For reference — radicals are not learned or reviewed</span>
        </div>

        {!r ? (
          <div className="empty">
            <span className="big">空</span>
            There are 214 radicals, and none of them is number {n}.
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: 22, alignItems: 'flex-start', margin: '16px 0 6px' }}>
              <AnimatedGlyph char={r.forms[0].k} strokes={rlib.strokes} size={104} fit fallback={r.r} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 22, color: 'var(--accent)' }}>{r.py}</span>
                  {r.word !== r.r && (
                    <span className="hanzi" style={{ fontSize: 20 }} title="the character it is named after">
                      {r.word}
                    </span>
                  )}
                </div>
                <h1 style={{ fontSize: 17, marginTop: 4 }}>{r.mean}</h1>
                {r.forms[0].name && (
                  <div className="small muted">
                    <span className="hanzi" style={{ fontSize: 15 }}>
                      {r.forms[0].name}
                    </span>{' '}
                    {r.forms[0].namePy}
                  </div>
                )}
                {r.about && <p className="small" style={{ margin: '8px 0 0' }}>{r.about}</p>}
              </div>
            </div>

            {r.note && (
              <div className="hint" style={{ marginTop: 10 }}>
                {r.note}
              </div>
            )}

            <div className="subtle-rule" />

            <dl className="kv">
              <dt>Kangxi no.</dt>
              <dd>
                #{r.n} · {ordinal(r.rank)} most used
              </dd>
              <dt>Written</dt>
              <dd>
                {r.forms.length === 1 ? 'one way' : `${r.forms.length} ways`}
                {r.kangxi !== r.r && (
                  <span className="muted small">
                    {' '}
                    · the Kangxi form is <span className="hanzi">{r.kangxi}</span>
                  </span>
                )}
              </dd>
              <dt>Used in</dt>
              <dd>
                {r.syllabus} of the 3000 characters{' '}
                <span className="muted small">· {r.count} in all</span>
              </dd>
            </dl>
            <Link className="btn sm" to={paths.family(r.n)} style={{ marginTop: 10 }}>
              See its family tree
            </Link>

            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 10px' }}>
              How it is written{' '}
              <span className="tiny muted" style={{ fontWeight: 400 }}>
                {r.forms.length > 1
                  ? 'the same radical, in each of its shapes'
                  : 'one shape, wherever it turns up'}
              </span>
            </h2>
            {r.forms.map((form) => (
              <FormPanel
                key={form.k}
                form={form}
                strokes={rlib.strokes}
                solo={r.forms.length === 1}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** One way of writing the radical: where it goes, how it is drawn, what it turns up in. */
function FormPanel({
  form,
  strokes,
  solo,
}: {
  form: RadicalForm;
  strokes: StrokeMap;
  /** the radical is written only this way, so where it goes needs no saying */
  solo: boolean;
}) {
  return (
    <section className="form-panel">
      <div className="form-head">
        {/* Drawn where it sits inside a character, so the square says "left" as
            plainly as the label does. */}
        <Glyph char={form.k} strokes={strokes} size={56} guide fallback={form.g} />
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 7 }}>
            <b className="hanzi" style={{ fontSize: 17 }}>
              {form.g}
            </b>
            {(!solo || form.pos !== 'alone') && (
              <span className="small">{POSITION_PHRASE[form.pos]}</span>
            )}
            <span className="tiny muted">
              {form.sc} stroke{form.sc === 1 ? '' : 's'}
            </span>
          </div>
          {form.name && (
            <div className="small muted">
              <span className="hanzi" style={{ fontSize: 14 }}>
                {form.name}
              </span>{' '}
              {form.namePy}
            </div>
          )}
          {form.tip && <p className="tiny" style={{ margin: '4px 0 0' }}>{form.tip}</p>}
        </div>
      </div>

      <div className="strokerow" style={{ marginTop: 8 }}>
        {Array.from({ length: form.sc }, (_, i) => (
          <div key={i} className="box">
            <Glyph
              char={form.k}
              strokes={strokes}
              size={36}
              upto={i + 1}
              fit
              color="var(--line-2)"
              highlight="var(--accent)"
            />
          </div>
        ))}
      </div>

      {form.ex.length > 0 && (
        <div className="radical-examples">
          {form.ex.map((e) => (
            <span key={e.c} className="radical-example">
              <b className="hanzi">{e.c}</b>
              <i>{e.py}</i>
              <span>{e.d}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
