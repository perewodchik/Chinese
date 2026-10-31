import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { EMOTIONS, SPEED_RANGE, PITCH_RANGE, type Emotion, type NarrationStatus, type NarratorDto, type NarratorVoice, type TextNarrationDto } from '../../../shared/narration';
import {
  adoptNarrator,
  changeNarrator,
  chooseNarrator,
  chosenNarrator,
  keepVoice,
  tryVoices,
  listNarrators,
  narrationAudio,
  narrationOf,
  narrationStatus,
  narratorVoices,
  previewNarrator,
  removeNarrator,
} from '../../api/narration';
import type { GeneratedText } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { NarrationKey } from '../settings/NarrationKey';
import { OwnTexts } from './OwnTexts';
import './narrators.css';

const SAMPLE = '你好！我们今天一起读一个小故事。你准备好了吗？';
const plain = (name: string) => name.replace(/\s*\((?:Female|Male)\)\s*/i, '');
const linesOf = (t: GeneratedText) => t.lines.map((l) => l.zh);

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
        The narrators who read aloud. Make a voice from a description, tune how it speaks, then give it your own text
        to read, or texts from Read. MiniMax reads with your own key; every reading is made once and kept for every
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

          {narrators && narrators.length > 0 && (
            <>
              <OwnTexts narrators={narrators} />
              <ReadTexts narrators={narrators} />
            </>
          )}

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
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== narrator.name || speed !== narrator.speed || pitch !== narrator.pitch || emotion !== narrator.emotion;

  async function save() {
    setBusy('save');
    setMessage(null);
    setError(null);
    try {
      const n = await changeNarrator(narrator.id, { name: name.trim(), speed, pitch, emotion });
      onSaved(n);
      setMessage('Saved. Texts read from now on sound like this; read a text again in “Read texts aloud” to change one already read.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  async function hear() {
    setBusy('hear');
    setMessage(null);
    setError(null);
    try {
      // Saved first, so what is heard is what texts will be read with.
      if (dirty) onSaved(await changeNarrator(narrator.id, { name: name.trim(), speed, pitch, emotion }));
      setAudio(await previewNarrator(narrator.id, sample));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MiniMax did not answer.');
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
      setError(err instanceof Error ? err.message : 'That did not work.');
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
      {error && (
        <p className="narrator-error" role="alert">
          {error}
        </p>
      )}
      <p className="tiny muted narrator-msg">{message ?? ''}</p>
    </div>
  );
}

/* ------------------------------------------------------------ a new voice */

const toAudioUrl = (b64: string) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes.length ? URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })) : null;
};

/**
 * A new voice. Described: MiniMax makes three from the description at once,
 * each heard saying its first words, and the one chosen is kept — the others
 * are not. From MiniMax's library: one of its own voices, kept as it is.
 */
