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
  'start-failed': 'Speech recognition would not start. Reload the page, or check nothing else is using the microphone.',
};

export interface Hearing {
  /** what was heard, once the utterance is over */
  result: Promise<Heard>;
  /** stop listening now, and keep whatever has been heard so far */
  stop(): void;
  /** stop listening, and throw it away */
  cancel(): void;
}

/**
 * How long a recogniser that has been told to stop is given to say what it
 * heard. Long, because finishing means a round trip to Google or Apple and
 * an answer that arrives late is still the answer; bounded, because an
 * engine that has gone quiet must not leave a button saying "Listening…"
 * over a microphone that is not.
 */
const SETTLE_MS = 4000;

/**
 * Listens for one short utterance in Mandarin and resolves with what was
 * heard, or rejects with the browser's error code.
 *
 * It ends by itself at the end of the utterance — that is what
 * `continuous = false` buys — so nothing has to be pressed to finish. `stop`
 * is there for the case where something else already knows the utterance is
 * over, such as a recording of the same breath that has gone quiet; it
 * settles the recogniser then rather than waiting for it to notice.
 */
export function recogniseOnce(timeoutMs = 6000): Hearing {
  const Ctor = ctor();
  if (!Ctor) {
    return { result: Promise.reject(new Error('unsupported')), stop: () => undefined, cancel: () => undefined };
  }
  const r = new Ctor();
  r.lang = 'zh-CN';
  r.interimResults = false;
  r.maxAlternatives = 5;
  r.continuous = false;

  let cancelled = false;
  let ceiling: ReturnType<typeof setTimeout>;
  let grace: ReturnType<typeof setTimeout> | undefined;
  /** promise an answer, from an engine that may have gone quiet */
  let ask!: () => void;
  /** answer now, with a reason */
  let fail!: (code: string) => void;

  const result = new Promise<Heard>((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(ceiling);
      clearTimeout(grace);
      fn();
    };
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last) return;
      const alternatives = Array.from(last, (a) => ({ transcript: a.transcript.trim(), confidence: a.confidence }));
      finish(() => resolve({ alternatives }));
    };
    r.onerror = (e) => finish(() => reject(new Error(cancelled ? 'aborted' : e.error)));
    r.onend = () => finish(() => reject(new Error(cancelled ? 'aborted' : 'no-speech')));
    // Being told to stop should end in an answer, and not every engine fires
    // `end` when it is — Safari has been known to go quiet instead. So the
    // silence gets an answer of its own, once there has been long enough for
    // a real one to have arrived.
    ask = () => {
      if (done || grace) return;
      grace = setTimeout(() => finish(() => reject(new Error(cancelled ? 'aborted' : 'no-speech'))), SETTLE_MS);
    };
    fail = (code) => finish(() => reject(new Error(code)));
    ceiling = setTimeout(() => {
      r.stop();
      ask();
    }, timeoutMs);
  });
  try {
    r.start();
  } catch {
    // An engine that will not even begin — no permission yet, or another
    // listener still holding the microphone — says so by throwing here, and
    // then never fires an event. Answer for it.
    fail('start-failed');
  }
  return {
    result,
    stop: () => {
      r.stop();
      ask();
    },
    cancel: () => {
      cancelled = true;
      r.abort();
      ask();
    },
  };
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
