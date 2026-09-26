import type { ItemId } from '../domain/ids';
import type { DictationCheck, Video, VideoAsk, VideoLine, VideoPack } from '../domain/video';
import { newId } from '../platform/ids';
import type { VideoPatch } from './actions';
import { addItems, createCollection } from './commands';
import { dispatch, getState } from './store';

/**
 * Everything the Videos tab can do to what an account has saved. Ids and the
 * clock are read here, so the actions stay plain data (see commands.ts).
 */

const now = () => Date.now();

export const findVideo = (id: string) => getState().videos.find((v) => v.id === id) ?? null;

export function addVideo(video: Video) {
  dispatch({ type: 'video/add', video });
}

export function patchVideo(id: string, patch: VideoPatch) {
  dispatch({ type: 'video/patch', id, patch, at: now() });
}

export function setVideoLine(id: string, index: number, line: Partial<VideoLine>) {
  dispatch({ type: 'video/line', id, index, line, at: now() });
}

export function saveVideoPack(id: string, part: number, pack: VideoPack) {
  dispatch({ type: 'video/pack', id, part, pack, at: now() });
}

/**
 * A notebook check, kept. Passing the id of one just saved replaces it — the
 * marks were changed — and does not count as another sitting.
 */
export function saveCheck(id: string, check: Omit<DictationCheck, 'id' | 'at'>, replacing?: string): DictationCheck {
  const full: DictationCheck = { ...check, id: replacing ?? newId(), at: now() };
  dispatch({ type: 'video/check', id, check: full });
  // A notebook check is a sitting of practice like any other: it fills the day in.
  if (!replacing) dispatch({ type: 'activity/log', at: full.at, add: { videos: 1 } });
  return full;
}

export function saveAsk(id: string, part: number, q: string, a: string): VideoAsk {
  const ask: VideoAsk = { id: newId(), part, q, a, at: now() };
  dispatch({ type: 'video/ask', id, ask });
  return ask;
}

export function recordWatch(id: string) {
  const at = now();
  dispatch({ type: 'video/watch', id, at });
  dispatch({ type: 'activity/log', at, add: { videos: 1 } });
}

export function deleteVideo(id: string) {
  dispatch({ type: 'video/delete', id });
}

const VIDEO_PRESET = 'words-videos';

/**
 * Words and characters met in a video, kept to learn: into one collection for
 * all of them, made the first time, so the Words drill brings them in with the
 * rest. Returns how many were new to it.
 */
export function keepVideoItems(ids: ItemId[]): number {
  const found = getState().collections.find((c) => c.presetId === VIDEO_PRESET);
  const target =
    found?.id ??
    createCollection({
      name: 'Words from videos',
      presetId: VIDEO_PRESET,
      note: 'Words and characters you met in videos and chose to learn. The Words drill brings the words in a few a day.',
    }).id;
  return addItems(target, ids);
}

/** The collection kept words go into, if there is one yet. */
export const videoWordsCollection = () => getState().collections.find((c) => c.presetId === VIDEO_PRESET) ?? null;
