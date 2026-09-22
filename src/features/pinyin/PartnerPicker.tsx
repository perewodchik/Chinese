import { useEffect, useRef, useState } from 'react';
import { PERSONAS, type Persona } from '../../../shared/personas';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Portrait } from './Portrait';
import { hush, playBytes, unlockAudio } from './voiceOut';

interface Line {
  zh: string;
  en: string;
  file: string;
}

let index: Promise<Record<string, Line[]>> | null = null;
const loadIndex = () =>
  (index ??= fetch('/personas/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ lines: Record<string, Line[]> }>) : { lines: {} }))
    .then((d) => d.lines)
    .catch(() => ({})));

/**
 * The conversation partners, each saying the same few lines, to choose
 * between by ear.
 *
 * Choosing a voice from a list of names is choosing blind, and the voice is
 * the thing you will be listening to for the whole conversation. So every
 * partner says the same four sentences — what differs between two of them is
 * the person, not the words — and one line of their own. The ones you keep
 * are the only ones the conversation offers; keeping none offers them all.
 *
 * The lines are recorded files (scripts/voices/personas.ts), so this works on
 * the iPad, where the live voices do not.
 */
export function PartnerPicker() {
  const kept = useStore((s) => s.settings.talkVoices);
  const [lines, setLines] = useState<Record<string, Line[]> | null>(null);
  const [playing, setPlaying] = useState<{ id: string; file: string } | null>(null);
  const turn = useRef(0);

  useEffect(() => {
    void loadIndex().then(setLines);
    return () => hush();
  }, []);

  const ready = PERSONAS.filter((p) => lines?.[p.id]?.length);
  if (!lines || !ready.length) return null;

  const play = async (p: Persona, line: Line) => {
    unlockAudio();
    const mine = ++turn.current;
    setPlaying({ id: p.id, file: line.file });
    try {
      const bytes = await fetch(`/personas/${line.file}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      });
      if (mine === turn.current) await playBytes(bytes);
    } catch {
      // A line that will not load is a silent button, not an error to read.
    }
    if (mine === turn.current) setPlaying(null);
  };

  const toggle = (id: string) =>
    setSettings({ talkVoices: kept.includes(id) ? kept.filter((k) => k !== id) : [...kept, id] });

  const card = (p: Persona) => {
    const on = kept.includes(p.id);
    const speaking = playing?.id === p.id;
    return (
      <div key={p.id} className="partner-card" data-kept={on || undefined}>
        <div className="partner-head">
          <Portrait voice={p.id} gender={p.gender} mood={speaking ? 'speaking' : 'idle'} still={!speaking} />
          <div className="partner-who">
            <b>
              {p.name}
              <span className="count">{p.gender === 'female' ? '♀' : '♂'}</span>
            </b>
            <span className="small muted">{p.blurb}</span>
          </div>
        </div>
        <div className="partner-lines">
          {lines[p.id]!.map((line) => (
            <button
              key={line.file}
              className="partner-line"
              aria-pressed={speaking && playing?.file === line.file}
              onClick={() => void play(p, line)}
              title={line.en}
            >
              <span aria-hidden>🔊</span>
              <span className="hanzi" lang="zh-CN">
                {line.zh}
              </span>
              <i>{line.en}</i>
            </button>
          ))}
        </div>
        <button className="chip partner-keep" aria-pressed={on} onClick={() => toggle(p.id)}>
          {on ? '✓ Kept for conversation' : 'Keep for conversation'}
        </button>
      </div>
    );
  };

  const chens = ready.filter((p) => p.family === 'chen');
  const others = ready.filter((p) => p.family !== 'chen');

  return (
    <>
      <p className="small muted pinyin-lede">
        Everyone says the same few lines, so what you are comparing is the voice. Keep the ones you like — only
        those are offered when you start a conversation
        {kept.length ? `; you have kept ${kept.length}.` : ', and until you keep one, all of them are.'}
      </p>
      {chens.length > 0 && (
        <>
          <h3 className="partner-group tiny muted">Chen, three calmer takes</h3>
          <div className="partner-grid">{chens.map(card)}</div>
        </>
      )}
      {others.length > 0 && (
        <>
          <h3 className="partner-group tiny muted">Other partners</h3>
          <div className="partner-grid">{others.map(card)}</div>
        </>
      )}
    </>
  );
}
