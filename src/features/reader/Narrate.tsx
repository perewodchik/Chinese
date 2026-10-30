import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { DEFAULT_NARRATOR, narratorRecordingId, type NarratorVoice } from '../../../shared/narration';
import { narrateLine, narrationStatus, narratorVoices } from '../../api/narration';
import { talkRecorded } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { voiceRecorded, type Reading } from './readAloud';

const STORED = 'hanzi.narrator';
const storedNarrator = () => {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
};

/**
 * Recording a text in a natural voice, from Listen: MiniMax reads it a
 * sentence at a time with the learner's own key (kept in Settings), and each
 * sentence is kept, so the voice is offered here from then on, on every
 * device. Sentences already recorded in the voice are not read again — they
 * cost money.
 */
export function Narrate({ spoken, reading }: { spoken: string[]; reading: Reading }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<NarratorVoice[] | null>(null);
  const [voice, setVoice] = useState<string>(() => storedNarrator() ?? DEFAULT_NARRATOR);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    narrationStatus()
      .then((s) => {
        if (!live) return;
        setHasKey(s.key.set);
        if (s.key.set) return narratorVoices().then((v) => live && setVoices(v));
      })
      .catch((err: Error) => live && (setHasKey((k) => k ?? false), setMessage(err.message)));
    return () => {
      live = false;
    };
  }, []);

  // Once the new recordings are offered, read with them.
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
    try {
      localStorage.setItem(STORED, id);
    } catch {
      // forgotten between visits, that is all
    }
  };

  async function record() {
    setMessage(null);
    const id = narratorRecordingId(voice);
    const lines = [...new Set(spoken.map((l) => l.trim()).filter(Boolean))];
    try {
      const { have } = await talkRecorded(id, lines);
      const todo = lines.filter((_, i) => !have[i]);
      setProgress({ done: 0, total: todo.length });
      for (const [i, line] of todo.entries()) {
        await narrateLine(voice, line);
        setProgress({ done: i + 1, total: todo.length });
      }
      voiceRecorded(id);
      setMade(id);
      setMessage(todo.length ? 'Recorded. It is the voice above now.' : 'Already recorded in this voice.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setProgress(null);
    }
  }

  if (hasKey === false) {
    return (
      <p className="small muted rd-narrate-note">
        A natural voice for this text: add your MiniMax API key in <Link to={paths.settings()}>Settings</Link>.
      </p>
    );
  }

  const busy = progress !== null;
  const known = voices?.some((v) => v.id === voice);
  return (
    <div className="rd-narrate" data-loading={hasKey === null || undefined}>
      <label className="rd-narrate-pick">
        <span className="small muted">Narrator</span>
        <select value={known ? voice : ''} onChange={(e) => choose(e.target.value)} disabled={!voices || busy} aria-label="Narrator">
          {!known && <option value="">{voices ? 'Choose a voice' : 'Loading the voices…'}</option>}
          {(voices ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name.replace(/\s*\((?:Female|Male)\)\s*/i, '')}
            </option>
          ))}
        </select>
      </label>
      <button className="btn tonal sm rd-narrate-go" onClick={() => void record()} disabled={!known || busy}>
        {busy ? `Recording ${progress.done} of ${progress.total}` : 'Record this text'}
      </button>
      <p className="tiny muted rd-narrate-msg">
        {message ?? (voices?.find((v) => v.id === voice)?.description || 'MiniMax reads each sentence once, with your key; Listen keeps it.')}
      </p>
    </div>
  );
}
