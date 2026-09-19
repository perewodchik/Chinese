import type { SpeechSynthesizer, VoiceInfo } from '../application/ports';

/**
 * Mandarin read aloud by Azure's neural voices.
 *
 * Chosen over the alternatives for three reasons. The voices are good enough
 * to imitate — natural sandhi, natural rhythm — which the system voice on a
 * tablet is not. There is a free tier (half a million characters a month) that
 * a learner practising daily will not use up, since every clip is cached by
 * the browser after the first time. And it is one HTTPS request with a key,
 * no SDK to bundle into the function.
 *
 * Three voices rather than one, because hearing a sound in several voices is
 * what teaches the ear which part of it is the sound and which is the speaker.
 */

export const AZURE_VOICES: Array<VoiceInfo & { azure: string }> = [
  { id: 'xiaoxiao', name: 'Xiaoxiao', gender: 'female', azure: 'zh-CN-XiaoxiaoNeural' },
  { id: 'yunxi', name: 'Yunxi', gender: 'male', azure: 'zh-CN-YunxiNeural' },
  { id: 'xiaoyi', name: 'Xiaoyi', gender: 'female', azure: 'zh-CN-XiaoyiNeural' },
];

type Fetch = typeof fetch;

export class SpeechServiceError extends Error {}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function azureSpeech(opts: { key: string; region: string; fetch?: Fetch }): SpeechSynthesizer {
  // The region becomes part of a host name; anything but a plain region name
  // is a mistake in the environment, and should not become a request elsewhere.
  if (!/^[a-z0-9]+$/.test(opts.region)) throw new Error(`AZURE_SPEECH_REGION “${opts.region}” is not a region name.`);
  const endpoint = `https://${opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const doFetch = opts.fetch ?? fetch;

  return {
    voices: AZURE_VOICES.map(({ id, name, gender }) => ({ id, name, gender })),
    async synthesize(text, voice, slow) {
      const v = AZURE_VOICES.find((x) => x.id === voice);
      if (!v) throw new SpeechServiceError(`No voice called ${voice}.`);
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
        `<voice name="${v.azure}"><prosody rate="${slow ? '-25%' : '0%'}">${escapeXml(text)}</prosody></voice>` +
        `</speak>`;
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': opts.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'hanzi-workshop',
        },
        body: ssml,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // 401 is a wrong key, 429 the free tier used up or too fast, 400 bad SSML.
        throw new SpeechServiceError(`Azure speech answered ${res.status}.`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/** The synthesizer the environment describes, or null when it describes none. */
export function speechFromEnv(env: Record<string, string | undefined>): SpeechSynthesizer | null {
  const key = env.AZURE_SPEECH_KEY?.trim();
  const region = env.AZURE_SPEECH_REGION?.trim().toLowerCase();
  if (!key || !region) return null;
  return azureSpeech({ key, region });
}
