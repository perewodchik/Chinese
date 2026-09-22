import { useCallback, useEffect, useState } from 'react';
import type { TalkVoice } from '../../../shared/talk';
import { talkStatus } from '../../api/talk';
import { canSpeak, onVoicesReady, speak, stopSpeaking, unlockSpeech } from '../../platform/speech';

/**
 * Hearing a passage read.
 *
 * Reading on screen is half of what a text is for; the other half is knowing
 * what it sounds like, and a passage nobody reads aloud is a passage whose
 * tones are being guessed at sentence after sentence. Two voices can do it:
 * the one the operating system ships, which is always there and is never the
 * one to imitate, and the models on this computer — the same ones that read
 * Claude's half of a conversation — which sound like a person and exist only
 * where `npm run voices` has been run.
 *
 * The choice is the learner's and it sticks, because it is a preference about
 * how they read rather than something about this passage. It is kept on the
 * device rather than in the account: the models are on one machine, and a
 * voice chosen here would be a voice that does not exist on the iPad.
 */

export const SYSTEM_VOICE = 'system';
const STORED = 'hanzi.reading.voice';

function stored(): string | null {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
}

/**
 * The chosen voice, one for the page. Every passage's button shows it and
 * every passage reads with it; changing it in one changes it in all.
 */
let chosen: string = stored() ?? SYSTEM_VOICE;
const choosers = new Set<(id: string) => void>();

/**
 * The models this server can read any sentence with, asked once a page load —
 * and asked *with the chosen voice*, which gets that model loading on the
 * server while the passage is still being read on screen. Loading takes
 * seconds; spent here, they are not spent after the first tap on Listen.
 */
let known: Promise<TalkVoice[]> | null = null;
const localVoices = () =>
  (known ??= talkStatus(chosen === SYSTEM_VOICE ? undefined : chosen)
    .then((s) => s.voices)
    .catch(() => []));

/* ------------------------------------------------------------ the clips */

/**
 * Every sentence's clip, fetched once and kept as a blob for the page.
 *
 * A model writes a sentence in a second or three. Asking for each one only
 * when the last had finished put that wait between every pair of sentences;
 * asking for the next three while one plays means the next is usually there
 * before it is wanted.
 */
const clips = new Map<string, Promise<string>>();
const AHEAD = 3;

