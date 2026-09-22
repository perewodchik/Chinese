import { includeList } from '../../domain/prompt';
import {
  GENRES,
  HSK_BANDS,
  LENGTHS,
  LEVELS,
  STRUCTURES,
  VOCAB_MODES,
  hskLabel,
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
 * Four decisions, all visible at once rather than folded behind a dropdown.
 * The one that used to be two — how hard the sentences are, and how rare the
 * words — is a single dial now, because it was always one question: how far
 * past what I can already read should this go.
 *
 * What it does not ask is *which* characters to teach. That is a number here
 * and a decision over there, where the story is being written. Nor does it
 * ask for a grammar point any more: a box wanting one line of grammar out of
 * a list of ten was a narrower question than the topic box next to it, which
 * already takes "a phone call where 把 keeps coming up" and does more with it.
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

        <div className="spec-row">
          <span className="spec-label">Shape</span>
          <Seg
            size="sm"
            label="Shape"
            value={spec.structure}
            onChange={(structure) => onChange({ structure })}
            options={STRUCTURES.map((x) => ({ id: x.id, label: x.label, title: x.brief }))}
          />
        </div>

        <div className="spec-row">
          <span className="spec-label">Band</span>
          <select
            value={spec.hsk}
            aria-label="Vocabulary band"
            onChange={(e) => {
              const hsk = Number(e.target.value);
              onChange({ hsk, ceiling: Math.max(hsk, spec.ceiling) });
            }}
          >
            {HSK_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
            stretch to
          </span>
          <select
            value={Math.max(spec.hsk, spec.ceiling)}
            aria-label="Highest band a stretch word may come from"
            onChange={(e) => onChange({ ceiling: Number(e.target.value) })}
          >
            {HSK_BANDS.filter((b) => b.id >= spec.hsk).map((b) => (
              <option key={b.id} value={b.id}>
                {b.id === spec.hsk ? 'no further' : b.label}
              </option>
            ))}
          </select>
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
                : `about this many new — a target, not a cap; ${hskLabel(spec.hsk)} words are fair game`}
            </span>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="spec-label">Words</span>
            <Seg
              size="sm"
              label="How the word list is used"
              value={spec.vocabMode}
              onChange={(vocabMode) => onChange({ vocabMode })}
              options={VOCAB_MODES.map((m) => ({ id: m.id, label: m.label, title: m.blurb }))}
            />
          </div>
          <input
            type="text"
            className="spec-include"
            value={spec.include}
            placeholder={
              spec.vocabMode === 'strict'
                ? 'Words it must use — 咖啡、公园、已经'
                : 'Words it could use, if they fit (optional)'
            }
            onChange={(e) => onChange({ include: e.target.value })}
          />
          {spec.vocabMode === 'strict' && includeList(spec).length === 0 && (
            <span className="tiny muted">Put the words to include above — without any, this is the same as a target.</span>
          )}
        </div>

      </div>
    </article>
  );
}
