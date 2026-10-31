import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import { chooseNarrator, chosenNarrator, listNarrators, narrateLine, narrationStatus } from '../../api/narration';
import { talkRecorded } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { voiceRecorded, type Reading } from './readAloud';

/**
 * A narrator for the text, under Listen's voices: a quiet button that opens a
 * panel, so the player stays the thing on the screen. There one of the
 * learner's narrators (made and tuned in Speaking › Voices) reads the text a
 * sentence at a time with their own key; a sentence it has read already is
 * not read again, as it costs money. Once done, its voice is among the voices
 * above and reads the text.
 */
export function Narrate({ spoken, reading }: { spoken: string[]; reading: Reading }) {
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [narratorId, setNarratorId] = useState<string | null>(chosenNarrator);
  const [recorded, setRecorded] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const lines = [...new Set(spoken.map((l) => l.trim()).filter(Boolean))];
  const narrator = narrators?.find((n) => n.id === narratorId) ?? narrators?.[0] ?? null;

  // Asked only once the panel is opened: most visits to Listen never need MiniMax.
  useEffect(() => {
    if (!open || hasKey !== null) return;
    let live = true;
    narrationStatus().then(
      (s) => live && setHasKey(s.key.set),
      (err: Error) => {
        if (!live) return;
        setHasKey(false);
        setMessage(err.message);
      },
    );
    return () => {
      live = false;
    };
  }, [open, hasKey]);

  useEffect(() => {
    if (!hasKey || narrators) return;
    let live = true;
    listNarrators().then(
      (list) => live && setNarrators(list),
      (err: Error) => live && setMessage(err.message),
    );
    return () => {
      live = false;
    };
  }, [hasKey, narrators]);

  // How much of the text the narrator has read already.
  useEffect(() => {
    if (!narrator) return;
    let live = true;
    setRecorded(null);
    void talkRecorded(narrator.recordingId, lines).then(
      ({ have }) => live && setRecorded(have.filter(Boolean).length),
      () => live && setRecorded(null),
    );
    return () => {
      live = false;
    };
    // lines is derived from spoken
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrator?.recordingId, spoken]);

  // Once the new recordings are offered above, read with them.
  useEffect(() => {
    if (!made) return;
    const choice = reading.choices.find((c) => c.key === made);
    if (choice) {
      if (!choice.active) choice.pick();
      setMade(null);
    }
  }, [made, reading.choices]);

  async function record() {
    if (!narrator) return;
    setMessage(null);
    const id = narrator.recordingId;
    try {
      const { have } = await talkRecorded(id, lines);
      const todo = lines.filter((_, i) => !have[i]);
      setProgress({ done: 0, total: todo.length });
      for (const [i, line] of todo.entries()) {
        await narrateLine(narrator.id, line);
        setProgress({ done: i + 1, total: todo.length });
      }
      setRecorded(lines.length);
      voiceRecorded(id);
      setMade(id);
      setMessage(todo.length ? `Done. Play reads the text in ${narrator.name}’s voice now.` : `${narrator.name} has read this text already.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
      void talkRecorded(id, lines).then(({ have }) => setRecorded(have.filter(Boolean).length), () => undefined);
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const all = recorded !== null && recorded >= lines.length;
  const fill = busy ? progress.done / (progress.total || 1) : recorded !== null ? recorded / (lines.length || 1) : 0;
  const label = busy ? `Reading ${progress.done} of ${progress.total}…` : all ? 'Read' : recorded ? `Read the other ${lines.length - recorded}` : 'Read this text';

  return (
    <div className="rd-natural">
      <button className="btn quiet sm rd-natural-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'chevron' : 'plus'} size={16} />
        {busy ? `${narrator?.name ?? 'A narrator'} is reading, ${progress.done} of ${progress.total}` : 'A narrator for this text'}
      </button>
      {open && (
        <div className="rd-natural-panel">
          {hasKey === false ? (
            <p className="small" style={{ margin: 0 }}>
              Narrators read texts in natural Mandarin voices with your own MiniMax key. Add the key and make a narrator in{' '}
              <Link to={paths.speakingNarrators()}>Speaking › Voices</Link>.
            </p>
          ) : narrators && narrators.length === 0 ? (
            <p className="small" style={{ margin: 0 }}>
              No narrators yet. <Link to={paths.speakingNarrators()}>Make one in Speaking › Voices</Link>: describe the voice you want.
            </p>
          ) : (
            <>
              <div className="rd-natural-row">
                <label className="rd-natural-pick">
                  <span className="tiny muted">Narrator</span>
                  <select
                    value={narrator?.id ?? ''}
                    onChange={(e) => {
                      setNarratorId(e.target.value);
                      chooseNarrator(e.target.value);
                      setMessage(null);
                    }}
                    disabled={!narrators || busy}
                  >
                    {!narrators && <option value="">Loading…</option>}
                    {(narrators ?? []).map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn tonal sm rd-natural-go" onClick={() => void record()} disabled={!narrator || busy || all}>
                  {label}
                </button>
              </div>
              <div className="rd-natural-bar" style={{ '--fill': `${Math.round(fill * 100)}%` } as CSSProperties} aria-hidden />
              <p className="tiny muted rd-natural-msg">
                {message ??
                  (narrator && recorded !== null ? `${recorded} of ${lines.length} sentences read by ${narrator.name}. ` : '')}
                <Link to={paths.speakingNarrators()}>Voices</Link>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
