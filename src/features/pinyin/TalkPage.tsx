import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  parseReply,
  relayOpening,
  relayTurn,
  type ClaudeState,
  type TalkConversation,
  type TalkLine,
  type TalkOptions,
  type TalkReply,
  type TalkSavedTurn,
  type TalkStatusResponse,
  type TalkWord,
} from '../../../shared/talk';
import { openConversation, saveConversation, talkReply, talkStatus } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { canRecognise, listen, RECOGNITION_MESSAGE, type Listening } from '../../platform/audio/recognition';
import { copyText } from '../../platform/clipboard';
import { useStore } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { Portrait, SelfMark } from './Portrait';
import { RecordButton } from './RecordButton';
import { readPrefs, SYSTEM } from './talkPrefs';
import { sayTurn } from './talkOut';
import { unlockAudio } from './voiceOut';
import './pinyin.css';

interface Turn extends TalkReply {
  id: number;
  who: 'tutor' | 'learner';
}

const HAN = /[㐀-鿿]/;

const RELAY_NOTE: Record<Exclude<ClaudeState, 'ready'>, string> = {
  'signed-out':
    'Claude Code on the computer running this app is not signed in, so for now each turn goes through your own Claude chat. Sign it in once with your Claude subscription — claude auth login in a terminal there — and this page will ask Claude by itself.',
  'api-key':
    'Claude Code on the computer running this app is signed in with an API key, which is billed on top of your subscription, so it is not used. Sign it in to your subscription instead (claude auth logout, then claude auth login). Until then, each turn goes through your own Claude chat.',
  missing:
    'This server cannot ask Claude by itself — that only works on the computer at home, where Claude Code runs. Each turn goes through your own Claude chat instead: copy, paste, and paste the answer back.',
};

/**
 * One conversation with Claude, out loud.
 *
 * The page is the conversation and nothing else. What kind of conversation it
 * is was settled on the page before this one and travels with the record — the
 * level, the length of a turn, the topic, the voice — so coming back to it a
 * week later picks up the same conversation rather than the same history under
 * today's settings.
 *
 * Claude opens with a question; the learner answers by speaking; speech
 * recognition writes down what it heard in characters — itself a check on
 * pronunciation, since a native-trained ear wrote it — and Claude answers
 * that, in a voice.
 *
 * Claude is reached through the learner's subscription, never a paid API key.
 * At home the server runs Claude Code for each turn. Where it cannot (the
 * Vercel site), the learner carries each turn to their own Claude chat and
 * pastes the answer back — clumsier, but the same conversation.
 */