function NewNarrator({ onMade }: { onMade: (n: NarratorDto) => void }) {
  const [how, setHow] = useState<'describe' | 'library'>('describe');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sample, setSample] = useState(SAMPLE);
  const [voices, setVoices] = useState<NarratorVoice[] | null>(null);
  const [voice, setVoice] = useState('');
  const [busy, setBusy] = useState<'try' | 'keep' | 'add' | null>(null);
  /** the voices just made, to choose among; what they were made from, so a kept one is kept with it */
  const [tried, setTried] = useState<{ prompt: string; sample: string; voices: Array<{ voiceId: string; url: string | null }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (how !== 'library' || voices) return;
    void narratorVoices().then(setVoices, (err: Error) => setError(err.message));
  }, [how, voices]);

  async function makeThree() {
    setBusy('try');
    setError(null);
    setNote(null);
    try {
      const out = await tryVoices(prompt.trim(), sample.trim());
      setTried({ prompt: prompt.trim(), sample: sample.trim(), voices: out.voices.map((v) => ({ voiceId: v.voiceId, url: toAudioUrl(v.trial) })) });
      if (out.failed) setNote(`${out.failed} of the three did not come back; here are the others.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MiniMax did not answer. Try again in a minute.');
    } finally {
      setBusy(null);
    }
  }

  async function keep(voiceId: string, i: number) {
    if (!tried) return;
    if (!name.trim()) {
      setError('Give the voice a name first, above.');
      return;
    }
    setBusy('keep');
    setError(null);
    try {
      const n = await keepVoice(name.trim(), tried.prompt, tried.sample, voiceId);
      onMade(n);
      setNote(`Voice ${i + 1} is kept as ${n.name}: tune it in Your narrators.`);
      setTried(null);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    setBusy('add');
    setError(null);
    try {
      const n = await adoptNarrator(name.trim(), voice);
      onMade(n);
      setNote(`${n.name} is added to Your narrators.`);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

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
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={how === 'describe' ? 'Tutor, Storyteller, Ash…' : 'Leave empty for its own name'} />
        </label>
        {how === 'describe' ? (
          <>
            <label className="field">
              What it sounds like
              <textarea
                rows={7}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                placeholder="A young man from Beijing, about 25, perfect standard Putonghua, a little slower than normal, warm and patient, every tone clear…"
              />
              <span className="tiny muted">Who it is, age, accent, pitch, pace, mood, the room it is recorded in. English is fine.</span>
            </label>
            <label className="field">
              Its first words
              <input className="hanzi" value={sample} onChange={(e) => setSample(e.target.value)} maxLength={200} />
            </label>
            <div className="narrator-actions">
              <button className="btn primary" onClick={() => void makeThree()} disabled={busy !== null || prompt.trim().length < 10 || !sample.trim()}>
                {busy === 'try' ? 'Making three voices… about half a minute' : tried ? 'Make three more' : 'Make three voices'}
              </button>
            </div>
            {tried && (
              <ul className="narrator-candidates">
                {tried.voices.map((v, i) => (
                  <li key={v.voiceId}>
                    <b>Voice {i + 1}</b>
                    {v.url ? <audio controls preload="auto" src={v.url} /> : <span className="tiny muted">No sample came back.</span>}
                    <button className="btn tonal sm" onClick={() => void keep(v.voiceId, i)} disabled={busy !== null}>
                      {busy === 'keep' ? 'Keeping…' : 'Keep this one'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
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
            <div className="narrator-actions">
              <button className="btn primary" onClick={() => void add()} disabled={!voice || busy !== null}>
                {busy === 'add' ? 'Adding…' : 'Add the voice'}
              </button>
            </div>
          </>
        )}
        {error && (
          <p className="narrator-error" role="alert">
            {error}
          </p>
        )}
        <p className="tiny muted narrator-msg">{note ?? ''}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ giving it texts */

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
  /** the narrator's reading of each text, as it sounds now; null for none yet */
  const [readings, setReadings] = useState<Record<string, TextNarrationDto | null>>({});
  const read = useMemo(() => Object.fromEntries(Object.entries(readings).map(([id, n]) => [id, n !== null])) as Record<string, boolean>, [readings]);
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [again, setAgain] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setReadings({});
    void Promise.all(
      list.map((t) =>
        narrationOf(narrator.id, linesOf(t)).then(
          (n) => [t.id, n] as const,
          () => [t.id, null] as const,
        ),
      ),
    ).then((rows) => {
      if (!live) return;
      setReadings(Object.fromEntries(rows));
      setPicked(new Set(rows.filter(([, n]) => !n).map(([id]) => id)));
    });
    return () => {
      live = false;
    };
  }, [list, narrator.id]);

  // Stopped when the page is left.
  useEffect(() => () => player.current?.pause(), []);

  /** Plays a text's kept reading here, or stops it. The element is made and started inside the tap, as iOS wants. */
  function listen(id: string) {
    const n = readings[id];
    player.current?.pause();
    if (playing === id || !n) {
      setPlaying(null);
      return;
    }
    const a = new Audio();
    player.current = a;
    a.onended = () => setPlaying((p) => (p === id ? null : p));
    void a.play().catch(() => undefined);
    setPlaying(id);
    narrationAudio(n).then(
      (url) => {
        if (player.current !== a) return;
        a.src = url;
        void a.play().catch(() => undefined);
      },
      (err: Error) => {
        setError(err.message);
        setPlaying(null);
      },
    );
  }

  async function run() {
    setMessage(null);
    setError(null);
    const chosen = list.filter((t) => picked.has(t.id));
    try {
      for (const t of chosen) {
        setRunning(t.id);
        const n = await narrationOf(narrator.id, linesOf(t), again ? { again: true } : { generate: true });
        setReadings((r) => ({ ...r, [t.id]: n }));
        setPicked((p) => {
          const n = new Set(p);
          n.delete(t.id);
          return n;
        });
      }
      setMessage(`Done: ${chosen.length} ${chosen.length === 1 ? 'text' : 'texts'} read by ${narrator.name} and kept. Listen plays them.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MiniMax did not answer.');
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
        <h2 className="block-title">Texts from Read</h2>
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
            const done = read[t.id];
            return (
              <li key={t.id} className="narrator-text-row">
                <label className="narrator-text">
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} disabled={running !== null} />
                  <span className="grow hanzi">{t.titleZh || t.title}</span>
                  <span className="tiny muted narrator-count">
                    {running === t.id ? 'Reading…' : done === undefined ? '…' : done ? 'Read' : 'Not read yet'}
                  </span>
                </label>
                {/* Always there, so the rows do not shift as the readings are found. */}
                <button
                  className="icon-btn narrator-listen"
                  onClick={() => listen(t.id)}
                  disabled={!done}
                  aria-label={playing === t.id ? `Stop ${t.titleZh || t.title}` : `Listen to ${t.titleZh || t.title}`}
                >
                  <Icon name={playing === t.id ? 'pause' : 'play'} size={18} />
                </button>
              </li>
            );
          })}
        </ul>
        <label className="toggle">
          <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} disabled={running !== null} />
          <span>
            Read again what it has read
            <span className="d">Changing a narrator’s voice already asks for new readings; this reads the same again. It costs the same again.</span>
          </span>
        </label>
        <div className="narrator-actions">
          <button className="btn tonal" onClick={() => void run()} disabled={running !== null || picked.size === 0}>
            {running ? 'Reading… up to a minute each' : `Read ${picked.size} ${picked.size === 1 ? 'text' : 'texts'}`}
          </button>
        </div>
        {error && (
          <p className="narrator-error" role="alert">
            {error}
          </p>
        )}
        <p className="tiny muted narrator-msg">{message ?? ''}</p>
      </div>
    </div>
  );
}
