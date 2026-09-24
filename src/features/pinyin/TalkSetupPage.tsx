import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  TALK_TOPIC_MAX_CHARS,
  type ClaudeState,
  type TalkConversationSummary,
  type TalkStatusResponse,
} from '../../../shared/talk';
import { deleteConversation, listConversations, startConversation, talkStatus } from '../../api/talk';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { Portrait } from './Portrait';
import { LEVELS, LENGTHS, optionsOf, pickVoice, readPrefs, SYSTEM, writePrefs, type TalkPrefs } from './talkPrefs';
import { unlockAudio } from '../../platform/audio/voiceOut';
import './pinyin.css';

const RELAY_NOTE: Record<Exclude<ClaudeState, 'ready'>, string> = {
  'signed-out':
    'Claude Code on the computer running this app is not signed in, so for now each turn goes through your own Claude chat. Sign it in once with your Claude subscription — claude auth login in a terminal there — and this page will ask Claude by itself.',
  'api-key':
    'Claude Code on the computer running this app is signed in with an API key, which is billed on top of your subscription, so it is not used. Sign it in to your subscription instead (claude auth logout, then claude auth login). Until then, each turn goes through your own Claude chat.',
  missing:
    'This server cannot ask Claude by itself — that only works on the computer at home, where Claude Code runs. Each turn goes through your own Claude chat instead: copy, paste, and paste the answer back.',
};

/**
 * Setting a conversation up, before there is one.
 *
 * Everything that decides what kind of conversation it will be is asked here,
 * on a page of its own, and then got out of the way: who you are talking to,
 * how hard it should be, what about. The conversation itself is the next page,
 * and has nothing on it but the conversation — which is the point of the
 * split. These settings used to sit in a panel above the thread, where they
 * were read once and then scrolled past for the rest of the sitting, taking
 * the top third of an iPad with them.
 *
 * Conversations already had are listed underneath, newest first, because the
 * likeliest reason to be on this page is to carry one on.
 */
