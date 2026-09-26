/**
 * A video looked up by the server: what YouTube says it is, and what is said
 * in it.
 *
 * The page cannot ask YouTube itself — the site's content policy only lets it
 * talk to its own server, and YouTube would not answer a page from another
 * site anyway — so the server fetches the captions and hands them over as
 * plain lines. Everything else about a video (the pinyin, how well it fits,
 * the notebook work) is worked out in the app from these.
 */

export interface CaptionCue {
  /** seconds from the start */
  at: number;
  /** seconds from the start */
  end: number;
  /** the caption as written, line breaks kept: some channels put 汉字, pinyin and English in one cue */
  text: string;
}

/**
 * Where the Chinese came from:
 * - `captions` — a track the channel made
 * - `captions-auto` — YouTube's own speech recognition, which gets things wrong
 */
export type CaptionSource = 'captions' | 'captions-auto';

export interface VideoLookup {
  videoId: string;
  title: string;
  channel: string;
  seconds: number;
  description: string;
  /** the Chinese track, or null when the video has none */
  chinese: { source: CaptionSource; language: string; cues: CaptionCue[] } | null;
  /** an English track, for translations, when there is one */
  english: CaptionCue[] | null;
  /** every track there is, for saying why nothing Chinese was found */
  languages: string[];
}

/** A playlist's videos, in its order. */
export interface PlaylistLookup {
  playlistId: string;
  title: string;
  videos: Array<{ videoId: string; title: string; seconds: number }>;
  /** the playlist goes on past what could be read */
  more: boolean;
}

/** A playlist id: PL…, UU…, OL… and the like. */
export const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

/** YouTube's ids are eleven characters of this. */
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