function clip(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`;
  let p = clips.get(key);
  if (!p) {
    const q = new URLSearchParams({ text, voice, mode: 'teaching' });
    p = fetch(`/api/talk/audio?${q}`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`voice ${r.status}`);
        return r.blob();
      })
      .then((b) => URL.createObjectURL(b));
    // A failure is not kept: the next Listen asks again.
    p.catch(() => clips.delete(key));
    clips.set(key, p);
  }
  return p;
}

/**
 * Starts the opening sentences of a passage coming, before anybody asks for
 * them. The model writes one sentence at a time, so three in hand is what
 * keeps the second from being a wait while the first is still playing.
 */
export function prefetchFirst(lines: string[]) {
  if (chosen === SYSTEM_VOICE) return;
  for (const line of lines.slice(0, AHEAD)) void clip(line, chosen).catch(() => undefined);
}

/**
 * The one element every clip plays through.
 *
 * iOS lets a page start sound only inside the tap that asked for it, and a
 * clip that arrives a second later is outside it. So the tap plays a moment
 * of silence through this element — which is what iOS remembers — and every
 * clip after that, however late, is only a new address on an element that is
 * already allowed to play.
 */
let player: HTMLAudioElement | null = null;
const audio = () => (player ??= new Audio());

/** A tenth of a second of silence, as a WAV, built rather than shipped. */
const SILENCE = (() => {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples * 2, true);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

function unlockAudio() {
  const el = audio();
  el.src = SILENCE;
  void el.play().catch(() => undefined);
}

/* -------------------------------------------------------------- the run */

/**
 * The reading in progress, which is one thing per page and not one per
 * component: a line's own button and "read it all" are the same player, so
 * starting either stops whatever was already talking.
 */
interface Run {
  lines: string[];
  at: number;
  voice: string;
  /** the whole passage rather than one line: only then does it move on by itself */
  through: boolean;
}

export interface ReadingState {
  /** which line is being read, or null when nothing is */
  at: number | null;
  /** waiting for that line's clip to arrive */
  loading: boolean;
  /** why the last reading stopped short, when it did */
  error: string | null;
}

let run: Run | null = null;
let stopCurrent: (() => void) | null = null;
let state: ReadingState = { at: null, loading: false, error: null };
const watchers = new Set<(s: ReadingState) => void>();

function announce(patch: Partial<ReadingState>) {
  state = { ...state, ...patch };
  for (const w of watchers) w(state);
}

export function hushReading() {
  stopCurrent?.();
  stopCurrent = null;
  run = null;
  announce({ at: null, loading: false });
}

function fail(message: string) {
  stopCurrent?.();
  stopCurrent = null;
  run = null;
  announce({ at: null, loading: false, error: message });
}

function step() {
  const here = run;
  if (!here || here.at >= here.lines.length) {
    hushReading();
    return;
  }
  const next = () => {
    if (run !== here) return;
    if (!here.through) {
      hushReading();
      return;
    }
    here.at += 1;
    step();
  };

  if (here.voice === SYSTEM_VOICE) {
    announce({ at: here.at, loading: false });
    if (!speak(here.lines[here.at]!, { rate: 0.85, onEnd: next })) fail('This device has no Chinese voice.');
    stopCurrent = stopSpeaking;
    return;
  }

  announce({ at: here.at, loading: true });
  // This one, and the next ones on their way while it plays.
  const wanted = clip(here.lines[here.at]!, here.voice);
  if (here.through) {
    for (let k = 1; k <= AHEAD; k++) {
      const ahead = here.lines[here.at + k];
      if (ahead) void clip(ahead, here.voice).catch(() => undefined);
    }
  }

  let cancelled = false;
  const el = audio();
  stopCurrent = () => {
    cancelled = true;
    el.onended = null;
    el.onerror = null;
    el.pause();
  };

  wanted.then(
    (url) => {
      if (cancelled || run !== here) return;
      el.onended = next;
      el.onerror = () => run === here && fail('The voice could not be played.');
      el.src = url;
      void el.play().then(
        () => run === here && announce({ loading: false }),
        (err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (run === here) fail('The browser would not play the voice. Tap Listen again.');
        },
      );
    },
    () => {
      // Said, not papered over: reading on in the system voice is the wrong
      // voice, and it is the one thing the learner did not choose.
      if (!cancelled && run === here) fail('The voice did not answer. Try again in a moment, or choose another.');
    },
  );
}

function start(lines: string[], from: number, voice: string, through: boolean) {
  hushReading();
  // iOS starts sound only inside the tap that asked for it; this is inside one.
  unlockSpeech();
  if (voice !== SYSTEM_VOICE) unlockAudio();
  run = { lines, at: from, voice, through };
  announce({ error: null });
  step();
}

/* -------------------------------------------------------------- the hook */

export interface Reading extends ReadingState {
  /** the models this server has, which is none on the website */
  voices: TalkVoice[];
  /** false where the machine has no Mandarin voice installed at all */
  system: boolean;
  voice: string;
  setVoice: (id: string) => void;
  /** read one line, and stop at the end of it */
  readLine: (lines: string[], i: number) => void;
  /** read the whole passage from the top */
  readAll: (lines: string[]) => void;
  stop: () => void;
}

export function useReading(): Reading {
  /** null until the server has said which models it has */
  const [voices, setVoices] = useState<TalkVoice[] | null>(null);
  const [system, setSystem] = useState(canSpeak);
  const [voice, setChosen] = useState(chosen);
  const [now, setNow] = useState(state);

  useEffect(() => {
    let live = true;
    void localVoices().then((list) => live && setVoices(list));
    const off = onVoicesReady(() => setSystem(canSpeak()));
    watchers.add(setNow);
    choosers.add(setChosen);
    return () => {
      live = false;
      off();
      watchers.delete(setNow);
      choosers.delete(setChosen);
    };
  }, []);

  // Leaving the passage, or opening the next one, stops the voice with it.
  useEffect(() => hushReading, []);

  // A voice remembered from a machine that had the models, opened on one that
  // does not, would be a button promising a voice nothing can play. But only
  // once the list is in: before that, the remembered voice is the one meant.
  const usable =
    voice === SYSTEM_VOICE || voices === null || voices.some((v) => v.id === voice) ? voice : SYSTEM_VOICE;

  const setVoice = useCallback((id: string) => {
    hushReading();
    chosen = id;
    for (const c of choosers) c(id);
    // Get the new model loading now, not on the first sentence.
    if (id !== SYSTEM_VOICE) void talkStatus(id).catch(() => undefined);
    try {
      localStorage.setItem(STORED, id);
    } catch {
      // A browser with storage switched off simply forgets between visits.
    }
  }, []);

  return {
    ...now,
    voices: voices ?? [],
    system,
    voice: usable,
    setVoice,
    readLine: useCallback((lines, i) => start(lines, i, usable, false), [usable]),
    readAll: useCallback((lines) => start(lines, 0, usable, true), [usable]),
    stop: hushReading,
  };
}
