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

/**
 * The best Mandarin voice available, or null.
 *
 * Preference order is deliberate: an explicitly Chinese (mainland) locale
 * first, then any Chinese at all — a Taiwanese voice reads simplified text
 * correctly and is far better than silence — and never a fallback to whatever
 * the system default is, which would read 好 as the letters h-a-o.
 */
export function chineseVoice(): SpeechSynthesisVoice | null {
  if (cached !== undefined) return cached;
  const s = synth();
  if (!s) return (cached = null);
  const voices = s.getVoices();
  if (!voices.length) return null; // not loaded yet; do not cache the miss

  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    if (lang === 'zh-cn') return 3;
    if (lang.startsWith('zh')) return 2;
    return 0;
  };
  const best = voices
    .map((v) => ({ v, n: score(v) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  return (cached = best?.v ?? null);
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
export function speak(text: string, opts: { rate?: number } = {}) {
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
  s.speak(u);
  return true;
}

export const stopSpeaking = () => synth()?.cancel();
