import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  parseReply,
  relayOpening,
  relayTurn,
  type ClaudeState,
  type TalkLevel,
  type TalkLine,
  type TalkReply,
  type TalkStatusResponse,
  type TalkVoice,
} from '../../../shared/talk';
import { talkReply, talkStatus } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { canRecognise, listen, RECOGNITION_MESSAGE, type Listening } from '../../platform/audio/recognition';
import { copyText } from '../../platform/clipboard';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { RecordButton } from './RecordButton';
import { sayTurn } from './talkOut';
import { preferredVoice } from './voice';
import { unlockAudio } from './voiceOut';
import './pinyin.css';

interface Turn extends TalkReply {
  id: number;
  who: 'tutor' | 'learner';
}

/** What the page remembers between visits, on this device. */
interface Prefs {
  level: TalkLevel;
  /** a local voice by id, or 'system' */
  voice: string | null;
  pinyin: boolean;
  english: boolean;
}

const PREFS_KEY = 'hanzi.talk.v1';

function readPrefs(): Prefs {
  const fallback: Prefs = { level: 'hsk1', voice: null, pinyin: true, english: false };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) } : fallback;
  } catch {
    return fallback;
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private browsing: remembered for this visit only.
  }
}

const LEVELS = [
  { id: 'hsk1', label: 'HSK 1' },
  { id: 'hsk2', label: 'HSK 2' },
  { id: 'hsk3', label: 'HSK 3' },
] as const;

const HAN = /[㐀-鿿]/;
const SYSTEM = 'system';

/** The voice to use: the one chosen here, then the pronunciation section's, then Chen, then any. */
function pickVoice(chosen: string | null, voices: TalkVoice[]): string {
  const ids = voices.map((v) => v.id);
  for (const id of [chosen, preferredVoice(), 'chen']) if (id && (id === SYSTEM || ids.includes(id))) return id;
  return ids[0] ?? SYSTEM;
}

const RELAY_NOTE: Record<Exclude<ClaudeState, 'ready'>, string> = {
  'signed-out':
    'Claude Code on the computer running this app is not signed in, so for now each turn goes through your own Claude chat. Sign it in once with your Claude subscription — claude auth login in a terminal there — and this page will ask Claude by itself.',
  'api-key':
    'Claude Code on the computer running this app is signed in with an API key, which is billed on top of your subscription, so it is not used. Sign it in to your subscription instead (claude auth logout, then claude auth login). Until then, each turn goes through your own Claude chat.',
  missing:
    'This server cannot ask Claude by itself — that only works on the computer at home, where Claude Code runs. Each turn goes through your own Claude chat instead: copy, paste, and paste the answer back.',
};

/**
 * Talking with Claude, out loud.
 *
 * Claude opens with a question on something everyday; the learner answers by
 * speaking; speech recognition writes down what it heard in characters —
 * itself a check on pronunciation, since a native-trained ear wrote it — and
 * Claude answers that, in a voice. The learner never types unless they want
 * to.
 *
 * Claude is reached through the learner's subscription, never a paid API key.
 * At home the server runs Claude Code for each turn, and the page does the
 * rest by itself. Where it cannot (the Vercel site), the learner carries each
 * turn to their own Claude chat and pastes the answer back — clumsier, but
 * the same conversation and the same voices.
 */
