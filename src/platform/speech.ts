/**
 * Saying it out loud, using the voice already installed on the machine.
 *
 * The app has never made a sound, which for a language with four tones is a
 * real hole: a character learned without its tone is learned wrong, and pinyin
 * on the page is a spelling, not a sound. The browser's own speech synthesis
 * closes it for nothing — no key, no account, no request leaving the machine,
 * which is the same constraint the reading feature is built under.
 *
 * It is a system voice, so it is not a teacher: it will read 好 as third tone
 * in isolation where a person would sandhi it in context. Good enough to check
 * a tone against, not good enough to imitate — which is roughly what it is
 * used for here.
 */

let cached: SpeechSynthesisVoice | null | undefined;

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null;

const CHOSEN = 'hanzi.speech.voice';

/**
 * How natural a voice sounds, from what the system says about it. Apple's
 * downloadable voices are named for their quality — "Lili (Premium)",
 * `com.apple.voice.enhanced.zh-CN.Tingting` — and the premium ones are neural
 * voices, as good as a paid service and free, offline, on the device. The
 * compact one that ships by default is the one that sounds like a machine.
 */
export function voiceQuality(v: SpeechSynthesisVoice): 'premium' | 'enhanced' | 'basic' {
  const id = `${v.voiceURI} ${v.name}`.toLowerCase();
  if (id.includes('premium') || id.includes('neural') || id.includes('natural')) return 'premium';
  if (id.includes('enhanced') || id.includes('google')) return 'enhanced';
  return 'basic';
}

/** A mainland voice: the Mandarin of the textbooks, the HSK and the recordings. */
const mainland = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-') === 'zh-cn';

/**
 * Every Mandarin voice on this device worth offering, the most natural first.
 * A mainland voice where there is one; only where there is none, the
 * Taiwanese ones, which read simplified text correctly with an accent of
 * their own. Safari lists some voices twice, under two addresses — one of
 * each name is enough. The system default for another language, which would
 * read 好 as h-a-o, is never on the list.
 *
 * Safari offers web pages only the voices the system ships with: a voice
 * downloaded in Settings — "Han (Premium)" and the like — works in Live
 * Speech and Spoken Content and never shows up here (WebKit bugs 250665 and
 * 290497). Chrome on a Mac lists them.
 */
export function chineseVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  const rank = (v: SpeechSynthesisVoice) => {
    const q = voiceQuality(v);
    return q === 'premium' ? 3 : q === 'enhanced' ? 2 : 1;
  };
  const seen = new Set<string>();
  const all = s
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('zh') && !/hk|yue/i.test(v.lang))
    .sort((a, b) => rank(b) - rank(a))
    .filter((v) => !seen.has(v.name) && Boolean(seen.add(v.name)));
  const home = all.filter(mainland);
  return home.length ? home : all;
}

/** A voice's name as a chip shows it: its quality where the name does not say, and Taiwan where it is from there. */
export function voiceLabel(v: SpeechSynthesisVoice): string {
  const q = voiceQuality(v);
  const named = /\(/.test(v.name) || q === 'basic' ? v.name : `${v.name} (${q === 'premium' ? 'Premium' : 'Enhanced'})`;
  return mainland(v) ? named : `${named}, Taiwan`;
}

/**
 * The Mandarin voice to speak with: the one chosen on this device, if it is
 * still installed, and otherwise the best there is.
 */
export function chineseVoice(): SpeechSynthesisVoice | null {
  if (cached !== undefined) return cached;
  const list = chineseVoices();
  if (!list.length) return null; // not loaded yet, or none at all; do not cache the miss
  let wanted: string | null = null;
  try {
    wanted = localStorage.getItem(CHOSEN);
  } catch {
    wanted = null;
  }
  return (cached = list.find((v) => v.voiceURI === wanted) ?? list[0] ?? null);
}

/** Speak with this one from now on, on this device. */
export function chooseChineseVoice(uri: string) {
  try {
    localStorage.setItem(CHOSEN, uri);
  } catch {
    // remembered for this visit only
  }
  cached = undefined;
}

/** Fires when the voice list arrives, which on some browsers is after load. */
export function onVoicesReady(cb: () => void): () => void {
  const s = synth();
  if (!s) return () => undefined;
  const handler = () => {
    cached = undefined;
    cb();
  };
  s.addEventListener('voiceschanged', handler);
  // It may already be there.
  if (s.getVoices().length) cb();
  return () => s.removeEventListener('voiceschanged', handler);
}

export const canSpeak = () => chineseVoice() !== null;

/**
 * Says one word, character or sentence.
 *
 * Anything still being said is cancelled first: clicking down a list of
 * characters should sound like a list of characters, not like all of them at
 * once. Slightly under normal speed, because the point is to hear the tone.
 */
export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}) {
  const s = synth();
  const voice = chineseVoice();
  if (!s || !voice || !text.trim()) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice.lang;
  u.rate = opts.rate ?? 0.85;
  try {
    u.voice = voice;
  } catch {
    // Some engines refuse the voice object but honour the language, which
    // still lands on a Mandarin voice. Better than throwing out of a click.
    void 0;
  }
  if (opts.onEnd) {
    const end = opts.onEnd;
    u.onend = () => end();
    u.onerror = () => end();
  }
  s.speak(u);
  return true;
}

/**
 * iOS lets speech synthesis start only inside a tap. Saying nothing, quietly,
 * inside one is enough to let everything said later — after a network wait —
 * be heard as well.
 */
export function unlockSpeech() {
  const s = synth();
  if (!s || s.speaking) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  s.speak(u);
}

export const stopSpeaking = () => synth()?.cancel();
