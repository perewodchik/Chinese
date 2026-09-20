import { useCallback, useEffect, useRef, useState } from 'react';
import { canRecognise, recogniseOnce, RECOGNITION_MESSAGE, type Hearing } from '../../platform/audio/recognition';
import { useRecorder, type RecorderState } from './useRecorder';

export type SayItState = RecorderState | 'checking';

/**
 * Saying something once, and being told everything that came of it.
 *
 * Tones are read off the pitch of a recording; the consonants and vowels are
 * read off what the browser's recogniser wrote down. Those are two machines,
 * but they are not two things to do: a learner says the sentence, once, and
 * wants to know how it came out. Asking for it twice — record, then a second
 * button to check the sounds — is the sort of seam that only makes sense to
 * whoever built it, and it leaves the record button with nothing to show for
 * itself on a page where the pitch chart is switched off.
 *
 * So both listen to the same breath. The recorder is the one that decides
 * when the sentence ended, because it can hear the room going quiet; the
 * recogniser is stopped with it and keeps what it had. Nothing is pressed to
 * finish, and nothing is pressed to find out.
 *
 * Recognition is the part that may simply not be there — many browsers have
 * none, and the ones that do need the network. When it is missing or fails,
 * the recording still happens and the melody is still drawn; the trouble is
 * reported beside the answer instead of in place of it.
 */
export function useSayIt(
  onRecorded: (samples: Float32Array) => void,
  onHeard: (alternatives: string[]) => void,
  maxMs = 4000,
) {
  const hearing = useRef<Hearing | null>(null);
  const [checking, setChecking] = useState(false);
  const [heardError, setHeardError] = useState<string | null>(null);
  const recorded = useRef(onRecorded);
  recorded.current = onRecorded;
  const said = useRef(onHeard);
  said.current = onHeard;

  const done = useCallback((samples: Float32Array) => {
    // The moment the recorder decides the sentence is over, the recogniser
    // has heard all there is; usually it has already settled on its own.
    if (hearing.current) {
      hearing.current.stop();
      setChecking(true);
    }
    recorded.current(samples);
  }, []);

  const rec = useRecorder(done, maxMs);

  // A microphone that would not open leaves the recogniser listening to
  // something nobody is going to compare it against. Let it go.
  useEffect(() => {
    if (!rec.error || !hearing.current) return;
    hearing.current.cancel();
    hearing.current = null;
    setChecking(false);
  }, [rec.error]);

  useEffect(() => () => hearing.current?.cancel(), []);

  const toggle = useCallback(() => {
    if (rec.state !== 'idle') {
      rec.toggle();
      return;
    }
    setHeardError(null);
    if (canRecognise()) {
      // Well past the recorder's own ceiling, so it is the recording that
      // says when the sentence ended and this is only a backstop.
      const session = recogniseOnce(maxMs + 4000);
      hearing.current = session;
      void session.result
        .then(({ alternatives }) => said.current(alternatives.map((a) => a.transcript)))
        .catch((e: Error) => {
          if (e.message === 'aborted') return;
          setHeardError(RECOGNITION_MESSAGE[e.message] ?? `Speech recognition stopped (${e.message}).`);
        })
        .finally(() => {
          hearing.current = null;
          setChecking(false);
        });
    }
    rec.toggle();
  }, [rec, maxMs]);

  /** the recorder's own state, plus the moment after it where the sounds are still being worked out */
  const state: SayItState = checking && rec.state === 'idle' ? 'checking' : rec.state;

  return {
    state,
    level: rec.level,
    /** the microphone could not be used */
    error: rec.error,
    /** the microphone was fine, but the recogniser was not */
    heardError,
    toggle,
    play: rec.play,
  };
}
