import { createContext, useContext } from 'react';
import type { VideoStep } from '../../navigation/paths';
import type { Video, VideoLine, VideoPack } from '../../domain/video';
import type { PlayerState } from './YouTubePlayer';

/** Where the steps get the video, the part and the player from. */
export interface VideoCtx {
  video: Video;
  part: number;
  lines: VideoLine[];
  /** the index in the whole video of the part's first line */
  offset: number;
  pack: VideoPack | undefined;
  /** play one line of the part (by its index in the part), or the whole part */
  playLine: (i: number) => void;
  playPart: () => void;
  /** whether lines can be played on their own: they have times, and it is a YouTube video */
  canPlay: boolean;
  player: PlayerState;
  go: (step: VideoStep) => void;
}

export const VideoContext = createContext<VideoCtx | null>(null);
/** The video page's steps are only ever drawn inside it. */
export function useVideoCtx(): VideoCtx {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('A video step was drawn outside its video page.');
  return ctx;
}
