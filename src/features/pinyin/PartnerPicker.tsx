import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { PERSONAS, personaOf, type Persona } from '../../../shared/personas';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { Portrait } from './Portrait';
import { readPrefs, writePrefs } from './talkPrefs';
import { hush, playBytes, playBytesAtPace, unlockAudio } from '../../platform/audio/voiceOut';

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
 * The recorded lines, and one of them playing at a time.
 *
 * The lines are recorded files (scripts/voices/personas.ts), so this works on
 * the iPad, where the live voices do not.
 */
function usePartnerLines() {
  const [lines, setLines] = useState<Record<string, Line[]> | null>(null);
  const [playing, setPlaying] = useState<{ id: string; file: string } | null>(null);
  const turn = useRef(0);

  useEffect(() => {
    void loadIndex().then(setLines);
    return () => hush();
  }, []);

  const play = async (p: Persona, line: Line) => {
    unlockAudio();
    const mine = ++turn.current;
    setPlaying({ id: p.id, file: line.file });
    try {
      const bytes = await fetch(`/personas/${line.file}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      });
      // At the pace the conversation will play them: Chen is slowed there.
      if (mine === turn.current) await (p.pace && p.pace !== 1 ? playBytesAtPace(bytes, p.pace) : playBytes(bytes));
    } catch {
      // A line that will not load is a silent button, not an error to read.
    }
    if (mine === turn.current) setPlaying(null);
  };

  return { lines, playing, play };
}

function useKept() {
  const kept = useStore((s) => s.settings.talkVoices);
  const toggle = (id: string) =>
    setSettings({
      talkVoices: kept.includes(id) ? kept.filter((k) => k !== id) : [...kept, id],
    });
  return { kept, toggle };
}

/**
 * One partner: who they are and their lines to hear. In the line-up, a check
 * in the corner keeps them or not; in their own drawer there is nothing to
 * choose, so there is no check.
 */
function PartnerCard({
  p,
  lines,
  playing,
  play,
  keepable,
}: {
  p: Persona;
  lines: Line[];
  keepable?: boolean;
} & Pick<ReturnType<typeof usePartnerLines>, 'playing' | 'play'>) {
  const { kept, toggle } = useKept();
  const on = kept.includes(p.id);
  const speaking = playing?.id === p.id;
  return (
    <div className="partner-card" data-kept={(keepable && on) || undefined}>
      <div className="partner-head">
        <Portrait voice={p.id} gender={p.gender} mood={speaking ? 'speaking' : 'idle'} still={!speaking} />
        <div className="partner-who">
          <b>
            {p.name}
            <span className="count">{p.gender === 'female' ? '♀' : '♂'}</span>
          </b>
          <span className="small muted">{p.blurb}</span>
        </div>
        {keepable && (
          <button
            className="partner-keep"
            aria-pressed={on}
            aria-label={on ? `${p.name} is kept for conversation` : `Keep ${p.name} for conversation`}
            title={on ? 'Kept for conversation' : 'Keep for conversation'}
            onClick={() => toggle(p.id)}
          >
            {on ? '✓' : ''}
          </button>
        )}
      </div>
      <div className="partner-lines">
        {lines.map((line) => (
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
    </div>
  );
}

/**
 * Every conversation partner, each saying the same few lines, to choose
 * between by ear.
 *
 * Choosing a voice from a list of names is choosing blind, and the voice is
 * the thing you will be listening to for the whole conversation. So every
 * partner says the same four sentences — what differs between two of them is
 * the person, not the words — and one line of their own. The ones you keep
 * are the only ones the conversation offers; keeping none offers them all.
 */
function PartnerPicker() {
  const { lines, playing, play } = usePartnerLines();
  const { kept } = useKept();
  const ready = PERSONAS.filter((p) => lines?.[p.id]?.length);
  if (!lines) return <p className="small muted">Loading their voices…</p>;
  if (!ready.length) return <p className="small muted">The partners’ recordings are not on this server.</p>;

  const card = (p: Persona) => (
    <PartnerCard key={p.id} p={p} lines={lines[p.id]!} playing={playing} play={play} keepable />
  );
  const women = ready.filter((p) => p.gender === 'female');
  const men = ready.filter((p) => p.gender === 'male');

  return (
    <div>
      <p className="small muted" style={{ margin: 0 }}>
        Everyone says the same few lines, so what you are comparing is the voice. Tick the ones you like: only they are
        offered when you start a conversation
        {kept.length ? `; you have kept ${kept.length}.` : ', and until you keep one, all of them are.'}
      </p>
      {men.length > 0 && (
        <>
          <h3 className="partner-group tiny muted">Men</h3>
          <div className="partner-grid">{men.map(card)}</div>
        </>
      )}
      {women.length > 0 && (
        <>
          <h3 className="partner-group tiny muted">Women</h3>
          <div className="partner-grid">{women.map(card)}</div>
        </>
      )}
    </div>
  );
}

/** One partner in a drawer: hear them, keep them or not, start talking with them. */
function PartnerSheet({ p, onClose }: { p: Persona; onClose: () => void }) {
  const { lines, playing, play } = usePartnerLines();
  const navigate = useNavigate();
  const talk = () => {
    // The setup page reads this on the way in, so it opens with them chosen.
    writePrefs({ ...readPrefs(), voice: p.id });
    void navigate(paths.speakingNew());
  };
  return (
    <Modal
      title="Conversation partner"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={talk}>
          Talk with {p.name} →
        </button>
      }
    >
      {lines ? (
        <PartnerCard p={p} lines={lines[p.id] ?? []} playing={playing} play={play} />
      ) : (
        <p className="small muted">Loading their voice…</p>
      )}
    </Modal>
  );
}

/**
 * The conversation, and who you have it with, in one block.
 *
 * The partners used to fill the page: every one of them, every line, every
 * time — a picker whose work was done once you had picked. What stays in
 * sight is the result of that choice, the faces you kept, one line of them;
 * a face opens that partner, and the whole line-up is behind Change for the
 * day you want somebody new.
 */
export function ConversationBlock() {
  const { kept } = useKept();
  const { hash } = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // The setup page's "Change who is here" arrives with #partners.
  useEffect(() => {
    if (hash === '#partners') setPicking(true);
  }, [hash]);

  const shown = kept.length ? kept.flatMap((id) => personaOf(id) ?? []) : PERSONAS;
  const sheet = open ? personaOf(open) : undefined;

  return (
    <div className="talk-block" id="partners">
      <Link className="talk-block-head" to={paths.speakingNew()}>
        <span className="voice-invite-mark hanzi" aria-hidden>
          聊
        </span>
        <span>
          <b>Conversation</b>
          <span className="small muted">
            Talk with Claude out loud. It asks about something everyday, you answer by speaking, and it answers back in
            a voice.
          </span>
        </span>
        <span className="go">Start →</span>
      </Link>
      <div className="talk-block-faces">
        <div className="talk-block-strip">
          {shown.map((p) => (
            <button key={p.id} className="voice-face" onClick={() => setOpen(p.id)} title={`${p.name}: ${p.blurb}`}>
              <Portrait voice={p.id} gender={p.gender} mood="idle" still />
              <span className="voice-face-name">{p.name}</span>
            </button>
          ))}
        </div>
        <button className="chip talk-block-change" onClick={() => setPicking(true)}>
          {kept.length ? 'Change' : 'Choose'}
        </button>
      </div>
      {sheet && <PartnerSheet p={sheet} onClose={() => setOpen(null)} />}
      {picking && (
        <Modal title="Conversation partners" onClose={() => setPicking(false)} wide>
          <PartnerPicker />
        </Modal>
      )}
    </div>
  );
}
