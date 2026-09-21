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

/** The models this server can read any sentence with. Asked once a page load. */
let known: Promise<TalkVoice[]> | null = null;
const localVoices = () =>
  (known ??= talkStatus()
    .then((s) => s.voices)
    .catch(() => []));

/**
 * One sentence, started. Returns the way to stop it early.
 *
 * A model's clip is played straight from its address rather than fetched and
 * decoded: the server marks each one good for a year, so a sentence heard
 * twice is downloaded once, and the browser does the keeping.
 */
function play(text: string, voice: string, onEnd: () => void, onFail: () => void): () => void {
  if (voice === SYSTEM_VOICE) {
    if (!speak(text, { rate: 0.85, onEnd })) onFail();
    return stopSpeaking;
  }
  const q = new URLSearchParams({ text, voice, mode: 'teaching' });
  const el = new Audio(`/api/talk/audio?${q}`);
  el.onended = onEnd;
  el.onerror = onFail;
  void el.play().catch(onFail);
  return () => {
    el.onended = null;
    el.onerror = null;
    el.pause();
  };
}

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

let run: Run | null = null;
let stopCurrent: (() => void) | null = null;
const watchers = new Set<(at: number | null) => void>();

const announce = () => {
  for (const w of watchers) w(run ? run.at : null);
};

export function hushReading() {
  stopCurrent?.();
  stopCurrent = null;
  run = null;
  announce();
}

function step() {
  const here = run;
  if (!here || here.at >= here.lines.length) {
    hushReading();
    return;
  }
  announce();
  stopCurrent = play(
    here.lines[here.at]!,
    here.voice,
    () => {
      if (run !== here) return;
      if (!here.through) {
        hushReading();
        return;
      }
      here.at += 1;
      step();
    },
    () => {
      if (run !== here) return;
      // A model that will not answer — the worker still loading, the machine
      // asleep — must not leave the passage silent. The system voice is worse
      // and it is there.
      if (here.voice !== SYSTEM_VOICE) {
        here.voice = SYSTEM_VOICE;
        step();
        return;
      }
      hushReading();
    },
  );
}

function start(lines: string[], from: number, voice: string, through: boolean) {
  hushReading();
  // iOS starts audio only inside the tap that asked for it; this is inside one.
  unlockSpeech();
  run = { lines, at: from, voice, through };
  step();
}

export interface Reading {
  /** the models this server has, which is none on the website */
  voices: TalkVoice[];
  /** false where the machine has no Mandarin voice installed at all */
  system: boolean;
  voice: string;
  setVoice: (id: string) => void;
  /** which line is being read, or null when nothing is */
  at: number | null;
  /** read one line, and stop at the end of it */
  readLine: (lines: string[], i: number) => void;
  /** read the whole passage from the top */
  readAll: (lines: string[]) => void;
  stop: () => void;
}

export function useReading(): Reading {
  const [voices, setVoices] = useState<TalkVoice[]>([]);
  const [system, setSystem] = useState(canSpeak);
  const [voice, setChosen] = useState(() => stored() ?? SYSTEM_VOICE);
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void localVoices().then((list) => live && setVoices(list));
    const off = onVoicesReady(() => setSystem(canSpeak()));
    const watch = (n: number | null) => setAt(n);
    watchers.add(watch);
    return () => {
      live = false;
      off();
      watchers.delete(watch);
    };
  }, []);

  // Leaving the passage, or opening the next one, stops the voice with it.
  useEffect(() => hushReading, []);

  // A voice remembered from a machine that had the models, opened on one that
  // does not, would be a picker showing a voice nothing can play.
  const usable = voice === SYSTEM_VOICE || voices.some((v) => v.id === voice) ? voice : SYSTEM_VOICE;

  const setVoice = useCallback((id: string) => {
    hushReading();
    setChosen(id);
    try {
      localStorage.setItem(STORED, id);
    } catch {
      // A browser with storage switched off simply forgets between visits.
    }
  }, []);

  return {
    voices,
    system,
    voice: usable,
    setVoice,
    at,
    readLine: useCallback((lines, i) => start(lines, i, usable, false), [usable]),
    readAll: useCallback((lines) => start(lines, 0, usable, true), [usable]),
    stop: hushReading,
  };
}

function stored(): string | null {
  try {
    return localStorage.getItem(STORED);
  } catch {
    return null;
  }
}