export function TalkPage() {
  useTitle('Conversation');
  const lib = useLibrary();
  const toast = useToast();
  const [prefs, setPrefsState] = useState(readPrefs);
  const [status, setStatus] = useState<TalkStatusResponse | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** whether the Claude chat has had the instructions yet, on the copy-and-paste route */
  const [primed, setPrimed] = useState(false);

  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const nextId = useRef(1);
  const voiceStop = useRef<AbortController | null>(null);
  const mic = useRef<Listening | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });

  const voices = status?.voices ?? [];
  const voice = pickVoice(prefs.voice, voices);
  const direct = status?.claude.state === 'ready';
  const blocked = micUnavailable();
  const recognises = canRecognise();

  useEffect(() => {
    let live = true;
    // Naming the likely voice gets its model loading while the page is read.
    const likely = readPrefs().voice ?? preferredVoice() ?? 'chen';
    talkStatus(likely === SYSTEM ? undefined : likely)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ claude: { state: 'missing' }, voices: [] }));
    return () => {
      live = false;
      voiceStop.current?.abort();
      mic.current?.cancel();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns.length, thinking, heard, status]);

  const say = useCallback(
    async (turn: Turn, slow = false) => {
      voiceStop.current?.abort();
      const stop = new AbortController();
      voiceStop.current = stop;
      setSpeaking(turn.id);
      try {
        await sayTurn(turn.hanzi, voice === SYSTEM ? null : voice, { slow, signal: stop.signal });
      } finally {
        if (voiceStop.current === stop) setSpeaking(null);
      }
    },
    [voice],
  );

  const add = (who: Turn['who'], reply: TalkReply): Turn => {
    const turn = { ...reply, who, id: nextId.current++ };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    return turn;
  };

  const lines = (list: Turn[]): TalkLine[] => list.map((t) => ({ who: t.who, text: t.hanzi }));

  async function ask() {
    setThinking(true);
    setError(null);
    try {
      const reply = await talkReply(lines(turnsRef.current), prefs.level);
      void say(add('tutor', reply));
    } catch (e) {
      setError((e as Error).message);
      // Signed out in the meantime, perhaps: the page switches to the chat route if so.
      void talkStatus().then(setStatus).catch(() => undefined);
    } finally {
      setThinking(false);
    }
  }

  /** The learner's line with the reading of each character, from the app's own dictionary. */
  const learnerLine = (text: string): TalkReply => ({
    hanzi: text,
    pinyin: [...text]
      .filter((c) => HAN.test(c))
      .map((c) => lib.byChar.get(c)?.py[0] ?? '·')
      .join(' '),
    english: '',
  });

  function submit(text: string) {
    const clean = text.trim();
    if (!clean) return;
    add('learner', learnerLine(clean));
    if (direct) void ask();
  }

  function start() {
    unlockAudio();
    voiceStop.current?.abort();
    turnsRef.current = [];
    setTurns([]);
    setPrimed(false);
    setError(null);
    if (direct) void ask();
  }

  function toggleMic() {
    if (listening) {
      mic.current?.stop();
      return;
    }
    unlockAudio();
    voiceStop.current?.abort();
    setError(null);
    setHeard('');
    setListening(true);
    const session = listen(setHeard);
    mic.current = session;
    session.result
      .then((text) => submit(text))
      .catch((e: Error) => {
        if (e.message !== 'aborted') setError(RECOGNITION_MESSAGE[e.message] ?? `Speech recognition stopped (${e.message}).`);
      })
      .finally(() => {
        if (mic.current === session) mic.current = null;
        setListening(false);
        setHeard('');
      });
  }

  // Space is the microphone, when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== 'Space' || t.closest('input, textarea, select, button, [contenteditable]')) return;
      e.preventDefault();
      toggleMic();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // On the chat route: what the learner has said since Claude last spoke.
  const unanswered = useMemo(() => {
    const lastTutor = turns.map((t) => t.who).lastIndexOf('tutor');
    return turns.slice(lastTutor + 1);
  }, [turns]);
  // Claude's turn is due when nothing has been said yet (it opens), or the learner spoke last.
  const relayDue = status !== null && !direct && (turns.length === 0 || turns[turns.length - 1]!.who === 'learner');
  const opening = !primed || turns.length === 0;

  async function copyForClaude() {
    unlockAudio();
    const text = opening ? relayOpening(prefs.level, lines(turns)) : relayTurn(lines(unanswered));
    if (await copyText(text)) {
      setPrimed(true);
      toast(opening ? 'Copied — paste it into a new Claude chat' : 'Copied — paste it into your Claude chat');
    } else {
      toast('Could not copy. Select the text by hand.');
    }
  }

  function takePasted(raw: string) {
    const reply = parseReply(raw);
    if (!reply) {
      setError('There is no Chinese in what was pasted. Copy Claude’s whole answer and paste it again.');
      return false;
    }
    unlockAudio();
    setError(null);
    setPrimed(true);
    void say(add('tutor', reply));
    return true;
  }

  const lastTutor = [...turns].reverse().find((t) => t.who === 'tutor');
  const voiceName = voice === SYSTEM ? 'The system voice' : (voices.find((v) => v.id === voice)?.name ?? voice);
  const state = listening
    ? 'Listening… tap again when you have finished.'
    : thinking
      ? 'Claude is writing…'
      : speaking !== null
        ? `${voiceName} is speaking… tap the microphone to cut in.`
        : relayDue && turns.length > 0
          ? 'Claude’s turn — through your Claude chat, below.'
          : turns.length
            ? 'Your turn. Tap the microphone and answer out loud.'
            : '';

  return (
    <section className="pinyin talk">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.pinyin()}>
          ← Pronunciation
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>Conversation</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Claude asks, you answer out loud, and it answers back in a voice.
          </p>
        </div>
        <div className="spacer" />
        <Seg value={prefs.level} options={LEVELS} onChange={(level) => setPrefs({ level })} size="sm" label="Level" />
      </div>

      {status && !direct && <p className="notice talk-notice">{RELAY_NOTE[status.claude.state as Exclude<ClaudeState, 'ready'>]}</p>}

      <div className="voice-picker talk-options">
        <span className="tiny muted">Voice</span>
        <div className="chips">
          {voices.map((v) => (
            <button key={v.id} className="chip" aria-pressed={voice === v.id} onClick={() => setPrefs({ voice: v.id })}>
              {v.name}
              <span className="count">{v.gender === 'female' ? '♀' : '♂'}</span>
            </button>
          ))}
          <button className="chip" aria-pressed={voice === SYSTEM} onClick={() => setPrefs({ voice: SYSTEM })}>
            System
          </button>
        </div>
        <span className="tiny muted talk-show">Show</span>
        <div className="chips">
          <button className="chip" aria-pressed={prefs.pinyin} onClick={() => setPrefs({ pinyin: !prefs.pinyin })}>
            Pinyin
          </button>
          <button className="chip" aria-pressed={prefs.english} onClick={() => setPrefs({ english: !prefs.english })}>
            English
          </button>
        </div>
      </div>

      <div className="talk-thread" data-pinyin={prefs.pinyin ? undefined : 'off'}>
        {turns.length === 0 && !thinking && (
          <div className="empty talk-empty">
            <span className="big">聊</span>
            <p>
              Claude opens with a question about something everyday. Answer out loud — a few words is plenty, and
              nobody minds a mistake.
            </p>
            {direct ? (
              <button className="btn primary" onClick={start} disabled={!status}>
                Start
              </button>
            ) : (
              status && <p className="small muted">Start by copying the opening for your Claude chat, below.</p>
            )}
          </div>
        )}

        {turns.map((t) => (
          <TurnView
            key={t.id}
            turn={t}
            english={prefs.english}
            speaking={speaking === t.id}
            onSay={(slow) => {
              unlockAudio();
              void say(t, slow);
            }}
          />
        ))}

        {thinking && (
          <div className="talk-turn" data-who="tutor">
            <div className="talk-bubble talk-pending tiny muted">Claude is writing…</div>
          </div>
        )}
        {listening && (
          <div className="talk-turn" data-who="learner">
            <div className="talk-bubble talk-live hanzi" lang="zh-CN">
              {heard || '…'}
            </div>
          </div>
        )}
      </div>

      {relayDue && (
        <RelayCard
          first={opening}
          onCopy={() => void copyForClaude()}
          onPaste={takePasted}
          waitingFor={unanswered.length}
        />
      )}
      {/* Scrolled to after every turn; its margin keeps what it reveals clear of the microphone. */}
      <div ref={endRef} className="talk-end" />

      <div className="talk-composer">
        {error && <p className="notice speak-notice">{error}</p>}
        {!recognises ? (
          <p className="notice speak-notice">
            This browser has no speech recognition, so type your answers instead. Safari on the iPad and Chrome both
            have it.
          </p>
        ) : (
          blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>
        )}
        <p className="tiny muted talk-state" aria-live="polite">
          {state}
        </p>
        <div className="speak-controls">
          <button
            className="btn speak-side"
            disabled={!lastTutor}
            onClick={() => {
              unlockAudio();
              if (lastTutor) void say(lastTutor);
            }}
          >
            <span aria-hidden>🔊</span> Again
          </button>
          <RecordButton
            state={listening ? 'listening' : 'idle'}
            level={0}
            onToggle={toggleMic}
            disabled={!recognises || !!blocked || thinking}
          />
          <button className="btn speak-side" onClick={start} disabled={!status || thinking}>
            New topic
          </button>
        </div>
        <form
          className="talk-type"
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            submit(draft);
            setDraft('');
          }}
        >
          <input
            type="text"
            lang="zh-CN"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Or type your answer in Chinese"
            aria-label="Your answer"
            disabled={thinking}
          />
          <button className="btn" disabled={!draft.trim() || thinking}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

