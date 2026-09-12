import { useId } from 'react';
import {
  FOCUS_IDEAS,
  GENRES,
  LENGTHS,
  LEVELS,
  type Genre,
  type TextSpec,
} from '../../domain/text';
import { Seg } from '../../ui/Seg';

interface Props {
  spec: TextSpec;
  index: number;
  onChange: (p: Partial<TextSpec>) => void;
  /** a topic no other passage in the session has taken */
  onRollTopic: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

const NEW_MAX = 15;

/**
 * One passage, as an order form.
 *
 * Five decisions, all visible at once rather than folded behind a dropdown.
 * The one that used to be two — how hard the sentences are, and how rare the
 * words — is a single dial now, because it was always one question: how far
 * past what I can already read should this go.
 *
 * What it does not ask is *which* characters to teach. That is a number here
 * and a decision over there, where the story is being written.
 */
export function SpecCard({
  spec,
  index,
  onChange,
  onRollTopic,
  onDuplicate,
  onRemove,
  canRemove,
}: Props) {
  const listId = useId();
  const level = LEVELS.find((l) => l.id === spec.level);

  return (
    <article className="spec">
      <header>
        <span className="n">{index + 1}</span>
        <input
          className="spec-topic"
          type="text"
          value={spec.topic}
          placeholder="What is it about?"
          onChange={(e) => onChange({ topic: e.target.value })}
        />
        <button
          className="btn ghost sm"
          title="Pick a topic for me"
          aria-label="Pick a topic for me"
          onClick={onRollTopic}
        >
          ⚄
        </button>
        <button className="btn ghost sm" title="Duplicate this one" onClick={onDuplicate}>
          ⧉
        </button>
        <button
          className="btn ghost sm"
          title="Remove this one"
          onClick={onRemove}
          disabled={!canRemove}
        >
          ✕
        </button>
      </header>

      <div className="spec-body">
        <div className="spec-row">
          <span className="spec-label">Length</span>
          <Seg
            size="sm"
            label="Length"
            value={spec.length}
            onChange={(length) => onChange({ length })}
            options={LENGTHS.map((l) => ({
              id: l.id,
              label: l.label,
              title: l.sentences,
            }))}
          />
        </div>

        <div className="spec-row">
          <span className="spec-label">Form</span>
          <select
            value={spec.genre}
            onChange={(e) => onChange({ genre: e.target.value as Genre })}
          >
            {GENRES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <label className="toggle" style={{ padding: 0, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={spec.questions}
              onChange={(e) => onChange({ questions: e.target.checked })}
            />
            <span>Questions</span>
          </label>
        </div>

        <div className="spec-teach">
          <div className="row" style={{ gap: 8 }}>
            <span className="spec-label">Level</span>
            <span className="tiny muted">{level?.blurb}</span>
          </div>
          <Seg
            size="sm"
            label="How far past me it goes"
            value={spec.level}
            onChange={(l) => onChange({ level: l })}
            options={LEVELS.map((l) => ({ id: l.id, label: l.label, title: l.blurb }))}
          />

          <div className="row" style={{ gap: 8 }}>
            <span className="spec-label">Teach me</span>
            <div className="stepper">
              <button
                onClick={() => onChange({ newCount: Math.max(0, spec.newCount - 1) })}
                disabled={spec.newCount === 0}
                aria-label="One fewer new character"
              >
                −
              </button>
              <b>{spec.newCount}</b>
              <button
                onClick={() => onChange({ newCount: Math.min(NEW_MAX, spec.newCount + 1) })}
                disabled={spec.newCount >= NEW_MAX}
                aria-label="One more new character"
              >
                +
              </button>
            </div>
            <span className="tiny muted">
              {spec.newCount === 0
                ? 'nothing new — stay inside what I know'
                : 'new characters — Claude picks which'}
            </span>
          </div>
        </div>

        <label className="field">
          <span className="spec-label">Grammar to show off — optional</span>
          <input
            type="text"
            list={listId}
            value={spec.focus}
            placeholder="e.g. 了 for a completed action"
            onChange={(e) => onChange({ focus: e.target.value })}
          />
          <datalist id={listId}>
            {FOCUS_IDEAS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
      </div>
    </article>
  );
}