export function TalkPage() {
  const { conversationId = '' } = useParams();
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const guidedPace = useStore((st) => st.settings.guidedPace);
  const silenceStop = useStore((st) => st.settings.silenceStop);

  const [record, setRecord] = useState<TalkConversation | null>(null);
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
  const [gone, setGone] = useState(false);
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

  const options: TalkOptions | null = record?.options ?? null;
  const voice = record?.voice ?? null;
  const showPinyin = readPrefs().pinyin;
  const showEnglish = readPrefs().english;
  const direct = status?.claude.state === 'ready';
  const blocked = micUnavailable();
  const recognises = canRecognise();

  useTitle(record ? record.title : 'Conversation');

  // The record first, then the status — naming the conversation's own voice so
  // its model is loading while the thread is being read.
  useEffect(() => {
    let live = true;
    openConversation(conversationId)
      .then((c) => {
        if (!live) return;
        setRecord(c);
        nextId.current = c.turns.length + 1;
        setTurns(c.turns.map((t, i) => ({ ...t, id: i + 1 })));
        return talkStatus(c.voice && c.voice !== SYSTEM ? c.voice : undefined);
      })
      .then((s) => s && live && setStatus(s))
      .catch(() => {
        if (!live) return;
        setGone(true);
      });
    return () => {
      live = false;
      voiceStop.current?.abort();
      mic.current?.cancel();
    };
  }, [conversationId]);

  // A conversation with nothing in it has only just been started: Claude opens it.
  const opened = useRef(false);
  useEffect(() => {
    if (!record || !status || opened.current) return;
    opened.current = true;
    if (record.turns.length === 0 && status.claude.state === 'ready') void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, status]);

  const started = turns.length > 0 || thinking;
  useEffect(() => {
    if (!started) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [started, turns.length, thinking, showHints]);

  // The composer sits over the foot of the thread, and how much of it it covers
  // changes with a notice or the hints: the last turn is scrolled clear of
  // whatever height it happens to have.
  useEffect(() => {
    const composer = composerRef.current;
    const page = pageRef.current;
    if (!composer || !page || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(([entry]) => {
      const height = entry!.borderBoxSize?.[0]?.blockSize ?? entry!.target.getBoundingClientRect().height;
      page.style.setProperty('--composer-height', `${Math.round(height)}px`);
    });
    watch.observe(composer);
    return () => watch.disconnect();
  }, []);

  /** Says something in the conversation's voice, stopping whatever was being said. */
  const say = useCallback(
    async (text: string, opts: { pace?: number; mark?: number } = {}) => {
      voiceStop.current?.abort();
      const stop = new AbortController();
      voiceStop.current = stop;
      if (opts.mark !== undefined) setSpeaking(opts.mark);
      setWaitingForVoice(true);
      try {
        await sayTurn(text, voice === SYSTEM ? null : voice, {
          pace: opts.pace,
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

  /**
   * The thread as it now stands, written down. Every turn, so that closing the
   * iPad mid-conversation loses at most the turn being spoken — and quietly,
   * since a save that failed is worth knowing about but not worth stopping a
   * conversation for.
   */
  const keep = useCallback(
    (list: Turn[]) => {
      if (!record) return;
      const saved: TalkSavedTurn[] = list.map(({ id: _id, ...rest }) => rest);
      saveConversation(record.id, { options: record.options, voice: record.voice, turns: saved })
        .then((c) => setRecord((was) => (was ? { ...was, title: c.title, updatedAt: c.updatedAt } : was)))
        .catch(() => setError('That turn is not saved — the conversation carries on, but check your connection.'));
    },
    [record],
  );

  const add = (who: Turn['who'], reply: TalkReply): Turn => {
    const turn = { ...reply, who, id: nextId.current++ };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    setShowHints(false);
    keep(turnsRef.current);
    return turn;
  };

  const lines = (list: Turn[]): TalkLine[] => list.map((t) => ({ who: t.who, text: t.hanzi }));

  async function ask() {
    if (!options) return;
    setThinking(true);
    setError(null);
    try {
      const reply = await talkReply(lines(turnsRef.current), options);
      const turn = add('tutor', reply);
      void say(turn.hanzi, { mark: turn.id });
    } catch (e) {
      setError((e as Error).message);
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
    // Quiet ends it: once the words stop coming, the turn is over. Watching the
    // words rather than the microphone is what lets it work in a noisy room.
    const session = listen(setHeard, 45_000, silenceStop > 0 ? silenceStop * 1000 : 0);
    mic.current = session;
    session.result
      // Straight into the box, the way a messenger does it: it can be read,
      // corrected and sent from there without a second thing to confirm.
      .then((text) => setDraft(text))
      .catch((e: Error) => {
        if (e.message !== 'aborted' && e.message !== 'no-speech')
          setError(RECOGNITION_MESSAGE[e.message] ?? `Speech recognition stopped (${e.message}).`);
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
  const relayDue = status !== null && !direct && (turns.length === 0 || turns[turns.length - 1]!.who === 'learner');
  const opening = !primed || turns.length === 0;

  async function copyForClaude() {
    if (!options) return;
    unlockAudio();
    const text = opening ? relayOpening(options, lines(turns)) : relayTurn(lines(unanswered));
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

  if (gone) {
    return (
      <section className="pinyin talk">
        <div className="empty">
          <p>That conversation is not here any more.</p>
          <Link className="btn primary" to={paths.speakingNew()}>
            Start a new one
          </Link>
        </div>
      </section>
    );
  }

  const lastTutor = [...turns].reverse().find((t) => t.who === 'tutor');
  const hints = turns[turns.length - 1]?.who === 'tutor' ? (lastTutor?.hints ?? []) : [];
  const partner = status?.voices.find((v) => v.id === voice);
  const waiting = !listening && !!draft.trim();

  return (
    <section className="pinyin talk" ref={pageRef}>
      <div className="row talk-head">
        <Link className="btn ghost sm" to={paths.speakingNew()}>
          ← Conversations
        </Link>
        <div className="spacer" />
        <button className="btn sm" onClick={() => void navigate(paths.speakingNew())}>
          New topic
        </button>
      </div>

      {status && !direct && <p className="notice talk-notice">{RELAY_NOTE[status.claude.state as Exclude<ClaudeState, 'ready'>]}</p>}

      <div className="talk-thread" data-pinyin={showPinyin ? undefined : 'off'}>
        {turns.map((t) => (
          <TurnView
            key={t.id}
            turn={t}
            english={showEnglish}
            voice={voice ?? SYSTEM}
            gender={partner?.gender}
            speaking={speaking === t.id && !waitingForVoice}
            guidedPace={guidedPace}
            onSay={(text, pace) => {
              unlockAudio();
              void say(text, { pace, mark: text === t.hanzi ? t.id : undefined });
            }}
          />
        ))}

        {thinking && (
          <div className="talk-turn" data-who="tutor">
            <Portrait voice={voice ?? SYSTEM} gender={partner?.gender} mood="thinking" size="sm" />
            <div className="talk-said">
              <div className="talk-bubble talk-pending tiny muted">Claude is writing…</div>
            </div>
          </div>
        )}
      </div>

      {relayDue && turns.length > 0 && (
        <RelayCard first={opening} onCopy={() => void copyForClaude()} onPaste={takePasted} waitingFor={unanswered.length} />
      )}
      <div ref={endRef} className="talk-end" />

      <div className="talk-composer" ref={composerRef}>
        {error && <p className="notice speak-notice">{error}</p>}
        {recognises && blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

        {/* What is being heard, while it is being heard: over the composer, out
            of the thread. It is not a turn — it has not been said yet, and a
            bubble on the right among the turns that have claimed it was. */}
        {listening && (
          <div className="talk-hearing" aria-live="polite">
            <span className="talk-hearing-dot" aria-hidden />
            <span className="talk-hearing-text hanzi" lang="zh-CN">
              {heard || 'Listening…'}
            </span>
          </div>
        )}

        {hints.length > 0 && (
          <div className="talk-tools">
            <div className="talk-help">
              {showHints && (
                <div className="talk-help-pop" role="dialog" aria-label="Things you could say">
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
              <button
                className="btn ghost sm"
                aria-expanded={showHints}
                aria-haspopup="dialog"
                onClick={() => setShowHints((v) => !v)}
              >
                {showHints ? 'Hide help' : 'Help'}
              </button>
            </div>
          </div>
        )}

        <form
          className="talk-type"
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            submit(draft);
            setDraft('');
          }}
        >
          <RecordButton
            state={listening ? 'listening' : 'idle'}
            level={0}
            onToggle={toggleMic}
            disabled={!recognises || !!blocked || thinking}
            compact
          />
          <input
            type="text"
            lang="zh-CN"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={recognises ? 'Say it, or type your answer' : 'Type your answer in Chinese'}
            aria-label="Your answer"
            disabled={thinking}
          />
          <button className={`btn${waiting ? ' primary' : ''}`} disabled={!draft.trim() || thinking}>
            Send
          </button>
        </form>
      </div>
    </section>
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

/**
 * One turn: who said it, each character with its syllable above, and what was
 * asked for underneath. The face beside a turn is the voice that read it —
 * and it holds still unless it is the one speaking now, since a thread of
 * twenty breathing portraits is movement nobody asked for.
 */
function TurnView({
  turn,
  english,
  voice,
  gender,
  speaking,
  guidedPace,
  onSay,
}: {
  turn: Turn;
  english: boolean;
  voice: string;
  gender?: 'female' | 'male';
  speaking: boolean;
  guidedPace: number;
  onSay: (text: string, pace?: number) => void;
}) {
  return (
    <div className="talk-turn" data-who={turn.who}>
      {turn.who === 'tutor' ? (
        <Portrait voice={voice} gender={gender} mood={speaking ? 'speaking' : 'idle'} size="sm" still={!speaking} />
      ) : (
        <SelfMark />
      )}
      <div className="talk-said">
        <div className="talk-bubble" data-speaking={speaking || undefined}>
          <HanziLine hanzi={turn.hanzi} pinyin={turn.pinyin} />
          {english && turn.english && <p className="talk-en">{turn.english}</p>}
          {turn.note && <p className="talk-note small">{turn.note}</p>}
        </div>
        {turn.words && turn.words.length > 0 && (
          <div className="talk-words">
            {turn.words.map((w, i) => (
              <WordChip key={i} word={w} onSay={() => onSay(w.hanzi)} />
            ))}
          </div>
        )}
        {turn.who === 'tutor' && (
          <div className="talk-actions">
            <button className="btn ghost sm" onClick={() => onSay(turn.hanzi)}>
              <span aria-hidden>🔊</span> Listen
            </button>
            {/* The same reading, stretched — not a second, more laboured one.
                How far is set in Settings, because how slow is slow enough is
                a fact about the listener. */}
            <button
              className="btn ghost sm"
              onClick={() => onSay(turn.hanzi, guidedPace)}
              title="The same line, more slowly"
            >
              Guided
            </button>
          </div>
        )}
      </div>
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
