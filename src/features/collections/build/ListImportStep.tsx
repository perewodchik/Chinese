import { useMemo, useState } from 'react';
import type { CollectionWord } from '../../../domain/collection';
import { charId } from '../../../domain/ids';
import { charsOfWords, checkedBand, emptyListPlan, parseWordList, type WordListPlan } from '../../../domain/wordlist';
import { createCollection, discardListPlan, patchListPlan } from '../../../store/commands';
import { useStore } from '../../../store/store';
import { Glyph } from '../../../ui/Glyph';
import { Seg } from '../../../ui/Seg';
import { useToast } from '../../../ui/toast';
import { useLibrary } from '../../shared/library';
import { WordCard } from '../WordCard';

interface Props {
  plan: WordListPlan;
  onBack: () => void;
  /** where to go once the collection exists, which is before the list closes */
  onDone: (collectionId: string) => void;
}

type Practise = 'new' | 'all';

/**
 * Bringing the words home.
 *
 * Every word is shown as it will be kept, with its band checked against the
 * syllabus where the library knows it, and any of them can be left behind.
 * What gets saved is a collection: the characters to write, and the words
 * beside them.
 */
export function ListImportStep({ plan, onBack, onDone }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const learned = useStore((s) => s.learned);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [practise, setPractise] = useState<Practise>('new');

  const parsed = useMemo(() => parseWordList(plan.response), [plan.response]);
  const { list } = parsed;
  const keeping = list.words.filter((w) => !skipped.has(w.w));

  const chars = charsOfWords(keeping);
  const fresh = chars.filter((c) => !learned.has(charId(c)));
  const items = (practise === 'new' ? fresh : chars).map(charId);

  const named = plan.name.trim() && plan.name !== emptyListPlan('', 0).name;
  const name = named
    ? plan.name.trim()
    : [list.title, list.titleZh].filter(Boolean).join(' · ') || plan.request.trim().slice(0, 60) || 'Word list';

  function toggle(w: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }

  function save() {
    if (!keeping.length) return;
    // The band the syllabus gives is the one kept, where there is one.
    const words: CollectionWord[] = keeping.map((w) => ({ ...w, hsk: checkedBand(lib, w).hsk }));
    const c = createCollection({
      name,
      items,
      words,
      note: list.note,
      brief: plan.request.trim(),
    });
    toast(`“${c.name}” — ${words.length} words, ${items.length} characters to write`);
    onDone(c.id);
    discardListPlan();
  }

  return (
    <div className="split studio-split">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card">
          <header>
            <h2>Paste Claude’s reply</h2>
            <div className="spacer" />
            {plan.response && (
              <button className="btn ghost sm" onClick={() => patchListPlan({ response: '' })}>
                Clear
              </button>
            )}
          </header>
          <div className="body">
            <textarea
              className="paste-box"
              value={plan.response}
              spellCheck={false}
              placeholder="Paste the whole reply — the JSON block, and anything Claude said around it. If it came in two messages, paste them one after the other."
              onChange={(e) => patchListPlan({ response: e.target.value })}
            />
            {plan.response.trim() && (
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                {parsed.route === 'clean' && `Read cleanly — ${list.words.length} words.`}
                {parsed.route === 'repaired' &&
                  `Read after tidying a few things — ${list.words.length} words. Worth a glance below.`}
                {parsed.route === 'salvaged' && `${list.words.length} words pulled out one at a time.`}
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

        {list.note && <p className="notice teacher" style={{ margin: 0 }}>{list.note}</p>}

        {list.words.map((w) => (
          <WordCard
            key={w.w}
            word={w}
            dimmed={skipped.has(w.w)}
            action={
              <label className="toggle" style={{ padding: 0 }} title="Keep this word">
                <input type="checkbox" checked={!skipped.has(w.w)} onChange={() => toggle(w.w)} />
                <span />
              </label>
            }
          />
        ))}
      </div>

      <div className="card side">
        <header>
          <h2>Ready to save</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 14 }}>
          <div className="summary row">
            <span className="summary-n">{keeping.length}</span>
            <span className="small">
              word{keeping.length === 1 ? '' : 's'} into
              <br />
              <b>{name}</b>
            </span>
          </div>

          <div className="field">
            Characters to practise writing
            <Seg
              size="sm"
              label="Characters to practise writing"
              value={practise}
              onChange={setPractise}
              options={[
                { id: 'new', label: `Only new (${fresh.length})` },
                { id: 'all', label: `All (${chars.length})` },
              ]}
            />
          </div>

          {items.length ? (
            <div className="teach-chips">
              {items.map((id) => {
                const c = id.slice(1);
                return (
                  <span key={id} className="teach-chip mini" title={lib.byChar.get(c)?.def ?? ''}>
                    <Glyph char={c} strokes={lib.strokes} size={22} />
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="tiny muted" style={{ margin: 0 }}>
              {keeping.length
                ? 'You have learned every character in these words already. The words are still kept, with nothing to write.'
                : 'None yet — paste an answer and they appear here.'}
            </p>
          )}

          <p className="tiny muted" style={{ margin: 0 }}>
            The characters go into a new collection, ready for practice sheets. The words, their explanations and
            examples are kept with it, under Words.
          </p>
        </div>
        <footer className="card-foot">
          <button className="btn ghost sm" onClick={onBack}>
            ← Prompt
          </button>
          <div className="spacer" />
          <button className="btn primary" disabled={!keeping.length} onClick={save}>
            Save collection
          </button>
        </footer>
      </div>
    </div>
  );
}
