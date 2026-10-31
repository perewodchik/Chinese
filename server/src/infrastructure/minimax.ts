import type { Narrator } from '../application/ports';

const BASE = 'https://api.minimax.io/v1';

/** What MiniMax says when something is wrong: a code, and a message. */
interface BaseResp {
  status_code?: number;
  status_msg?: string;
}

/**
 * Where each sentence of a reading begins and ends, from the subtitle file
 * MiniMax links to. The file's shape is read loosely — an array of entries
 * with the text and its times in milliseconds — and anything else is null:
 * the page then places the sentences by their length.
 */
async function subtitles(fetcher: typeof fetch, url: string | undefined) {
  if (!url) return null;
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    const list = Array.isArray(raw) ? raw : Array.isArray((raw as { subtitles?: unknown })?.subtitles) ? (raw as { subtitles: unknown[] }).subtitles : null;
    if (!list) return null;
    const out = list
      .map((e) => {
        const o = e as Record<string, unknown>;
        const start = Number(o.time_begin ?? o.start ?? o.begin);
        const end = Number(o.time_end ?? o.end);
        return { text: String(o.text ?? ''), start, end };
      })
      .filter((e) => Number.isFinite(e.start) && Number.isFinite(e.end) && e.end > e.start);
    return out.length ? out : null;
  } catch {
    return null;
  }
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
 * MiniMax's speech API: the Mandarin voices, a new voice made from a
 * description, and one sentence read aloud by speech-2.8-hd, which also
 * understands sound tags like (laughs).
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
    async design(key, prompt, previewText) {
      const out = await post<{ voice_id?: string; trial_audio?: string }>('/voice_design', key, { prompt, preview_text: previewText });
      if (!out.voice_id) throw new NarratorRefused('MiniMax made no voice from that description.', 'other');
      return { voiceId: out.voice_id, trial: new Uint8Array(Buffer.from(out.trial_audio ?? '', 'hex')) };
    },
    async readText(key, text, voice, tuning) {
      const out = await post<{ data?: { audio?: string; subtitle_file?: string } | null }>('/t2a_v2', key, {
        model: 'speech-2.8-hd',
        text,
        stream: false,
        language_boost: 'Chinese',
        subtitle_enable: true,
        subtitle_type: 'sentence',
        voice_setting: { voice_id: voice, speed: tuning.speed, vol: 1, pitch: tuning.pitch, ...(tuning.emotion ? { emotion: tuning.emotion } : {}) },
        audio_setting: { sample_rate: 32000, bitrate: 64000, format: 'mp3', channel: 1 },
      });
      const hex = out.data?.audio;
      if (!hex) throw new NarratorRefused('MiniMax sent no audio back.', 'other');
      return { audio: new Uint8Array(Buffer.from(hex, 'hex')), segments: await subtitles(fetcher, out.data?.subtitle_file) };
    },
    async read(key, text, voice, tuning) {
      const out = await post<{ data?: { audio?: string } | null }>('/t2a_v2', key, {
        model: 'speech-2.8-hd',
        text,
        stream: false,
        language_boost: 'Chinese',
        voice_setting: { voice_id: voice, speed: tuning.speed, vol: 1, pitch: tuning.pitch, ...(tuning.emotion ? { emotion: tuning.emotion } : {}) },
        audio_setting: { sample_rate: 32000, bitrate: 64000, format: 'mp3', channel: 1 },
      });
      const hex = out.data?.audio;
      if (!hex) throw new NarratorRefused('MiniMax sent no audio back.', 'other');
      return new Uint8Array(Buffer.from(hex, 'hex'));
    },
  };
}
