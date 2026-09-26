import type { CaptionCue, CaptionSource, PlaylistLookup, VideoLookup } from '../../../shared/videos';

/**
 * A YouTube video's details and captions, the way YouTube's own apps fetch
 * them.
 *
 * There is no key-free official API for captions. What works — and what the
 * widely used youtube-transcript-api does — is: read the public watch page for
 * the key its own player uses, ask the player endpoint about the video as the
 * Android app would (that answer carries caption tracks the web answer
 * sometimes withholds), then fetch the track as timed text.
 *
 * YouTube refuses some of this from cloud servers' addresses. That is not
 * treated as a crash: it comes back as `YouTubeRefused`, and the page offers
 * to paste the text instead, or to try again from the home computer.
 */

export class YouTubeRefused extends Error {}
export class YouTubeNotFound extends Error {}

const ANDROID = { clientName: 'ANDROID', clientVersion: '20.10.38' };
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};
const TIMEOUT_MS = 15_000;

interface Track {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

interface PlayerAnswer {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string; author?: string; lengthSeconds?: string; shortDescription?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } };
}

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 429 || res.status === 403) throw new YouTubeRefused(`YouTube answered ${res.status}.`);
  return res;
}

export async function lookUpVideo(videoId: string): Promise<VideoLookup> {
  const page = await (await get(`https://www.youtube.com/watch?v=${videoId}`, { headers: HEADERS })).text();
  if (page.includes('action="https://consent.youtube.com/s"')) throw new YouTubeRefused('YouTube asked for cookie consent.');
  if (page.includes('class="g-recaptcha"')) throw new YouTubeRefused('YouTube asked this server to prove it is a person.');
  const key = page.match(/"INNERTUBE_API_KEY":\s*"([A-Za-z0-9_-]+)"/)?.[1];
  if (!key) throw new YouTubeRefused('The watch page did not have what the player needs.');

  const res = await get(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: { client: ANDROID }, videoId }),
  });
  const player = (await res.json()) as PlayerAnswer;
  const status = player.playabilityStatus?.status;
  if (status === 'ERROR') throw new YouTubeNotFound(player.playabilityStatus?.reason ?? 'There is no such video.');
  if (status === 'LOGIN_REQUIRED' && !player.videoDetails)
    throw new YouTubeRefused(player.playabilityStatus?.reason ?? 'YouTube wanted a signed-in viewer.');

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const zh = pickChinese(tracks);
  const en = tracks.find((t) => t.languageCode.startsWith('en') && t.kind !== 'asr') ?? tracks.find((t) => t.languageCode.startsWith('en'));

  const details = player.videoDetails ?? {};
  return {
    videoId,
    title: details.title ?? '',
    channel: details.author ?? '',
    seconds: Number(details.lengthSeconds ?? 0) || 0,
    description: (details.shortDescription ?? '').slice(0, 2000),
    chinese: zh
      ? {
          source: (zh.kind === 'asr' ? 'captions-auto' : 'captions') satisfies CaptionSource,
          language: zh.languageCode,
          cues: await cuesOf(zh),
        }
      : null,
    english: en ? await cuesOf(en) : null,
    languages: tracks.map((t) => (t.kind === 'asr' ? `${t.languageCode} (auto)` : t.languageCode)),
  };
}

/** Simplified the channel made, then any Chinese it made, then YouTube's own recognition. */
function pickChinese(tracks: Track[]): Track | undefined {
  const zh = tracks.filter((t) => /^(zh|cmn)/i.test(t.languageCode));
  const made = zh.filter((t) => t.kind !== 'asr');
  const rank = (t: Track) => (/hans|cn|sg/i.test(t.languageCode) ? 0 : /^(zh|cmn)$/i.test(t.languageCode) ? 1 : 2);
  return [...made].sort((a, b) => rank(a) - rank(b))[0] ?? zh[0];
}

async function cuesOf(track: Track): Promise<CaptionCue[]> {
  const xml = await (await get(track.baseUrl.replace('&fmt=srv3', ''), { headers: HEADERS })).text();
  return parseTimedText(xml);
}

