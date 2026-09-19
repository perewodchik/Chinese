import { useCallback, useEffect, useRef, useState } from 'react';
import { MicError, MicSession, MIC_MESSAGE } from '../../platform/audio/mic';

export type RecorderState = 'idle' | 'opening' | 'listening' | 'hearing';

/**
 * A record button's worth of state: open the microphone on the first tap,
 * listen, and stop by itself once the word is over.
 *
 * Stopping by itself matters more than it sounds. Tapping "stop" is a second
 * thing to think about while trying to hold a tone, and the tap lands in the
 * recording; people end up clipping the last syllable or trailing a second of
 * silence. So the recorder waits for voice, then for the voice to stop — 0.7s
 * of quiet — with a hard ceiling in case the room never goes quiet.
 */
export function useRecorder(onDone: (samples: Float32Array) => void, maxMs = 4000) {
  const session = useRef<MicSession | null>(null);
  const [state, setState] = useState<RecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const watch = useRef<{ timer?: ReturnType<typeof setTimeout>; stop?: () => void }>({});

  useEffect(
    () => () => {
      clearTimeout(watch.current.timer);
      session.current?.close();
      session.current = null;
    },
    [],
  );

  const finish = useCallback(() => {
    const s = session.current;
    clearTimeout(watch.current.timer);
    if (!s) return;
    s.onLevel = (rms) => setLevel(rms);
    const samples = s.stop();
    setState('idle');
    setLevel(0);
    done.current(samples);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!session.current) {
      setState('opening');
      try {
        session.current = await MicSession.open();
      } catch (e) {
        setState('idle');
        setError(e instanceof MicError ? e.message : MIC_MESSAGE.failed);
        return;
      }
    }
    const s = session.current;
    const began = performance.now();
    let noise = Infinity;
    let heard = false;
    let quietSince = 0;
    s.onLevel = (rms) => {
      setLevel(rms);
      const now = performance.now();
      // The first fifth of a second is the room, before anyone speaks.
      if (now - began < 200) {
        noise = Math.min(noise, rms);
        return;
      }
      const floor = Number.isFinite(noise) ? noise : 0.002;
      if (!heard && rms > Math.max(floor * 4, 0.012)) {
        heard = true;
        setState('hearing');
      }
      if (heard) {
        if (rms < Math.max(floor * 2, 0.006)) {
          quietSince ||= now;
          if (now - quietSince > 700) finish();
        } else quietSince = 0;
      }
    };
    s.start();
    setState('listening');
    watch.current.timer = setTimeout(finish, maxMs);
  }, [finish, maxMs]);

  const toggle = useCallback(() => {
    if (state === 'listening' || state === 'hearing') finish();
    else if (state === 'idle') void start();
  }, [state, start, finish]);

  const play = useCallback((samples: Float32Array) => session.current?.play(samples), []);

  return { state, level, error, toggle, play, ready: !!session.current };
}
