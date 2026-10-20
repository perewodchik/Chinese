import { useCallback, useEffect, useState } from 'react';
import type { TalkVoice } from '../../../shared/talk';
import { talkRecorded, talkStatus } from '../../api/talk';
import {
  canSpeak,
  chineseVoice,
  chineseVoices,
  chooseChineseVoice,
  onVoicesReady,
  speak,
  speechBusy,
  stopSpeaking,
  unlockSpeech,
  voiceLabel,
} from '../../platform/speech';

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
 * The website has no models, and Safari offers it only the device's robotic
 * voice. So what the models read for a text at home is kept, and the website
 * plays those recordings: a recorded voice reads the texts recorded in it and
 * nothing else, and is offered for a passage only when every sentence of it
 * is there. Where one is, it is the voice a passage starts in, unless the
 * learner has chosen another.
 *
 * The choice is the learner's and it sticks, because it is a preference about
 * how they read rather than something about this passage. It is kept on the
 * device rather than in the account: the models are on one machine, and a
 * voice chosen here would be a voice that does not exist on the iPad.
 */

export const SYSTEM_VOICE = 'system';
const STORED = 'hanzi.reading.voice';
const RATE = 'hanzi.reading.rate';

/** How fast a passage is read: 1 as it is, or slower to follow it. Kept on the device. */
export const RATES = [0.75, 1] as const;
export type ReadingRate = (typeof RATES)[number];

let rate: ReadingRate = (() => {
  try {
    return Number(localStorage.getItem(RATE)) === 0.75 ? 0.75 : 1;
  } catch {
    return 1;
  }
})();
const rateWatchers = new Set<(r: ReadingRate) => void>();

function stored(): string | null {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
}

/**
 * The chosen voice, one for the page. Every passage's button shows it and
 * every passage reads with it; changing it in one changes it in all. Null
 * until the learner chooses: then a recorded voice where the passage has one,
 * and the device's otherwise.
 */
let chosen: string | null = stored();
const choosers = new Set<(id: string) => void>();

/**
 * The models this server can read any sentence with, asked once a page load —
 * and asked *with the chosen voice*, which gets that model loading on the
 * server while the passage is still being read on screen. Loading takes
 * seconds; spent here, they are not spent after the first tap on Listen.
 */
let known: Promise<TalkVoice[]> | null = null;
const localVoices = () =>
  (known ??= talkStatus(chosen === SYSTEM_VOICE || chosen === null ? undefined : chosen)
    .then((s) => s.voices)
    .catch(() => []));

/**
 * Which sentences each voice has, asked once a sentence and kept for the
 * page: `voice|sentence` → whether it can be played. A voice that reads
 * anything is not asked about; it has them all.
 */
const recorded = new Map<string, boolean>();

async function hasPassage(voice: string, lines: string[]): Promise<boolean> {
  const unknown = [...new Set(lines.filter((l) => !recorded.has(`${voice}|${l}`)))];
  if (unknown.length) {
    const { have } = await talkRecorded(voice, unknown);
    unknown.forEach((l, i) => recorded.set(`${voice}|${l}`, have[i] === true));
  }
  return lines.every((l) => recorded.get(`${voice}|${l}`));
}

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
/** the clips that have arrived, so a sentence already in hand is not shown as loading for a frame */
const ready = new Set<string>();
const AHEAD = 3;