/** `<text start="2.7" dur="1.3">我是佩奇\nwǒ shì pèi qí</text>` → cues. */
export function parseTimedText(xml: string): CaptionCue[] {
  const out: CaptionCue[] = [];
  for (const m of xml.matchAll(/<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
    const at = Number(m[1]);
    const dur = Number(m[2] ?? 0);
    const text = decode(m[3]!.replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    out.push({ at: round(at), end: round(at + dur), text });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function decode(s: string): string {
  // Decoded twice: YouTube escapes the ampersands of entities it has already escaped.
  const once = (x: string) =>
    x
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  return once(once(s));
}

/* -------------------------------------------------------------- playlists */

type Json = Record<string, unknown>;

/** "5:17" or "1:02:03" as seconds. */
const lengthOf = (t: unknown) =>
  typeof t === 'string' && /^\d+(:\d+)+$/.test(t) ? t.split(':').reduce((a, p) => a * 60 + Number(p), 0) : 0;

/**
 * The videos a page's data lists, whichever of YouTube's two layouts it is
 * in — the older `playlistVideoRenderer` or the newer `lockupViewModel` — and
 * the token for the next page, if there is one.
 */
function readItems(data: unknown): { videos: PlaylistLookup['videos']; next: string | null } {
  const videos: PlaylistLookup['videos'] = [];
  let next: string | null = null;
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object') return;
    const j = o as Json;
    const old = j.playlistVideoRenderer as Json | undefined;
    if (old && typeof old.videoId === 'string') {
      const title = ((old.title as Json)?.runs as Json[] | undefined)?.[0]?.text;
      videos.push({ videoId: old.videoId, title: typeof title === 'string' ? title : '', seconds: Number(old.lengthSeconds) || 0 });
      return;
    }
    const lockup = j.lockupViewModel as Json | undefined;
    if (lockup && typeof lockup.contentId === 'string' && String(lockup.contentType).includes('VIDEO')) {
      const title = (((lockup.metadata as Json)?.lockupMetadataViewModel as Json)?.title as Json)?.content;
      let badge: unknown = null;
      const findBadge = (x: unknown) => {
        if (badge || !x || typeof x !== 'object') return;
        const b = (x as Json).thumbnailBadgeViewModel as Json | undefined;
        if (b && typeof b.text === 'string') badge = b.text;
        else for (const k in x as Json) findBadge((x as Json)[k]);
      };
      findBadge(lockup.contentImage);
      videos.push({ videoId: lockup.contentId, title: typeof title === 'string' ? title : '', seconds: lengthOf(badge) });
      return;
    }
    const token = (((j.continuationItemRenderer as Json)?.continuationEndpoint as Json)?.continuationCommand as Json)?.token;
    if (typeof token === 'string') next = token;
    for (const k in j) walk(j[k]);
  };
  walk(data);
  return { videos, next };
}

/** A playlist's videos: its public page, then as many further pages as it has (up to a few hundred videos). */
export async function lookUpPlaylist(playlistId: string): Promise<PlaylistLookup> {
  const page = await (await get(`https://www.youtube.com/playlist?list=${playlistId}`, { headers: HEADERS })).text();
  if (page.includes('action="https://consent.youtube.com/s"')) throw new YouTubeRefused('YouTube asked for cookie consent.');
  const raw = page.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  if (!raw) throw new YouTubeRefused('The playlist page did not have its list in it.');
  const data = JSON.parse(raw) as Json;
  const title = ((data.metadata as Json)?.playlistMetadataRenderer as Json)?.title;
  const first = readItems(data);
  if (!first.videos.length && page.includes('"alerts"')) throw new YouTubeNotFound('That playlist is empty, private or gone.');

  const videos = [...first.videos];
  let next = first.next;
  const key = page.match(/"INNERTUBE_API_KEY":\s*"([A-Za-z0-9_-]+)"/)?.[1];
  const version = page.match(/"INNERTUBE_CLIENT_VERSION":\s*"([\d.]+)"/)?.[1];
  for (let pages = 0; next && key && version && pages < 5; pages++) {
    const res = await get(`https://www.youtube.com/youtubei/v1/browse?key=${key}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: version } }, continuation: next }),
    });
    const more = readItems(await res.json());
    videos.push(...more.videos);
    next = more.next;
  }
  const seen = new Set<string>();
  return {
    playlistId,
    title: typeof title === 'string' ? title : 'A playlist',
    videos: videos.filter((v) => !seen.has(v.videoId) && seen.add(v.videoId)),
    more: !!next,
  };
}
