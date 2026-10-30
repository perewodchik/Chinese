import type { Narrator } from '../application/ports';

const BASE = 'https://api.minimax.io/v1';

/** What MiniMax says when something is wrong: a code, and a message. */
interface BaseResp {
  status_code?: number;
  status_msg?: string;
}

/** A refusal from MiniMax that the learner can act on: a bad key, no balance, too fast. */
export class NarratorRefused extends Error {
  constructor(
    message: string,
    readonly reason: 'key' | 'balance' | 'busy' | 'other',
  ) {
    super(message);
  }
}

function refusal(base: BaseResp | undefined, status: number): NarratorRefused {
  const code = base?.status_code ?? status;
  const msg = base?.status_msg ?? `HTTP ${status}`;
  if (code === 1004 || code === 2049 || status === 401) return new NarratorRefused('MiniMax did not accept the key.', 'key');
  if (code === 1008 || /balance|insufficient/i.test(msg)) return new NarratorRefused('The MiniMax account has no balance left for the API.', 'balance');
  if (code === 1002 || status === 429) return new NarratorRefused('MiniMax asked to slow down. Try again in a minute.', 'busy');
  return new NarratorRefused(`MiniMax said: ${msg}`, 'other');
}

/**
 * MiniMax's speech API: the Mandarin voices, and one sentence read aloud by
 * speech-2.8-hd, which also understands sound tags like (laughs).
 */
export function minimaxNarrator(fetcher: typeof fetch = fetch): Narrator {
  const post = async <T,>(path: string, key: string, body: unknown): Promise<T> => {
    const res = await fetcher(`${BASE}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as (T & { base_resp?: BaseResp }) | null;
    if (!res.ok || !json || (json.base_resp?.status_code ?? 0) !== 0) throw refusal(json?.base_resp, res.status);
    return json;
  };
  return {
    async voices(key) {
      const out = await post<{ system_voice?: Array<{ voice_id: string; voice_name?: string; description?: string[] }> }>('/get_voice', key, { voice_type: 'system' });
      return (out.system_voice ?? [])
        .filter((v) => /^Chinese \(Mandarin\)/.test(v.voice_id))
        .map((v) => ({ id: v.voice_id, name: v.voice_name || v.voice_id.replace(/^Chinese \(Mandarin\)_/, '').replace(/_/g, ' '), description: (v.description ?? []).join(' ') }));
    },
    async read(key, text, voice, speed) {
      const out = await post<{ data?: { audio?: string } | null }>('/t2a_v2', key, {
        model: 'speech-2.8-hd',
        text,
        stream: false,
        language_boost: 'Chinese',
        voice_setting: { voice_id: voice, speed, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 64000, format: 'mp3', channel: 1 },
      });
      const hex = out.data?.audio;
      if (!hex) throw new NarratorRefused('MiniMax sent no audio back.', 'other');
      return new Uint8Array(Buffer.from(hex, 'hex'));
    },
  };
}
