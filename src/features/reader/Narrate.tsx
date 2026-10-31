import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto, TextNarrationDto } from '../../../shared/narration';
import { chooseNarrator, chosenNarrator, listNarrators, narrationOf, narrationStatus } from '../../api/narration';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';

/**
 * A narrator for the text, under Listen's voices: a quiet button that opens a
 * panel, so the player stays the thing on the screen. There one of the
 * learner's narrators (made and tuned in Speaking › Voices) reads the whole
 * text in one go with their own key; the reading is kept, so it is never paid
 * for twice, and plays above with a slider.
 */
export function Narrate({ lines, onMade }: { lines: string[]; onMade: (n: TextNarrationDto, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [narratorId, setNarratorId] = useState<string | null>(chosenNarrator);
  const [kept, setKept] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  // Has the narrator, as it sounds now, read this text already?
  useEffect(() => {
    if (!narrator) return;
    let live = true;
    setKept(null);
    narrationOf(narrator.id, lines).then(
      (n) => live && setKept(n !== null),
      () => live && setKept(null),
    );
    return () => {
      live = false;
    };
  }, [narrator, lines]);

  async function read(again = false) {
    if (!narrator) return;
    setBusy(true);
    setMessage(null);
    try {
      const n = await narrationOf(narrator.id, lines, again ? { again: true } : { generate: true });
      if (!n) throw new Error('MiniMax sent nothing back.');
      setKept(true);
      onMade(n, narrator.name);
      setMessage(`${narrator.name} has read the text. It is kept: playing it costs nothing.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rd-natural">
      <button className="btn quiet sm rd-natural-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'chevron' : 'plus'} size={16} />
        {busy ? `${narrator?.name ?? 'A narrator'} is reading the text…` : 'A narrator for this text'}
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
                {kept ? (
                  <button className="btn quiet sm rd-natural-go" onClick={() => void read(true)} disabled={busy}>
                    {busy ? 'Reading…' : 'Read it again'}
                  </button>
                ) : (
                  <button className="btn tonal sm rd-natural-go" onClick={() => void read()} disabled={!narrator || busy || kept === null}>
                    {busy ? 'Reading… up to a minute' : 'Read the whole text'}
                  </button>
                )}
              </div>
              <p className="tiny muted rd-natural-msg">
                {message ??
                  (kept
                    ? `${narrator?.name} has read this text; it plays above. Read it again only after changing the voice.`
                    : 'One request for the whole text, kept on the server: it is paid for once. ')}
                {!message && !kept && <Link to={paths.speakingNarrators()}>Voices</Link>}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
