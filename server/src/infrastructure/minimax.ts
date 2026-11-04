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
  if (code === 1008 || /balance|insufficient/i.test(msg)) return new NarratorRefused(`The MiniMax account has no balance left for the API (MiniMax said ${code}: ${msg}).`, 'balance');
  if (code === 1002 || status === 429) return new NarratorRefused('MiniMax asked to slow down. Try again in a minute.', 'busy');
  return new NarratorRefused(`MiniMax said: ${msg}`, 'other');
}

/**
 * MiniMax's older Chinese voices. The voice list does not name them, but the
 * speech API reads with them, and they have what a story's characters need
 * and the "Chinese (Mandarin)_" ones (all adults) do not: an audiobook
 * narrator, boys, a cartoon creature.
 */
export const OLDER_CHINESE_VOICES: Array<{ id: string; name: string; description: string }> = [
  { id: 'audiobook_male_1', name: 'Audiobook Narrator (Male)', description: 'A young adult male audiobook narrator in Standard Mandarin, clear and steady.' },
  { id: 'audiobook_male_2', name: 'Deep Audiobook Narrator (Male)', description: 'A deep adult male audiobook narrator in Standard Mandarin.' },
  { id: 'audiobook_female_1', name: 'Audiobook Narrator (Female)', description: 'An adult female audiobook narrator in Standard Mandarin.' },
  { id: 'presenter_male', name: 'Presenter (Male)', description: 'An adult male presenter in Standard Mandarin.' },
  { id: 'male-qn-qingse', name: 'Young Man (Male)', description: 'A fresh, youthful young adult male voice in Standard Mandarin.' },
  { id: 'female-chengshu', name: 'Mature Woman (Female)', description: 'A mature adult female voice in Standard Mandarin.' },
  { id: 'clever_boy', name: 'Clever Boy (Male)', description: 'A clever young boy, about ten, in Standard Mandarin.' },
  { id: 'cute_boy', name: 'Cute Boy (Male)', description: 'A cute little boy in Standard Mandarin.' },
  { id: 'lovely_girl', name: 'Lovely Girl (Female)', description: 'A sweet little girl in Standard Mandarin.' },
  { id: 'cartoon_pig', name: 'Cartoon Creature', description: 'A cartoon animal character, squeaky and funny, in Standard Mandarin.' },
];

/** A Mandarin voice of MiniMax's: named "Chinese (Mandarin)_…", or one of its older Chinese ones. */
export const isMandarin = (id: string) => /^Chinese \(Mandarin\)_/.test(id) || OLDER_CHINESE_VOICES.some((v) => v.id === id);

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
        .filter((v) => isMandarin(v.voice_id))
        .map((v) => ({ id: v.voice_id, name: v.voice_name || v.voice_id.replace(/^Chinese \(Mandarin\)_/, '').replace(/_/g, ' '), description: (v.description ?? []).join(' ') }))
        .concat(OLDER_CHINESE_VOICES.filter((o) => !out.system_voice?.some((v) => v.voice_id === o.id)));
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
