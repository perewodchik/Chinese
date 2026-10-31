import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EMOTIONS, SPEED_RANGE, PITCH_RANGE, type Emotion, type NarrationStatus, type NarratorDto, type NarratorVoice } from '../../../shared/narration';
import {
  adoptNarrator,
  changeNarrator,
  chooseNarrator,
  chosenNarrator,
  designNarrator,
  listNarrators,
  narrateLine,
  narrationStatus,
  narratorVoices,
  previewNarrator,
  removeNarrator,
} from '../../api/narration';
import { talkRecorded } from '../../api/talk';
import type { GeneratedText } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { voiceRecorded } from '../reader/readAloud';
import { NarrationKey } from '../settings/NarrationKey';
import './narrators.css';

const SAMPLE = '你好！我们今天一起读一个小故事。你准备好了吗？';
const plain = (name: string) => name.replace(/\s*\((?:Female|Male)\)\s*/i, '');
const sentencesOf = (t: GeneratedText) => [...new Set(t.lines.map((l) => l.zh.trim()).filter(Boolean))];

/**
 * Voices: the narrators who read texts aloud in Listen, made and tuned here.
 *
 * A narrator is a MiniMax voice — made from a description, or one of
 * MiniMax's own — with a name and how it sounds: speed, pitch, emotion. Each
 * is heard before it is kept, and texts are given to it here a shelf at a
 * time, a sentence a request, with the learner's own key.
 */