function clip(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`;
  let p = clips.get(key);
  if (!p) {
    // keep: a sentence of a text, read by a model at home, is recorded for the website.
    const q = new URLSearchParams({ text, voice, mode: 'teaching', keep: '1' });
    p = fetch(`/api/talk/audio?${q}`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`voice ${r.status}`);
        return r.blob();
      })
      .then((b) => {
        ready.add(key);
        return URL.createObjectURL(b);
      });
    // A failure is not kept: the next Listen asks again.
    p.catch(() => clips.delete(key));
    clips.set(key, p);
  }
  return p;
}

/**
 * Starts a passage's clips coming as soon as it is on screen, before anybody
 * asks for them. Listen waits for the whole passage (see `start`), so every
 * sentence made while the title is being read is a second less to wait.
 */
export function prefetchPassage(lines: string[], voice: string) {
  if (voice === SYSTEM_VOICE) return;
  for (const line of lines) void clip(line, voice).catch(() => undefined);
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
  /** while a whole passage is being made before it is read: how much of it is ready */
  made: { done: number; total: number } | null;
}

let run: Run | null = null;
let stopCurrent: (() => void) | null = null;
let state: ReadingState = { at: null, loading: false, error: null, made: null };
const watchers = new Set<(s: ReadingState) => void>();

function announce(patch: Partial<ReadingState>) {
  state = { ...state, ...patch };
  for (const w of watchers) w(state);
}

/**
 * Stops it. The run is let go of before the voice is silenced: cancelling
 * speech sends the line's `end` at once on some browsers, and a run still
 * current at that moment took it as the line finished and read the next —
 * which is how Pause went on talking.
 */
function halt() {
  const stop = stopCurrent;
  stopCurrent = null;
  run = null;
  stop?.();
}

export function hushReading() {
  halt();
  announce({ at: null, loading: false, made: null });
}

function fail(message: string) {
  halt();
  announce({ at: null, loading: false, made: null, error: message });
}

/** Told when a whole passage has been read to its last line, with the lines it read. */
const throughWatchers = new Set<(lines: string[]) => void>();

export function onReadThrough(cb: (lines: string[]) => void): () => void {
  throughWatchers.add(cb);
  return () => throughWatchers.delete(cb);
}

function step() {
  const here = run;
  if (!here || here.at >= here.lines.length) {
    hushReading();
    if (here?.through && here.at >= here.lines.length) for (const w of throughWatchers) w(here.lines);
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
    const said = speak(here.lines[here.at]!, {
      rate: 0.85 * rate,
      // One line after another, nothing cancelled in between (see `speak`).
      queue: true,
      onEnd: (how) => {
        if (run !== here) return;
        // Cut off by something else that spoke: that is a stop, not the end of the line.
        if (how === 'interrupted') hushReading();
        else next();
      },
    });
    if (!said) fail('This device has no Chinese voice.');
    stopCurrent = stopSpeaking;
    return;
  }

  announce({ at: here.at, loading: !ready.has(`${here.voice}|${here.lines[here.at]}`) });
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
      el.defaultPlaybackRate = rate;
      el.playbackRate = rate;
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
  // Something still talking is cut off first; Safari takes a moment over a
  // cancel, and a line spoken straight after one is sometimes the line it
  // cancels. So after a cancel the first line waits a moment; with nothing
  // to cancel it is said at once, inside the tap, which is what iOS needs.
  const busy = voice === SYSTEM_VOICE && speechBusy();
  hushReading();
  if (voice !== SYSTEM_VOICE) {
    // iOS starts sound only inside the tap that asked for it; this is inside one.
    unlockSpeech();
    unlockAudio();
  }
  const here: Run = { lines, at: from, voice, through };
  run = here;
  announce({ error: null });
  if (voice === SYSTEM_VOICE) {
    if (busy) {
      announce({ at: from, loading: true });
      setTimeout(() => run === here && step(), 180);
    } else step();
    return;
  }
  if (!through) {
    step();
    return;
  }

  // The whole passage first, then the reading. A model makes a sentence in a
  // second or two, and a passage read with a wait between its sentences is
  // a passage whose rhythm is the server's rather than the speaker's. So the
  // button spins, counting, until every sentence is in hand — then it reads
  // straight through without a pause that was not written.
  const wanted = lines.slice(from);
  let done = 0;
  announce({ at: null, loading: true, made: { done, total: wanted.length } });
  Promise.all(
    wanted.map((line) =>
      clip(line, voice).then((url) => {
        if (run === here) announce({ made: { done: ++done, total: wanted.length } });
        return url;
      }),
    ),
  ).then(
    () => {
      if (run !== here) return;
      announce({ made: null });
      step();
    },
    () => {
      if (run === here) fail('The voice did not answer. Try again in a moment, or choose another.');
    },
  );
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
  /** read on from line `i` to the end */
  readFrom: (lines: string[], i: number) => void;
  rate: ReadingRate;
  setRate: (r: ReadingRate) => void;
  stop: () => void;
  /** the device's own voice in use, by name — "Lili (Premium)" */
  systemName: string | null;
  /** every voice that can read the passage here: a recorded person's voice, the device's Mandarin voices, the server's models */
  choices: Array<{ key: string; name: string; active: boolean; pick: () => void }>;
  /** a voice the website has recordings in, but not of this passage: its name */
  notRecorded: string | null;
}

/**
 * The player for one passage, `passage` being its sentences: which voices can
 * read all of it, and the one it reads in.
 */
export function useReading(passage?: string[]): Reading {
  /** null until the server has said which models it has */
  const [voices, setVoices] = useState<TalkVoice[] | null>(null);
  /** the server's voices with every sentence of this passage recorded; null until asked */
  const [covering, setCovering] = useState<Set<string> | null>(null);
  const [system, setSystem] = useState(canSpeak);
  /** bumped when the device's voices arrive or one is chosen, so the names are read again */
  const [deviceTick, setDeviceTick] = useState(0);
  const [voice, setChosen] = useState(chosen);
  const [now, setNow] = useState(state);
  const [speed, setSpeed] = useState<ReadingRate>(rate);

  useEffect(() => {
    let live = true;
    void localVoices().then((list) => live && setVoices(list));
    const off = onVoicesReady(() => {
      setSystem(canSpeak());
      setDeviceTick((n) => n + 1);
    });
    watchers.add(setNow);
    choosers.add(setChosen);
    rateWatchers.add(setSpeed);
    return () => {
      live = false;
      off();
      watchers.delete(setNow);
      choosers.delete(setChosen);
      rateWatchers.delete(setSpeed);
    };
  }, []);

  useEffect(() => {
    if (!voices || !passage?.length) {
      setCovering(voices ? new Set() : null);
      return;
    }
    let live = true;
    void Promise.all(
      voices.map((v) =>
        hasPassage(v.id, passage).then(
          (all) => (all ? v.id : null),
          () => null,
        ),
      ),
    ).then((ids) => live && setCovering(new Set(ids.filter((id): id is string => id !== null))));
    return () => {
      live = false;
    };
  }, [voices, passage]);

  // Leaving the passage, or opening the next one, stops the voice with it.
  useEffect(() => hushReading, []);

  // A voice that reads anything can read this; a recorded one only if all of
  // it was recorded. A voice remembered from a machine that had the models,
  // opened on one that does not, would be a button promising a voice nothing
  // can play — so the remembered voice stands only while it can play this
  // passage, and before the server has answered, when it is the one meant.
  const playable = (voices ?? []).filter((v) => !v.recorded || covering?.has(v.id));
  const recordedHere = (voices ?? []).find((v) => covering?.has(v.id));
  const usable =
    voices === null || covering === null
      ? (voice ?? SYSTEM_VOICE)
      : voice === SYSTEM_VOICE
        ? SYSTEM_VOICE
        : voice !== null && playable.some((v) => v.id === voice)
          ? voice
          : (recordedHere?.id ?? SYSTEM_VOICE);

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

  const device = chineseVoice();
  const server = (v: TalkVoice) => ({ key: v.id, name: v.name, active: usable === v.id, pick: () => setVoice(v.id) });
  // A person's voice first where there is one for this passage, then the device's.
  const choices = [
    ...playable.filter((v) => covering?.has(v.id)).map(server),
    ...chineseVoices().map((v) => ({
      key: `device:${v.voiceURI}`,
      name: voiceLabel(v),
      active: usable === SYSTEM_VOICE && device?.voiceURI === v.voiceURI,
      pick: () => {
        chooseChineseVoice(v.voiceURI);
        setVoice(SYSTEM_VOICE);
        setDeviceTick((n) => n + 1);
      },
    })),
    ...playable.filter((v) => !covering?.has(v.id)).map(server),
  ];
  void deviceTick;

  return {
    ...now,
    systemName: device ? voiceLabel(device) : null,
    choices,
    notRecorded: (voices ?? []).find((v) => v.recorded && covering && !covering.has(v.id))?.name ?? null,
    voices: voices ?? [],
    system,
    voice: usable,
    setVoice,
    readLine: useCallback((lines, i) => start(lines, i, usable, false), [usable]),
    readAll: useCallback((lines) => start(lines, 0, usable, true), [usable]),
    readFrom: useCallback((lines, i) => start(lines, i, usable, true), [usable]),
    rate: speed,
    setRate: useCallback((r: ReadingRate) => {
      rate = r;
      for (const w of rateWatchers) w(r);
      // A clip already playing changes pace at once; the system voice from its next line.
      if (player) player.playbackRate = r;
      try {
        localStorage.setItem(RATE, String(r));
      } catch {
        // remembered for this visit only
      }
    }, []),
    stop: hushReading,
  };
}
