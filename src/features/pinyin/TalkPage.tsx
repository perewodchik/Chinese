import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  DEFAULT_OPTIONS,
  parseReply,
  relayOpening,
  relayTurn,
  TALK_TOPIC_MAX_CHARS,
  type ClaudeState,
  type TalkLength,
  type TalkLevel,
  type TalkLine,
  type TalkOptions,
  type TalkReply,
  type TalkStatusResponse,
  type TalkVoice,
  type TalkWord,
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

/** What the page remembers between visits, on this device: how to talk, and how to show it. */
interface Prefs extends TalkOptions {
  /** a local voice by id, or 'system' */
  voice: string | null;
  pinyin: boolean;
  english: boolean;
}

const PREFS_KEY = 'hanzi.talk.v1';
const FALLBACK: Prefs = { ...DEFAULT_OPTIONS, voice: null, pinyin: true, english: false };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...FALLBACK, ...(JSON.parse(raw) as Partial<Prefs>) } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private browsing: remembered for this visit only.
  }
}

const optionsOf = ({ level, length, explain, words, hints, topic }: Prefs): TalkOptions => ({
  level,
  length,
  explain,
  words,
  hints,
  topic,
});

const LEVELS: ReadonlyArray<{ id: TalkLevel; label: string }> = [
  { id: 'hsk1', label: 'HSK 1' },
  { id: 'hsk2', label: 'HSK 2' },
  { id: 'hsk3', label: 'HSK 3' },
];

