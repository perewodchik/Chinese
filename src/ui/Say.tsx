import { useEffect, useState } from 'react';
import { canSpeak, onVoicesReady, speak } from '../platform/speech';

/**
 * A speaker you can click, which disappears when there is nothing to click it
 * with.
 *
 * Whether a machine has a Mandarin voice installed is not something the app
 * can fix, and a dead button that does nothing when pressed is worse than no
 * button. So it renders only when a voice has actually been found — and it
 * waits for the voice list, which on some browsers arrives after first paint.
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
  const [ready, setReady] = useState(canSpeak);

  useEffect(() => onVoicesReady(() => setReady(canSpeak())), []);

  if (!ready || !text.trim()) return null;
  return (
    <button
      className={`say ${size}`}
      title={title ?? `Hear ${text}`}
      aria-label={`Hear ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      🔊
    </button>
  );
}
