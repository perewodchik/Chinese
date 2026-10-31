import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto, OwnTextDto } from '../../../shared/narration';
import { changeOwnText, chosenNarrator, ownTexts, readOwnText, removeOwnText } from '../../api/narration';
import { ownTextForRead, sentencesOf } from '../../domain/ownText';
import { paths } from '../../navigation/paths';
import { addTexts } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useLibrary } from '../shared/library';
import { ReadingPlayer } from '../reader/NarrationPlayer';
import '../reader/reader.css';

/** The shelf in Read that the learner's own texts go to. */
const SHELF = 'My texts';
const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Texts of the learner's own, read aloud: written or pasted here, read by one
 * of their narrators in one request, kept and played here with the slider.
 * Any of them can go to Read, on the My texts shelf, where Listen finds the
 * same reading without paying for it again.
 */
export function OwnTexts({ narrators }: { narrators: NarratorDto[] }) {
  const [list, setList] = useState<OwnTextDto[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    ownTexts().then(
      (texts) => live && setList(texts),
      (err: Error) => live && setLoadError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const put = (t: OwnTextDto) => setList((l) => (l ?? []).map((x) => (x.id === t.id ? t : x)));

  return (
    <div className="block">
      <div className="block-head">
        <h2 className="block-title">Your own texts</h2>
      </div>
      <Compose
        narrators={narrators}
        onRead={(t) => {
          setList((l) => [t, ...(l ?? [])]);
          setOpen(t.id);
        }}
      />
      {list === null ? (
        loadError ? (
          <p className="narrator-error" role="alert">
            {loadError}
          </p>
        ) : (
          <p className="small muted">Loading…</p>
        )
      ) : (
        list.length > 0 && (
          <ul className="list narrator-list">
            {list.map((t) => (
              <OwnTextRow
                key={t.id}
                text={t}
                narrator={narrators.find((n) => n.id === t.narratorId)?.name ?? 'A narrator no longer kept'}
                open={open === t.id}
                onToggle={() => setOpen(open === t.id ? null : t.id)}
                onChanged={put}
                onRemoved={() => setList((l) => (l ?? []).filter((x) => x.id !== t.id))}
              />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------ writing one */

function Compose({ narrators, onRead }: { narrators: NarratorDto[]; onRead: (t: OwnTextDto) => void }) {
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [narratorId, setNarratorId] = useState(() => {
    const c = chosenNarrator();
    return narrators.some((n) => n.id === c) ? c! : narrators[0]!.id;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(() => sentencesOf(raw), [raw]);
  const chars = lines.join('').length;
  const tooLong = lines.length > 300 || chars > 8000 || lines.some((l) => l.length > 240);

  async function read() {
    setBusy(true);
    setError(null);
    try {
      const t = await readOwnText(title, narratorId, lines);
      setTitle('');
      setRaw('');
      onRead(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrator-new own-compose">
      <label className="field">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional: the first words if left empty" maxLength={80} disabled={busy} />
      </label>
      <label className="field">
        Chinese
        <textarea
          className="hanzi"
          rows={5}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="写一段你想听的中文……"
          disabled={busy}
        />
      </label>
      <div className="own-compose-row">
        <label className="field">
          Narrator
          <select value={narratorId} onChange={(e) => setNarratorId(e.target.value)} disabled={busy}>
            {narrators.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn tonal own-go" onClick={() => void read()} disabled={busy || !lines.length || tooLong}>
          {busy ? 'Reading… up to a minute' : 'Read it aloud'}
        </button>
      </div>
      {error ? (
        <p className="narrator-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="tiny muted narrator-msg">
          {tooLong
            ? 'Too long for one reading: up to about 8,000 characters, and no sentence over 240.'
            : lines.length
              ? `${lines.length} ${lines.length === 1 ? 'sentence' : 'sentences'}, one request; kept, so it is paid for once.`
              : 'Write or paste any Chinese. Each sentence lights up as it is read.'}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ one of them */

function OwnTextRow({
  text,
  narrator,
  open,
  onToggle,
  onChanged,
  onRemoved,
}: {
  text: OwnTextDto;
  narrator: string;
  open: boolean;
  onToggle: () => void;
  onChanged: (t: OwnTextDto) => void;
  onRemoved: () => void;
}) {
  const lib = useLibrary();
  const sets = useStore((s) => s.sets);
  const inRead = useStore((s) => (text.textId ? s.texts.some((t) => t.id === text.textId) : false));
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toRead() {
    setBusy(true);
    setError(null);
    try {
      const shelf = sets.find((s) => s.name === SHELF);
      const { texts } = addTexts([ownTextForRead(text.title, text.lines, lib)], { setId: shelf?.id ?? null, name: SHELF });
      onChanged(await changeOwnText(text.id, { textId: texts[0]!.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'It could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeOwnText(text.id);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'It could not be deleted.');
      setBusy(false);
    }
  }

  const meta = [`${text.lines.length} ${text.lines.length === 1 ? 'sentence' : 'sentences'}`, text.narration && clock(text.narration.durationMs), narrator]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="narrator-row" data-open={open || undefined}>
      <button className="narrator-head" onClick={onToggle} aria-expanded={open}>
        <span className="narrator-mark hanzi" aria-hidden>
          文
        </span>
        <span className="grow">
          <b className="hanzi own-title">{text.title}</b>
          {inRead && <span className="tag">In Read</span>}
          <span className="small muted">{meta}</span>
        </span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div className="own-open">
          {text.narration ? (
            <ReadingPlayer lines={text.lines} narration={text.narration} />
          ) : (
            <p className="narrator-error">The reading of this text is gone. Delete it and read it again.</p>
          )}
          <div className="narrator-actions">
            {inRead ? (
              <Link className="btn tonal" to={paths.text(text.textId!)}>
                Open in Read
              </Link>
            ) : (
              <button className="btn tonal" onClick={() => void toRead()} disabled={busy}>
                Save to Read
              </button>
            )}
            {sure ? (
              <button className="btn quiet danger" onClick={() => void remove()} disabled={busy}>
                Delete for good
              </button>
            ) : (
              <button className="btn quiet danger" onClick={() => setSure(true)}>
                Delete
              </button>
            )}
          </div>
          {error ? (
            <p className="narrator-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="tiny muted narrator-msg">
              {inRead
                ? `On the ${SHELF} shelf in Read; its Listen plays this same reading.`
                : `Save to Read puts it on the ${SHELF} shelf, with pinyin, its reading in Listen. No English yet.`}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