const LENGTHS: ReadonlyArray<{ id: TalkLength; label: string; title: string }> = [
  { id: 'short', label: 'Short', title: 'One sentence a turn' },
  { id: 'normal', label: 'Normal', title: 'One or two sentences a turn' },
  { id: 'long', label: 'Long', title: 'Three or four short sentences a turn' },
];

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
 * What they get with the answer is theirs to choose: how long a turn is,
 * whether the grammar is explained, the new words in it, and — for when the
 * next thing to say will not come — two or three things they could say. All
 * of it is asked for in the same turn, so none of it costs a second wait.
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
  /** the voice has been asked for but has not started: the model may be loading */
  const [waitingForVoice, setWaitingForVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  /** whether the Claude chat has had the instructions yet, on the copy-and-paste route */
  const [primed, setPrimed] = useState(false);

  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const nextId = useRef(1);
  const voiceStop = useRef<AbortController | null>(null);
  const mic = useRef<Listening | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);

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
  }, [turns.length, thinking, heard, status, showHints]);

  // The microphone sits over the foot of the thread, and how much of it it
  // covers changes with a notice or the hints: the last turn is scrolled
  // clear of whatever height it happens to have.
  useEffect(() => {
    const composer = composerRef.current;
    const page = pageRef.current;
    if (!composer || !page || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(([entry]) => {
      page.style.setProperty('--composer-height', `${Math.round(entry!.contentRect.height)}px`);
    });
    watch.observe(composer);
    return () => watch.disconnect();
  }, []);

  /** Says something in the chosen voice, stopping whatever was being said. `mark` lights up a turn while it speaks. */
  const say = useCallback(
    async (text: string, opts: { slow?: boolean; mark?: number } = {}) => {
      voiceStop.current?.abort();
      const stop = new AbortController();
      voiceStop.current = stop;
      if (opts.mark !== undefined) setSpeaking(opts.mark);
      setWaitingForVoice(true);
      try {
        await sayTurn(text, voice === SYSTEM ? null : voice, {
          slow: opts.slow,
          signal: stop.signal,
          onStart: () => voiceStop.current === stop && setWaitingForVoice(false),
        });
      } finally {
        if (voiceStop.current === stop) {
          setSpeaking(null);
          setWaitingForVoice(false);
        }
      }
    },
    [voice],
  );

  const add = (who: Turn['who'], reply: TalkReply): Turn => {
    const turn = { ...reply, who, id: nextId.current++ };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    setShowHints(false);
    return turn;
  };

  const lines = (list: Turn[]): TalkLine[] => list.map((t) => ({ who: t.who, text: t.hanzi }));

  async function ask() {
    setThinking(true);
    setError(null);
    try {
      const reply = await talkReply(lines(turnsRef.current), optionsOf(prefs));
      const turn = add('tutor', reply);
      void say(turn.hanzi, { mark: turn.id });
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
      // Not sent yet: what it heard goes to the draft, to be read, said
      // again or thrown away first. A sentence said wrong is the common case.
      .then((text) => setDraft(text))
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
    const text = opening ? relayOpening(optionsOf(prefs), lines(turns)) : relayTurn(lines(unanswered));
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
    const turn = add('tutor', reply);
    void say(turn.hanzi, { mark: turn.id });
    return true;
  }

  const lastTutor = [...turns].reverse().find((t) => t.who === 'tutor');
  const hints = turns[turns.length - 1]?.who === 'tutor' ? (lastTutor?.hints ?? []) : [];
  const voiceName = voice === SYSTEM ? 'The system voice' : (voices.find((v) => v.id === voice)?.name ?? voice);
  const waiting = !listening && !!draft.trim();
  const state = listening
    ? 'Listening… tap again when you have finished.'
    : waiting
      ? 'Check what it heard, then send it — or say it again.'
    : thinking
      ? 'Claude is writing…'
      : speaking !== null
        ? waitingForVoice
          ? `${voiceName} is getting ready… the first line of a sitting takes a few seconds.`
          : `${voiceName} is speaking… tap the microphone to cut in.`
        : relayDue && turns.length > 0
          ? 'Claude’s turn — through your Claude chat, below.'
          : turns.length
            ? 'Your turn. Tap the microphone and answer out loud.'
            : '';

  return (
    <section className="pinyin talk" ref={pageRef}>
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

      <div className="talk-options">
        <div className="voice-picker">
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
        <div className="voice-picker">
          <span className="tiny muted">Answers</span>
          <Seg value={prefs.length} options={LENGTHS} onChange={(length) => setPrefs({ length })} size="sm" label="How long Claude's turns are" />
          <div className="chips">
            <button
              className="chip"
              aria-pressed={prefs.words}
              title="The words in Claude's turn that are probably new to you"
              onClick={() => setPrefs({ words: !prefs.words })}
            >
              New words
            </button>
            <button
              className="chip"
              aria-pressed={prefs.hints}
              title="Two or three things you could say back, for when you are stuck"
              onClick={() => setPrefs({ hints: !prefs.hints })}
            >
              Hints
            </button>
            <button
              className="chip"
              aria-pressed={prefs.explain}
              title="A line of English about the grammar in each of Claude's turns"
              onClick={() => setPrefs({ explain: !prefs.explain })}
            >
              Explain
            </button>
          </div>
        </div>
      </div>

      <div className="talk-thread" data-pinyin={prefs.pinyin ? undefined : 'off'}>
        {turns.length === 0 && !thinking && (
          <div className="talk-start">
            <div className="empty talk-empty">
              <span className="big">聊</span>
              <p>
                Claude opens with a question, you answer out loud — a few words is plenty, and nobody minds a
                mistake.
              </p>
            </div>
            <TopicPicker topic={prefs.topic} themes={lib.themes} onPick={(topic) => setPrefs({ topic })} />
            {direct ? (
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={start} disabled={!status}>
                  Start
                </button>
              </div>
            ) : (
              status && <p className="small muted talk-start-note">Start by copying the opening for your Claude chat, below.</p>
            )}
          </div>
        )}

        {turns.map((t) => (
          <TurnView
            key={t.id}
            turn={t}
            english={prefs.english}
            speaking={speaking === t.id}
            onSay={(text, slow) => {
              unlockAudio();
              void say(text, { slow, mark: text === t.hanzi ? t.id : undefined });
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
        {waiting && (
          <div className="talk-turn" data-who="learner">
            <div className="talk-bubble talk-draft">
              <HanziLine {...learnerLine(draft)} />
            </div>
            <div className="talk-actions">
              <button className="btn ghost sm" onClick={toggleMic} disabled={!recognises || !!blocked}>
                Say it again
              </button>
              <button className="btn ghost sm" onClick={() => setDraft('')}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {relayDue && (
        <RelayCard first={opening} onCopy={() => void copyForClaude()} onPaste={takePasted} waitingFor={unanswered.length} />
      )}
      {/* Scrolled to after every turn; its margin keeps what it reveals clear of the microphone. */}
      <div ref={endRef} className="talk-end" />

      <div className="talk-composer" ref={composerRef}>
        {error && <p className="notice speak-notice">{error}</p>}
        {!recognises ? (
          <p className="notice speak-notice">
            This browser has no speech recognition, so type your answers instead. Safari on the iPad and Chrome both
            have it.
          </p>
        ) : (
          blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>
        )}

        {showHints && hints.length > 0 && (
          <div className="talk-hints">
            {hints.map((h, i) => (
              <div key={i} className="talk-hint">
                <button
                  className="talk-hint-say"
                  title="Use this one"
                  onClick={() => {
                    setDraft(h.hanzi);
                    setShowHints(false);
                  }}
                >
                  <span className="hanzi" lang="zh-CN">
                    {h.hanzi}
                  </span>
                  <span className="talk-hint-py">{h.pinyin}</span>
                  {h.english && <span className="tiny muted">{h.english}</span>}
                </button>
                <button
                  className="btn ghost talk-hint-hear"
                  aria-label={`Hear ${h.hanzi}`}
                  title="Hear it"
                  onClick={() => {
                    unlockAudio();
                    void say(h.hanzi);
                  }}
                >
                  <span aria-hidden>🔊</span>
                </button>
              </div>
            ))}
          </div>
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
              if (lastTutor) void say(lastTutor.hanzi, { mark: lastTutor.id });
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
          {hints.length > 0 ? (
            <button className="btn speak-side" aria-pressed={showHints} onClick={() => setShowHints((v) => !v)}>
              {showHints ? 'Hide hints' : 'What could I say?'}
            </button>
          ) : (
            <button className="btn speak-side" onClick={start} disabled={!status || thinking}>
              New topic
            </button>
          )}
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
          <button className={`btn${waiting ? ' primary' : ''}`} disabled={!draft.trim() || thinking}>
            Send
          </button>
          {hints.length > 0 && turns.length > 0 && (
            <button type="button" className="btn ghost" onClick={start} disabled={!status || thinking}>
              New topic
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

/**
 * What to talk about, before the conversation starts: the app's own topics as
 * chips, or anything at all in the learner's own words. Shown only on an
 * empty thread — mid-conversation the way to change the subject is to say so,
 * or to start a new one.
 */
function TopicPicker({
  topic,
  themes,
  onPick,
}: {
  topic: string;
  themes: Array<{ id: string; name: string }>;
  onPick: (topic: string) => void;
}) {
  return (
    <div className="talk-topics">
      <span className="tiny muted">Topic</span>
      <div className="chips">
        <button className="chip" aria-pressed={!topic} onClick={() => onPick('')}>
          Anything
        </button>
        {themes.slice(0, 10).map((t) => (
          <button key={t.id} className="chip" aria-pressed={topic === t.name} onClick={() => onPick(t.name)}>
            {t.name}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="talk-topic-own"
        value={topic}
        maxLength={TALK_TOPIC_MAX_CHARS}
        placeholder="Or something of your own"
        aria-label="What to talk about"
        onChange={(e) => onPick(e.target.value)}
      />
    </div>
  );
}

/**
 * A line of Chinese as a reader sets it: each character with its syllable
 * above. When the syllables do not come one to a character — Claude wrote a
 * word together — the pinyin goes above the line whole rather than wrongly
 * under the characters.
 */
function HanziLine({ hanzi, pinyin }: { hanzi: string; pinyin: string }) {
  const syllables = pinyin
    .replace(/[^\p{L}\p{M}\s·]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const aligned = syllables.length === [...hanzi].filter((c) => HAN.test(c)).length;
  let k = 0;
  return (
    <>
      {!aligned && pinyin && <p className="talk-py">{pinyin}</p>}
      <div className="talk-line" lang="zh-CN">
        {[...hanzi].map((ch, i) =>
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
    </>
  );
}

/** One turn: each character with its syllable above, and what was asked for underneath. */
function TurnView({
  turn,
  english,
  speaking,
  onSay,
}: {
  turn: Turn;
  english: boolean;
  speaking: boolean;
  onSay: (text: string, slow: boolean) => void;
}) {
  return (
    <div className="talk-turn" data-who={turn.who}>
      <div className="talk-bubble" data-speaking={speaking || undefined}>
        <HanziLine hanzi={turn.hanzi} pinyin={turn.pinyin} />
        {english && turn.english && <p className="talk-en">{turn.english}</p>}
        {turn.note && <p className="talk-note small">{turn.note}</p>}
      </div>
      {turn.words && turn.words.length > 0 && (
        <div className="talk-words">
          {turn.words.map((w, i) => (
            <WordChip key={i} word={w} onSay={() => onSay(w.hanzi, false)} />
          ))}
        </div>
      )}
      {turn.who === 'tutor' && (
        <div className="talk-actions">
          <button className="btn ghost sm" onClick={() => onSay(turn.hanzi, false)}>
            <span aria-hidden>🔊</span> Again
          </button>
          <button className="btn ghost sm" onClick={() => onSay(turn.hanzi, true)}>
            Slowly
          </button>
        </div>
      )}
    </div>
  );
}

/** A new word: tap it to hear it on its own. */
function WordChip({ word, onSay }: { word: TalkWord; onSay: () => void }) {
  return (
    <button className="talk-word" onClick={onSay} title="Hear it">
      <span className="talk-word-han hanzi" lang="zh-CN">
        {word.hanzi}
      </span>
      <span className="talk-word-py">{word.pinyin}</span>
      <span className="talk-word-en tiny muted">{word.english}</span>
    </button>
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
