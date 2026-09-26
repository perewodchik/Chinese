import type { PlaylistLookup, VideoLookup } from '../../shared/videos';
import { request } from './http';

/**
 * A YouTube video's details and captions, fetched by the server — the page
 * cannot reach YouTube itself. Slow by nature: two round trips to YouTube.
 */
export function lookUpYouTube(videoId: string): Promise<VideoLookup> {
  return request<VideoLookup>('GET', `/api/videos/youtube/${encodeURIComponent(videoId)}`, { timeoutMs: 45_000 });
}

/** The videos a YouTube playlist lists, in its order. */
export function lookUpPlaylist(playlistId: string): Promise<PlaylistLookup> {
  return request<PlaylistLookup>('GET', `/api/videos/playlist/${encodeURIComponent(playlistId)}`, { timeoutMs: 45_000 });
}
