import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { DEFAULT_NARRATOR, narratorRecordingId, type NarratorVoice } from '../../../shared/narration';
import { narrateLine, narrationStatus, narratorVoices } from '../../api/narration';
import { talkRecorded } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { voiceRecorded, type Reading } from './readAloud';

const STORED = 'hanzi.narrator';
const storedNarrator = () => {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
};

/** A voice's name without the gender MiniMax writes into it; the description says it. */
const plainName = (name: string) => name.replace(/\s*\((?:Female|Male)\)\s*/i, '');

/**
 * A natural voice for the text, under Listen's voices: a quiet button that
 * opens a panel, so the player stays the thing on the screen. There a narrator
 * is chosen from MiniMax's Mandarin voices and the text recorded a sentence at
 * a time with the learner's own key (Settings); a sentence already recorded in
 * that voice is not read again, as it costs money. Once done, the voice is
 * among the voices above and reads the text.
 */
export function Narrate({ spoken, reading }: { spoken: string[]; reading: Reading }) {
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<NarratorVoice[] | null>(null);
  const [voice, setVoice] = useState<string>(() => storedNarrator() ?? DEFAULT_NARRATOR);
  const [recorded, setRecorded] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const lines = [...new Set(spoken.map((l) => l.trim()).filter(Boolean))];

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
    if (!hasKey || voices) return;
    let live = true;
    narratorVoices().then(
      (v) => live && setVoices(v),
      (err: Error) => live && setMessage(err.message),
    );
    return () => {
      live = false;
    };
  }, [hasKey, voices]);

  // How much of the text the chosen narrator has recorded already.
  useEffect(() => {
    if (!open || !hasKey) return;
    let live = true;
    void talkRecorded(narratorRecordingId(voice), lines).then(
      ({ have }) => live && setRecorded(have.filter(Boolean).length),
      () => live && setRecorded(null),
    );
    return () => {
      live = false;
    };
    // lines is derived from spoken
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasKey, voice, spoken]);

  // Once the new recordings are offered above, read with them.
  useEffect(() => {
    if (!made) return;
    const choice = reading.choices.find((c) => c.key === made);
    if (choice) {
      if (!choice.active) choice.pick();
      setMade(null);
    }
  }, [made, reading.choices]);

  const choose = (id: string) => {
    setVoice(id);
    setMessage(null);
    try {
      localStorage.setItem(STORED, id);
    } catch {
      // forgotten between visits, that is all
    }
  };

  async function record() {
    setMessage(null);
    const id = narratorRecordingId(voice);
    try {
      const { have } = await talkRecorded(id, lines);
      const todo = lines.filter((_, i) => !have[i]);
      setProgress({ done: 0, total: todo.length });
      for (const [i, line] of todo.entries()) {
        await narrateLine(voice, line);
        setProgress({ done: i + 1, total: todo.length });
      }
      setRecorded(lines.length);
      voiceRecorded(id);
      setMade(id);
      setMessage(todo.length ? 'Done. Play reads the text in this voice now.' : 'This text is already recorded in this voice.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
      void talkRecorded(id, lines).then(({ have }) => setRecorded(have.filter(Boolean).length), () => undefined);
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const chosen = voices?.find((v) => v.id === voice);
  const all = recorded !== null && recorded >= lines.length;
  const fill = busy ? progress.done / (progress.total || 1) : recorded !== null ? recorded / (lines.length || 1) : 0;
  const label = busy
    ? `Recording ${progress.done} of ${progress.total}…`
    : all
      ? 'Recorded'
      : recorded
        ? `Record the other ${lines.length - recorded}`
        : 'Record this text';

  return (
    <div className="rd-natural">
      <button className="btn quiet sm rd-natural-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'chevron' : 'plus'} size={16} />
        {busy ? `Recording in a natural voice, ${progress.done} of ${progress.total}` : 'A natural voice for this text'}
      </button>
      {open && (
        <div className="rd-natural-panel">
          {hasKey === false ? (
            <p className="small" style={{ margin: 0 }}>
              MiniMax reads texts in natural Mandarin voices with your own API key. Add it in{' '}
              <Link to={paths.settings()}>Settings › Natural voice</Link>, then come back here.
            </p>
          ) : (
            <>
              <div className="rd-natural-row">
                <label className="rd-natural-pick">
                  <span className="tiny muted">Narrator</span>
                  <select value={chosen ? voice : ''} onChange={(e) => choose(e.target.value)} disabled={!voices || busy}>
                    {!chosen && <option value="">{voices ? 'Choose a voice' : 'Loading the voices…'}</option>}
                    {(voices ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {plainName(v.name)} · {v.gender === 'male' ? 'man' : 'woman'}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn tonal sm rd-natural-go" onClick={() => void record()} disabled={!chosen || busy || all}>
                  {label}
                </button>
              </div>
              <div className="rd-natural-bar" style={{ '--fill': `${Math.round(fill * 100)}%` } as CSSProperties} aria-hidden />
              <p className="tiny muted rd-natural-msg">
                {message ??
                  (chosen
                    ? `${chosen.description || plainName(chosen.name)}${recorded !== null ? ` · ${recorded} of ${lines.length} sentences recorded` : ''}`
                    : 'Each sentence is read once, with your key, and kept for every device.')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