/** One turn: each character with its syllable above, the translation under, and a way to hear it again. */
function TurnView({
  turn,
  english,
  speaking,
  onSay,
}: {
  turn: Turn;
  english: boolean;
  speaking: boolean;
  onSay: (slow: boolean) => void;
}) {
  const syllables = turn.pinyin
    .replace(/[^\p{L}\p{M}\s·]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const hanCount = [...turn.hanzi].filter((c) => HAN.test(c)).length;
  // Claude is asked for a syllable per character; when it wrote words together instead, the line goes above whole.
  const aligned = syllables.length === hanCount;
  let k = 0;
  return (
    <div className="talk-turn" data-who={turn.who}>
      <div className="talk-bubble" data-speaking={speaking || undefined}>
        {!aligned && turn.pinyin && <p className="talk-py">{turn.pinyin}</p>}
        <div className="talk-line" lang="zh-CN">
          {[...turn.hanzi].map((ch, i) =>
            HAN.test(ch) ? (
              <span key={i} className="shadow-char">
                {aligned && <i>{syllables[k++]}</i>}
                <b>{ch}</b>
              </span>
            ) : (
              <span key={i} className="shadow-punct">
                {ch}
              </span>
            ),
          )}
        </div>
        {english && turn.english && <p className="talk-en">{turn.english}</p>}
      </div>
      {turn.who === 'tutor' && (
        <div className="talk-actions">
          <button className="btn ghost sm" onClick={() => onSay(false)}>
            <span aria-hidden>🔊</span> Again
          </button>
          <button className="btn ghost sm" onClick={() => onSay(true)}>
            Slowly
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Claude's turn by hand, where the server cannot ask it: copy, paste into the
 * Claude chat, copy the answer, paste it here. The first copy carries the
 * instructions; after that only what the learner has said since.
 */
function RelayCard({
  first,
  waitingFor,
  onCopy,
  onPaste,
}: {
  first: boolean;
  waitingFor: number;
  onCopy: () => void;
  onPaste: (raw: string) => boolean;
}) {
  const [text, setText] = useState('');
  const take = (raw: string) => {
    if (onPaste(raw)) setText('');
  };
  return (
    <div className="card talk-relay">
      <header>
        <h2>{first ? 'Open the conversation in your Claude chat' : 'Claude’s turn, in your Claude chat'}</h2>
      </header>
      <div className="body">
        <ol className="talk-steps small">
          <li>
            <button className="btn sm primary" onClick={onCopy}>
              {first ? 'Copy the opening' : waitingFor > 1 ? `Copy your ${waitingFor} lines` : 'Copy your line'}
            </button>{' '}
            <span className="muted">
              {first ? 'Instructions and all — paste it into a new chat.' : 'Paste it into the same chat as before.'}
            </span>
          </li>
          <li>Send it, then copy Claude’s whole answer.</li>
          <li>
            <textarea
              className="talk-paste"
              rows={3}
              lang="zh-CN"
              placeholder="Paste Claude’s answer here"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const raw = e.clipboardData.getData('text');
                if (raw) {
                  e.preventDefault();
                  take(raw);
                }
              }}
            />
            <button className="btn sm" disabled={!text.trim()} onClick={() => take(text)}>
              Use this answer
            </button>
          </li>
        </ol>
      </div>
    </div>
  );
}
