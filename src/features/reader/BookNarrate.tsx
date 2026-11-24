import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import { chooseNarrator, chosenNarrator, listNarrators, narrationOf, narrationStatus } from '../../api/narration';
import type { GeneratedText } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';

type Phase =
  | { at: 'loading' }
  | { at: 'none' } // no key, or no narrator made yet
  | { at: 'checking' }
  | { at: 'ready'; left: number }
  | { at: 'busy'; done: number; of: number }
  | { at: 'failed'; left: number; message: string };

/**
 * One row under Continue: a narrator, and a button that has them read every
 * text in the book that they have not read yet.
 *
 * A text this narrator has already read is never read again: the button
 * counts only the rest ("Narrate 6 chapters"), and once there are none it is
 * greyed: "All chapters narrated". While it works the button is a bar,
 * "Narrating 2 of 6…", and the narrator cannot be changed. A failure keeps
 * what was made, says why, and the button offers the rest again.
 *
 * States: loading; no MiniMax key or no narrator (a quiet link to Voices);
 * checking which are read; some left; none left; working; failed part way;
 * leaving the page while it works (the loop stops after the text in hand).
 */
export function BookNarrate({ texts, story }: { texts: GeneratedText[]; story: boolean }) {
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [narratorId, setNarratorId] = useState<string | null>(chosenNarrator);
  const [phase, setPhase] = useState<Phase>({ at: 'loading' });
  const [left, setLeft] = useState<GeneratedText[]>([]);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const narrator = narrators?.find((n) => n.id === narratorId) ?? narrators?.[0] ?? null;
  const linesOf = useMemo(() => new Map(texts.map((t) => [t.id, t.lines.map((l) => l.zh)])), [texts]);
  const unit = story ? 'chapter' : 'text';

  useEffect(() => {
    narrationStatus()
      .then((s) => (s.key.set ? listNarrators() : []))
      .then(
        (list) => {
          if (!live.current) return;
          setNarrators(list);
          if (!list.length) setPhase({ at: 'none' });
        },
        () => live.current && setPhase({ at: 'none' }),
      );
  }, []);

  // Which texts this narrator has not read yet.
  useEffect(() => {
    if (!narrator) return;
    let here = true;
    setPhase({ at: 'checking' });
    Promise.all(texts.map((t) => narrationOf(narrator.id, linesOf.get(t.id)!).then((n) => (n ? null : t)))).then(
      (out) => {
        if (!here) return;
        const rest = out.filter((t): t is GeneratedText => t !== null);
        setLeft(rest);
        setPhase({ at: 'ready', left: rest.length });
      },
      () => here && setPhase({ at: 'ready', left: texts.length }),
    );
    return () => {
      here = false;
    };
  }, [narrator, texts, linesOf]);

  async function narrateAll() {
    if (!narrator) return;
    const todo = left;
    let done = 0;
    setPhase({ at: 'busy', done, of: todo.length });
    for (const t of todo) {
      if (!live.current) return;
      try {
        await narrationOf(narrator.id, linesOf.get(t.id)!, { generate: true });
      } catch (err) {
        if (!live.current) return;
        const rest = todo.slice(done);
        setLeft(rest);
        setPhase({ at: 'failed', left: rest.length, message: err instanceof Error ? err.message : 'MiniMax did not answer.' });
        return;
      }
      done += 1;
      if (live.current) setPhase({ at: 'busy', done, of: todo.length });
    }
    if (!live.current) return;
    setLeft([]);
    setPhase({ at: 'ready', left: 0 });
  }

  if (phase.at === 'none')
    return (
      <p className="book-narrate book-narrate-none small muted">
        <Icon name="sound" size={18} />
        <span>
          To have the whole book read aloud, make a narrator in <Link to={paths.speakingNarrators()}>Speaking › Voices</Link>.
        </span>
      </p>
    );

  const busy = phase.at === 'busy';
  const n = phase.at === 'ready' || phase.at === 'failed' ? phase.left : 0;
  const label =
    phase.at === 'loading' || phase.at === 'checking'
      ? 'Checking…'
      : busy
        ? `Narrating ${Math.min(phase.done + 1, phase.of)} of ${phase.of}…`
        : n
          ? `Narrate ${n} ${unit}${n === 1 ? '' : 's'}`
          : `All ${unit}s narrated`;
  return (
    <div className="book-narrate">
      <Icon name="sound" size={18} />
      <select
        aria-label="Narrator"
        value={narrator?.id ?? ''}
        disabled={!narrators || busy}
        onChange={(e) => {
          setNarratorId(e.target.value);
          chooseNarrator(e.target.value);
        }}
      >
        {!narrators && <option value="">Narrator</option>}
        {(narrators ?? []).map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <button className="book-narrate-go" disabled={busy || !n} data-busy={busy || undefined} onClick={() => void narrateAll()}>
        {busy && <i style={{ width: `${(phase.done / phase.of) * 100}%` }} />}
        <span>{label}</span>
      </button>
      {phase.at === 'failed' && <p className="book-narrate-error small">{phase.message}</p>}
    </div>
  );
}