export function NarratorsPage() {
  useTitle('Voices');
  const [status, setStatus] = useState<NarrationStatus | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    listNarrators().then(
      (list) => setNarrators(list),
      (err: Error) => setError(err.message),
    );

  useEffect(() => {
    void narrationStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null } }));
    void load();
  }, []);

  const keySet = status?.key.set ?? false;
  const put = (n: NarratorDto) => setNarrators((list) => (list ?? []).map((x) => (x.id === n.id ? n : x)));

  return (
    <section className="narrators" style={{ maxWidth: 720 }}>
      <Link className="back-link" to={paths.speaking()}>
        <Icon name="back" /> Speaking
      </Link>
      <div className="page-head">
        <h1>Voices</h1>
      </div>
      <p className="small muted narrators-lede">
        The narrators who read your texts aloud in Listen. Make a voice from a description, tune how it speaks, hear it,
        then give it texts to read. MiniMax reads with your own key; every sentence is read once and kept for every
        device.
      </p>

      {status && !keySet && <NarrationKey onChange={setStatus} />}

      {keySet && (
        <>
          <div className="block">
            <div className="block-head">
              <h2 className="block-title">Your narrators</h2>
            </div>
            {narrators === null ? (
              <p className="small muted">{error ?? 'Loading…'}</p>
            ) : narrators.length === 0 ? (
              <p className="small muted">None yet. Make one below: describe the voice you want to hear.</p>
            ) : (
              <ul className="list narrator-list">
                {narrators.map((n) => (
                  <NarratorRow
                    key={n.id}
                    narrator={n}
                    open={open === n.id}
                    onToggle={() => setOpen(open === n.id ? null : n.id)}
                    onSaved={put}
                    onRemoved={() => setNarrators((list) => (list ?? []).filter((x) => x.id !== n.id))}
                  />
                ))}
              </ul>
            )}
          </div>

          <NewNarrator
            onMade={(n) => {
              setNarrators((list) => [...(list ?? []), n]);
              setOpen(n.id);
            }}
          />

          {narrators && narrators.length > 0 && <ReadTexts narrators={narrators} />}

          <details className="narrators-key">
            <summary className="small muted">MiniMax key {status?.key.hint ?? ''}</summary>
            <NarrationKey onChange={setStatus} />
          </details>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ one narrator */

function NarratorRow({
  narrator,
  open,
  onToggle,
  onSaved,
  onRemoved,
}: {
  narrator: NarratorDto;
  open: boolean;
  onToggle: () => void;
  onSaved: (n: NarratorDto) => void;
  onRemoved: () => void;
}) {
  const [inListen, setInListen] = useState(() => chosenNarrator() === narrator.id);
  const summary = [
    narrator.kind === 'designed' ? 'Made from a description' : 'A MiniMax voice',
    `${narrator.speed.toFixed(2).replace(/0$/, '')}×`,
    narrator.pitch ? `pitch ${narrator.pitch > 0 ? '+' : ''}${narrator.pitch}` : null,
    narrator.emotion,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="narrator-row" data-open={open || undefined}>
      <button className="narrator-head" onClick={onToggle} aria-expanded={open}>
        <span className="narrator-mark hanzi" aria-hidden>
          声
        </span>
        <span className="grow">
          <b>{narrator.name}</b>
          {inListen && <span className="tag">In Listen</span>}
          <span className="small muted">{summary}</span>
        </span>
        <Icon name="chevron" />
      </button>
      {open && (
        <NarratorEditor
          narrator={narrator}
          inListen={inListen}
          onListen={() => {
            chooseNarrator(narrator.id);
            setInListen(true);
          }}
          onSaved={onSaved}
          onRemoved={onRemoved}
        />
      )}
    </li>
  );
}

function NarratorEditor({
  narrator,
  inListen,
  onListen,
  onSaved,
  onRemoved,
}: {
  narrator: NarratorDto;
  inListen: boolean;
  onListen: () => void;
  onSaved: (n: NarratorDto) => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState(narrator.name);
  const [speed, setSpeed] = useState(narrator.speed);
  const [pitch, setPitch] = useState(narrator.pitch);
  const [emotion, setEmotion] = useState<Emotion | null>(narrator.emotion);
  const [sample, setSample] = useState(narrator.previewText || SAMPLE);
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'hear' | 'delete' | null>(null);
  const [sure, setSure] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = name.trim() !== narrator.name || speed !== narrator.speed || pitch !== narrator.pitch || emotion !== narrator.emotion;

  async function save() {
    setBusy('save');
    setMessage(null);
    try {
      const n = await changeNarrator(narrator.id, { name: name.trim(), speed, pitch, emotion });
      onSaved(n);
      setMessage('Saved. Texts read from now on sound like this; read a text again in “Read texts aloud” to change one already read.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  async function hear() {
    setBusy('hear');
    setMessage(null);
    try {
      // Saved first, so what is heard is what texts will be read with.
      if (dirty) onSaved(await changeNarrator(narrator.id, { name: name.trim(), speed, pitch, emotion }));
      setAudio(await previewNarrator(narrator.id, sample));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      await removeNarrator(narrator.id);
      onRemoved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work.');
      setBusy(null);
    }
  }

  return (
    <div className="narrator-edit">
      {narrator.kind === 'designed' && (
        <details className="narrator-prompt">
          <summary className="small muted">The description it was made from</summary>
          <p className="small">{narrator.prompt}</p>
        </details>
      )}
      <label className="field">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      <label className="field narrator-slider">
        <span>
          Speed <output>{speed.toFixed(2)}×</output>
        </span>
        <input type="range" min={SPEED_RANGE[0]} max={SPEED_RANGE[1]} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        <span className="tiny muted">Below 1 is slower. 0.8–0.9 is a good pace to repeat after.</span>
      </label>
      <label className="field narrator-slider">
        <span>
          Pitch <output>{pitch > 0 ? `+${pitch}` : pitch}</output>
        </span>
        <input type="range" min={PITCH_RANGE[0]} max={PITCH_RANGE[1]} step={1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
        <span className="tiny muted">In semitones; 0 is the voice as it was made.</span>
      </label>
      <div className="field">
        Mood
        <div className="narrator-chips" role="group" aria-label="Mood">
          <button className="chip" aria-pressed={emotion === null} onClick={() => setEmotion(null)}>
            Follows the text
          </button>
          {EMOTIONS.map((e) => (
            <button key={e} className="chip" aria-pressed={emotion === e} onClick={() => setEmotion(emotion === e ? null : e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        Hear it say
        <input className="hanzi" value={sample} onChange={(e) => setSample(e.target.value)} maxLength={200} />
      </label>
      <div className="narrator-actions">
        <button className="btn tonal" onClick={() => void hear()} disabled={busy !== null}>
          {busy === 'hear' ? 'Reading…' : 'Hear it'}
        </button>
        <button className="btn tonal" onClick={() => void save()} disabled={!dirty || busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        <button className="btn quiet" onClick={onListen} disabled={inListen}>
          {inListen ? 'Reads in Listen' : 'Use in Listen'}
        </button>
        <span className="spacer" />
        {sure ? (
          <button className="btn quiet danger" onClick={() => void remove()} disabled={busy !== null}>
            Delete for good
          </button>
        ) : (
          <button className="btn quiet danger" onClick={() => setSure(true)}>
            Delete
          </button>
        )}
      </div>
      <div className="narrator-audio">{audio && <audio controls autoPlay src={audio} />}</div>
      <p className="tiny muted narrator-msg">{message ?? ''}</p>
    </div>
  );
}

/* ------------------------------------------------------------ a new voice */

function NewNarrator({ onMade }: { onMade: (n: NarratorDto) => void }) {
  const [how, setHow] = useState<'describe' | 'library'>('describe');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sample, setSample] = useState(SAMPLE);
  const [voices, setVoices] = useState<NarratorVoice[] | null>(null);
  const [voice, setVoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (how !== 'library' || voices) return;
    void narratorVoices().then(setVoices, (err: Error) => setMessage(err.message));
  }, [how, voices]);

  async function make() {
    setBusy(true);
    setMessage(null);
    setTrial(null);
    try {
      if (how === 'describe') {
        const made = await designNarrator(name.trim(), prompt.trim(), sample.trim());
        const bytes = Uint8Array.from(atob(made.trial), (c) => c.charCodeAt(0));
        if (bytes.length) setTrial(URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
        onMade(made.narrator);
        setMessage(`${made.narrator.name} is made: listen below, then tune it in Your narrators.`);
        setPrompt('');
        setName('');
      } else {
        const n = await adoptNarrator(name.trim(), voice);
        onMade(n);
        setMessage(`${n.name} is added to Your narrators.`);
        setName('');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setBusy(false);
    }
  }

  const ready = how === 'describe' ? name.trim() && prompt.trim().length >= 10 && sample.trim() : voice;
  return (
    <div className="block">
      <div className="block-head">
        <h2 className="block-title">A new voice</h2>
      </div>
      <div className="narrator-new">
        <div className="seg sm" role="group" aria-label="How">
          <button aria-pressed={how === 'describe'} onClick={() => setHow('describe')}>
            Describe it
          </button>
          <button aria-pressed={how === 'library'} onClick={() => setHow('library')}>
            MiniMax’s voices
          </button>
        </div>
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={how === 'describe' ? 'Tutor, Grandma, Ash…' : 'Leave empty for its own name'} />
        </label>
        {how === 'describe' ? (
          <>
            <label className="field">
              What it sounds like
              <textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                placeholder="A young man from Beijing, 20–25, perfect standard Putonghua, a little slower than normal, warm and patient, every tone clear…"
              />
              <span className="tiny muted">Who it is, age, accent, pace, mood, the room it is recorded in. English is fine.</span>
            </label>
            <label className="field">
              Its first words
              <input className="hanzi" value={sample} onChange={(e) => setSample(e.target.value)} maxLength={200} />
            </label>
          </>
        ) : (
          <label className="field">
            Voice
            <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={!voices}>
              <option value="">{voices ? 'Choose a voice' : 'Loading the voices…'}</option>
              {(voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {plain(v.name)} · {v.gender === 'male' ? 'man' : 'woman'}
                </option>
              ))}
            </select>
            <span className="tiny muted">{voices?.find((v) => v.id === voice)?.description ?? ''}</span>
          </label>
        )}
        <div className="narrator-actions">
          <button className="btn primary" onClick={() => void make()} disabled={!ready || busy}>
            {busy ? (how === 'describe' ? 'Making the voice…' : 'Adding…') : how === 'describe' ? 'Make the voice' : 'Add the voice'}
          </button>
        </div>
        <div className="narrator-audio">{trial && <audio controls autoPlay src={trial} />}</div>
        <p className="tiny muted narrator-msg">{message ?? ''}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ giving it texts */

type Count = { have: number; total: number };

function ReadTexts({ narrators }: { narrators: NarratorDto[] }) {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const [narratorId, setNarratorId] = useState(() => {
    const c = chosenNarrator();
    return narrators.some((n) => n.id === c) ? c! : narrators[0]!.id;
  });
  const shelves = useMemo(() => sets.filter((s) => texts.some((t) => t.setId === s.id)), [sets, texts]);
  const [shelf, setShelf] = useState(() => shelves[0]?.id ?? '');
  const narrator = narrators.find((n) => n.id === narratorId) ?? narrators[0]!;
  const list = useMemo(() => texts.filter((t) => t.setId === shelf).sort((a, b) => a.createdAt - b.createdAt), [texts, shelf]);
  const [counts, setCounts] = useState<Record<string, Count>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [again, setAgain] = useState(false);
  const [running, setRunning] = useState<{ text: string; done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // How much of each text this narrator has read already.
  useEffect(() => {
    let live = true;
    setCounts({});
    void Promise.all(
      list.map((t) =>
        talkRecorded(narrator.recordingId, sentencesOf(t)).then(
          ({ have }) => [t.id, { have: have.filter(Boolean).length, total: have.length }] as const,
          () => [t.id, { have: 0, total: sentencesOf(t).length }] as const,
        ),
      ),
    ).then((rows) => {
      if (!live) return;
      const next = Object.fromEntries(rows);
      setCounts(next);
      setPicked(new Set(rows.filter(([, c]) => c.have < c.total).map(([id]) => id)));
    });
    return () => {
      live = false;
    };
  }, [list, narrator.recordingId]);

  async function run() {
    setMessage(null);
    const chosen = list.filter((t) => picked.has(t.id));
    try {
      for (const t of chosen) {
        const lines = sentencesOf(t);
        const { have } = await talkRecorded(narrator.recordingId, lines);
        const todo = again ? lines : lines.filter((_, i) => !have[i]);
        setRunning({ text: t.titleZh || t.title, done: 0, total: todo.length });
        for (const [i, line] of todo.entries()) {
          await narrateLine(narrator.id, line);
          setRunning({ text: t.titleZh || t.title, done: i + 1, total: todo.length });
        }
        setCounts((c) => ({ ...c, [t.id]: { have: lines.length, total: lines.length } }));
        setPicked((p) => {
          const n = new Set(p);
          n.delete(t.id);
          return n;
        });
      }
      voiceRecorded(narrator.recordingId);
      setMessage(`Done: ${chosen.length} ${chosen.length === 1 ? 'text' : 'texts'} read by ${narrator.name}. Listen offers the voice on them.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setRunning(null);
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="block">
      <div className="block-head">
        <h2 className="block-title">Read texts aloud</h2>
      </div>
      <div className="narrator-read">
        <div className="narrator-read-pick">
          <label className="field">
            Narrator
            <select value={narrator.id} onChange={(e) => setNarratorId(e.target.value)} disabled={running !== null}>
              {narrators.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Shelf
            <select value={shelf} onChange={(e) => setShelf(e.target.value)} disabled={running !== null}>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="list narrator-texts">
          {list.map((t) => {
            const c = counts[t.id];
            const now = running && running.text === (t.titleZh || t.title);
            return (
              <li key={t.id}>
                <label className="narrator-text">
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} disabled={running !== null} />
                  <span className="grow hanzi">{t.titleZh || t.title}</span>
                  <span className="tiny muted narrator-count">
                    {now ? `Reading ${running.done} of ${running.total}` : c ? (c.have >= c.total ? 'All read' : `${c.have} of ${c.total} read`) : '…'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <label className="toggle">
          <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} disabled={running !== null} />
          <span>
            Read again what it has read
            <span className="d">After you changed how it sounds. It costs the same again.</span>
          </span>
        </label>
        <div className="narrator-actions">
          <button className="btn tonal" onClick={() => void run()} disabled={running !== null || picked.size === 0}>
            {running ? `Reading ${running.text}…` : `Read ${picked.size} ${picked.size === 1 ? 'text' : 'texts'}`}
          </button>
        </div>
        <p className="tiny muted narrator-msg">{message ?? ''}</p>
      </div>
    </div>
  );
}
