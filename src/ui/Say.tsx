import { useEffect, useState } from 'react';
import { canSpeak, onVoicesReady } from '../platform/speech';
import { canPronounce, say } from '../platform/audio/voiceOut';

/**
 * A speaker you can click, which disappears when there is nothing to click it
 * with.
 *
 * It plays what every other sound in the app plays: a native speaker's
 * recording when the pack has one of this text, and the system voice only
 * when it does not (see `say` in voiceOut). A character in the drawer and the
 * same character in a tone drill are heard in the same voice.
 *
 * It renders only once something can actually say the text — a recording, or
 * a Chinese system voice, whose list on some browsers arrives after first
 * paint. A dead button that does nothing when pressed is worse than none.
 */
export function Say({
  text,
  size = 'sm',
  title,
}: {
  text: string;
  size?: 'sm' | 'lg';
  title?: string;
}) {
  // Shown at once where a system voice is known to exist, so the button does
  // not pop in a moment after the rest of the line; the pack is only asked
  // when that alone would hide it.
  const [ready, setReady] = useState(canSpeak);

  useEffect(() => {
    let live = true;
    const check = () => void canPronounce(text).then((ok) => live && setReady(ok));
    check();
    const off = onVoicesReady(check);
    return () => {
      live = false;
      off();
    };
  }, [text]);

  if (!ready || !text.trim()) return null;
  return (
    <button
      className={`say ${size}`}
      title={title ?? `Hear ${text}`}
      aria-label={`Hear ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        void say(text);
      }}
    >
      🔊
    </button>
  );
}
