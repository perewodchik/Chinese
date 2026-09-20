/**
 * The browser's own speech recognition, asked one question: which characters
 * did it hear?
 *
 * It cannot judge a tone — it is built to guess the likeliest *words*, and
 * will happily hear 吃 for a badly said 七 if 吃 fits better. That is exactly
 * why it is useful for the sounds pitch cannot see: if the machine, which has
 * heard millions of Mandarin speakers, writes down 吃 when you meant 七, your
 * q came out as ch. A crude listener, but a native one, and free.
 *
 * Safari sends the audio to Apple for this (on iPadOS it needs Siri &
 * Dictation switched on); Chrome sends it to Google. Nothing here keeps it.
 */

interface Alternative {
  transcript: string;
  confidence: number;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alternative> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canRecognise = () => ctor() !== null;

export interface Heard {
  alternatives: Alternative[];
}

export const RECOGNITION_MESSAGE: Record<string, string> = {
  'not-allowed': 'Speech recognition was refused. On an iPad, switch on Siri & Dictation in Settings, then allow the microphone.',
  'service-not-allowed': 'Speech recognition is switched off. On an iPad: Settings › General › Keyboard › Enable Dictation.',
  'no-speech': 'Nothing was heard. Try again a little closer to the microphone.',
  network: 'Speech recognition needs the internet, and could not reach it.',
  'audio-capture': 'The microphone is busy or missing.',
};

/**
 * Listens for one short utterance in Mandarin and resolves with what was
 * heard, or rejects with the browser's error code.
 */
export function recogniseOnce(timeoutMs = 6000): { result: Promise<Heard>; cancel: () => void } {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.reject(new Error('unsupported')), cancel: () => undefined };
  const r = new Ctor();
  r.lang = 'zh-CN';
  r.interimResults = false;
  r.maxAlternatives = 5;
  r.continuous = false;

  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<Heard>((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last) return;
      const alternatives = Array.from(last, (a) => ({ transcript: a.transcript.trim(), confidence: a.confidence }));
      finish(() => resolve({ alternatives }));
    };
    r.onerror = (e) => finish(() => reject(new Error(e.error)));
    r.onend = () => finish(() => reject(new Error('no-speech')));
    timer = setTimeout(() => {
      r.stop();
    }, timeoutMs);
  });
  r.start();
  return { result, cancel: () => r.abort() };
}

export interface Listening {
  /** everything heard, once listening stops — by `stop`, by the time limit, or by the browser itself */
  result: Promise<string>;
  /** stop, and keep what was heard */
  stop(): void;
  /** stop, and throw it away */
  cancel(): void;
}

/**
 * Listens to a whole turn of a conversation: as long as it takes, until told
 * to stop, with the words shown as they are recognised.
 *
 * Different from `recogniseOnce` in the one way that matters for talking: a
 * learner pauses in the middle of a sentence to find the next word, and a
 * recogniser that ends at the first pause cuts the sentence in half. So this
 * one keeps listening (`continuous`) and hands over its running guess
 * (`interimResults`) so the page can show it. Safari may still stop on its
 * own after a long silence; whatever it had by then is the answer.
 */
export function listen(onHeard: (text: string) => void, maxMs = 45_000): Listening {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.reject(new Error('unsupported')), stop: () => undefined, cancel: () => undefined };
  const r = new Ctor();
  r.lang = 'zh-CN';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.continuous = true;

  let text = '';
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<string>((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };
    r.onresult = (e) => {
      // The list holds the whole session: the settled phrases, then the one still being guessed.
      let all = '';
      for (let i = 0; i < e.results.length; i++) all += e.results[i]?.[0]?.transcript ?? '';
      text = all.trim();
      onHeard(text);
    };
    r.onerror = (e) => {
      // A pause after some words is not a failure; the end event brings what there is.
      if (e.error === 'no-speech' && text) return;
      finish(() => reject(new Error(cancelled ? 'aborted' : e.error)));
    };
    r.onend = () =>
      finish(() => (text && !cancelled ? resolve(text) : reject(new Error(cancelled ? 'aborted' : 'no-speech'))));
    timer = setTimeout(() => r.stop(), maxMs);
  });
  r.start();
  return {
    result,
    stop: () => r.stop(),
    cancel: () => {
      cancelled = true;
      r.abort();
    },
  };
}