export function TalkSetupPage() {
  useTitle('Speaking');
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [prefs, setPrefsState] = useState(readPrefs);
  const [status, setStatus] = useState<TalkStatusResponse | null>(null);
  const [saved, setSaved] = useState<TalkConversationSummary[] | null>(null);
  const [starting, setStarting] = useState(false);

  const setPrefs = (patch: Partial<TalkPrefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });

  useEffect(() => {
    let live = true;
    // Naming the likely voice gets its model loading while the page is read.
    const likely = readPrefs().voice ?? 'chen';
    talkStatus(likely === SYSTEM ? undefined : likely)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ claude: { state: 'missing' }, voices: [] }));
    listConversations()
      .then((c) => live && setSaved(c))
      .catch(() => live && setSaved([]));
    return () => {
      live = false;
    };
  }, []);

  // The partners kept on the Speaking page, in the order they were kept;
  // everybody, until somebody has been.
  const kept = useStore((st) => st.settings.talkVoices);
  const all = status?.voices ?? [];
  const keptVoices = kept.flatMap((id) => all.filter((v) => v.id === id));
  const voices = keptVoices.length ? keptVoices : all;
  const voice = pickVoice(prefs.voice, voices);
  const partner = voices.find((v) => v.id === voice);
  const voiceName = voice === SYSTEM ? 'The system voice' : (partner?.name ?? voice);
  const choices = [...voices, { id: SYSTEM, name: 'System', gender: undefined }];

  async function start() {
    // Woken inside the tap: the conversation's first line is read out on the
    // page after this one, seconds later, and iOS only allows that if audio
    // was started from a gesture.
    unlockAudio();
    setStarting(true);
    try {
      const made = await startConversation(optionsOf(prefs), voice === SYSTEM ? null : voice);
      await navigate(paths.speakingTalk(made.id));
    } catch (e) {
      toast((e as Error).message);
      setStarting(false);
    }
  }

  async function forget(id: string) {
    setSaved((list) => list?.filter((c) => c.id !== id) ?? null);
    try {
      await deleteConversation(id);
    } catch (e) {
      toast((e as Error).message);
      listConversations().then(setSaved).catch(() => undefined);
    }
  }

  return (
    <section className="pinyin talk-setup">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.speaking()}>
          ← Speaking
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>A conversation</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Claude asks, you answer out loud, and it answers back in a voice.
          </p>
        </div>
      </div>

      {status && status.claude.state !== 'ready' && (
        <p className="notice talk-notice">{RELAY_NOTE[status.claude.state as Exclude<ClaudeState, 'ready'>]}</p>
      )}

      <div className="card">
        <header>
          <h2>Who you are talking to</h2>
          <Link className="btn ghost sm" to={`${paths.speaking()}#partners`}>
            {keptVoices.length ? 'Change who is here' : 'Hear them first'}
          </Link>
        </header>
        <div className="body">
          <div className="voice-faces">
            {choices.map((c) => (
              <button
                key={c.id}
                className="voice-face"
                aria-pressed={voice === c.id}
                title={c.id === SYSTEM ? 'The voice built into this device' : `Talk with ${c.name}`}
                onClick={() => setPrefs({ voice: c.id })}
              >
                <Portrait voice={c.id} gender={c.gender} mood="idle" still={voice !== c.id} />
                <span className="voice-face-name">
                  {c.name}
                  {c.gender && <span className="count">{c.gender === 'female' ? '♀' : '♂'}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>What it should be like</h2>
        </header>
        <div className="body opt-panel">
          <div className="opt-row">
            <span className="tiny muted">Level</span>
            <Seg value={prefs.level} options={LEVELS} onChange={(level) => setPrefs({ level })} size="sm" label="Level" />
          </div>
          <div className="opt-row">
            <span className="tiny muted">Answers</span>
            <Seg
              value={prefs.length}
              options={LENGTHS}
              onChange={(length) => setPrefs({ length })}
              size="sm"
              label="How long Claude's turns are"
            />
          </div>
          <div className="opt-row">
            <span className="tiny muted">Show</span>
            <div className="chips">
              <button className="chip" aria-pressed={prefs.pinyin} onClick={() => setPrefs({ pinyin: !prefs.pinyin })}>
                Pinyin
              </button>
              <button className="chip" aria-pressed={prefs.english} onClick={() => setPrefs({ english: !prefs.english })}>
                English
              </button>
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
      </div>

      <div className="card">
        <header>
          <h2>What to talk about</h2>
        </header>
        <div className="body">
          <div className="talk-topics">
            <div className="chips">
              <button className="chip" aria-pressed={!prefs.topic} onClick={() => setPrefs({ topic: '' })}>
                Anything
              </button>
              {lib.themes.slice(0, 10).map((t) => (
                <button
                  key={t.id}
                  className="chip"
                  aria-pressed={prefs.topic === t.name}
                  onClick={() => setPrefs({ topic: t.name })}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="talk-topic-own"
              value={prefs.topic}
              maxLength={TALK_TOPIC_MAX_CHARS}
              placeholder="Or something of your own"
              aria-label="What to talk about"
              onChange={(e) => setPrefs({ topic: e.target.value })}
            />
          </div>
          <div className="row talk-start-row">
            <p className="tiny muted" style={{ margin: 0 }}>
              {voiceName === 'The system voice'
                ? 'The system voice will read the answers.'
                : `${voiceName} will read the answers out.`}
            </p>
            <div className="spacer" />
            <button className="btn primary" onClick={() => void start()} disabled={!status || starting}>
              {starting ? 'Starting…' : 'Start talking'}
            </button>
          </div>
        </div>
      </div>

      <SavedList conversations={saved} onForget={(id) => void forget(id)} />
    </section>
  );
}

/** The conversations already had: what they were about, and how far they got. */
function SavedList({
  conversations,
  onForget,
}: {
  conversations: TalkConversationSummary[] | null;
  onForget: (id: string) => void;
}) {
  if (!conversations) return null;
  if (!conversations.length) {
    return (
      <p className="small muted talk-saved-none">
        Conversations you have are kept here, so you can pick one up where you left it.
      </p>
    );
  }
  return (
    <div className="card">
      <header>
        <h2>Carry one on</h2>
      </header>
      <div className="body">
        <ul className="talk-saved">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link className="talk-saved-open" to={paths.speakingTalk(c.id)}>
                <span className="talk-saved-title">{c.title}</span>
                <span className="tiny muted">
                  {c.level.toUpperCase().replace('HSK', 'HSK ')} · {c.turns === 1 ? '1 turn' : `${c.turns} turns`} ·{' '}
                  {when(c.updatedAt)}
                </span>
              </Link>
              <button
                className="btn ghost sm"
                aria-label={`Forget “${c.title}”`}
                title="Forget this conversation"
                onClick={() => onForget(c.id)}
              >
                Forget
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** How long ago, in the words somebody would use out loud. */
function when(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(at).toLocaleDateString();
}
