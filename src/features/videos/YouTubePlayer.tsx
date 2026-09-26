import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * YouTube's own player, in a frame, driven from the page.
 *
 * The notebook work needs one thing the YouTube app cannot do: play exactly
 * one line — from where it starts to where it ends — and then again. The
 * frame is YouTube's (from youtube-nocookie.com, which sets no tracking
 * cookies until play), and it is steered with the same messages YouTube's
 * own IFrame API sends it, so no script from YouTube runs in this page and
 * the site's content policy only has to allow the frame.
 *
 * Natural speed only. Shadowing and the notebook are about speech as it is
 * spoken, and there is no speed control on purpose.
 *
 * On an iPad the very first play has to be a tap inside the video itself —
 * Safari will not let a page start sound in a frame from another site until
 * the person has touched it. When a play asked for does not start, the page
 * is told (`blocked`), so it can say so instead of looking broken.
 */

export interface PlayerHandle {
  /** play from `at` and stop at `end`; without `end`, play on */
  play: (at: number, end?: number) => void;
  pause: () => void;
}

export interface PlayerState {
  ready: boolean;
  playing: boolean;
  /** seconds, as last reported */
  time: number;
  /** a play was asked for and nothing started: a tap in the video is needed first */
  blocked: boolean;
}

const ORIGIN = 'https://www.youtube-nocookie.com';

interface Props {
  videoId: string;
  onState?: (s: PlayerState) => void;
  /** a stretch asked for with `end` was played to its end */
  onSegmentEnd?: () => void;
  /** the video was played through to the end */
  onEnded?: () => void;
}

export const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer(
  { videoId, onState, onSegmentEnd, onEnded },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<PlayerState>({ ready: false, playing: false, time: 0, blocked: false });
  const stopAt = useRef<number | null>(null);
  const loaded = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbs = useRef({ onState, onSegmentEnd, onEnded });
  cbs.current = { onState, onSegmentEnd, onEnded };

  const send = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }), ORIGIN);
  }, []);

  const update = useCallback((patch: Partial<PlayerState>) => setState((prev) => ({ ...prev, ...patch })), []);
  useEffect(() => cbs.current.onState?.(state), [state]);

  const clearTimers = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (waiting.current) clearTimeout(waiting.current);
    stopTimer.current = null;
    waiting.current = null;
  };

  // Talking to the frame: keep saying "listening" until it answers, then
  // read what it reports — ready, playing, where it is.
  useEffect(() => {
    let heard = false;
    const hello = setInterval(() => {
      // Until the frame has loaded YouTube, it is still about:blank, and a message to it goes nowhere.
      if (heard || !loaded.current) return;
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), ORIGIN);
    }, 250);

    function onMessage(e: MessageEvent) {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: unknown };
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      heard = true;
      if (data.event === 'onReady') update({ ready: true });
      if (data.event === 'infoDelivery' || data.event === 'initialDelivery') {
        const info = (data.info ?? {}) as { currentTime?: number; playerState?: number };
        const patch: Partial<PlayerState> = { ready: true };
        if (typeof info.currentTime === 'number') patch.time = info.currentTime;
        if (typeof info.playerState === 'number') onPlayerState(info.playerState, patch);
        update(patch);
        // A stretch with an end: stop there even if the timer is late.
        if (stopAt.current !== null && typeof info.currentTime === 'number' && info.currentTime >= stopAt.current) finishSegment();
      }
      if (data.event === 'onStateChange' && typeof data.info === 'number') {
        const patch: Partial<PlayerState> = {};
        onPlayerState(data.info, patch);
        update(patch);
      }
    }

    function onPlayerState(s: number, patch: Partial<PlayerState>) {
      // 1 playing, 2 paused, 0 ended, 3 buffering, 5 cued, -1 unstarted
      patch.playing = s === 1 || s === 3;
      if (s === 1) {
        patch.blocked = false;
        if (waiting.current) {
          clearTimeout(waiting.current);
          waiting.current = null;
        }
      }
      if (s === 0) {
        stopAt.current = null;
        cbs.current.onEnded?.();
      }
    }

    window.addEventListener('message', onMessage);
    return () => {
      clearInterval(hello);
      window.removeEventListener('message', onMessage);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, update]);

  function finishSegment() {
    if (stopAt.current === null) return;
    stopAt.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    send('pauseVideo');
    cbs.current.onSegmentEnd?.();
  }

  useImperativeHandle(
    ref,
    () => ({
      play(at, end) {
        clearTimers();
        stopAt.current = end ?? null;
        send('seekTo', [Math.max(0, at - 0.15), true]);
        send('playVideo');
        if (end !== undefined) {
          // Reports come a few times a second; the timer makes the stop exact.
          // A little is allowed for the seek before the sound starts.
          stopTimer.current = setTimeout(finishSegment, (end - at + 0.35) * 1000 + 250);
        }
        waiting.current = setTimeout(() => setState((prev) => (prev.playing ? prev : { ...prev, blocked: true })), 1800);
      },
      pause() {
        clearTimers();
        stopAt.current = null;
        send('pauseVideo');
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send],
  );

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const src = `${ORIGIN}/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`;

  return (
    <div className="yt-frame" data-ready={state.ready || undefined}>
      <iframe
        ref={frame}
        src={src}
        title="Video"
        // The site sends no referrer; YouTube will not play an embed without one.
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        onLoad={() => (loaded.current = true)}
      />
    </div>
  );
});
