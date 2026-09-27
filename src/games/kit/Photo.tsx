import { useState } from 'react';
import { picturesFor } from '../../data/pictures';

/**
 * A word's photo in a square that has its size before the photo arrives. A
 * word without one shows the word itself, so a game never has an empty hole.
 */
export function Photo({ word, showWord }: { word: string; showWord?: boolean }) {
  const pic = picturesFor(word)?.picture ?? null;
  const [ready, setReady] = useState(false);
  return (
    <span className="g-photo">
      {pic ? (
        <img
          src={pic.src}
          alt=""
          draggable={false}
          title={`Photo: ${pic.by} · ${pic.lic}`}
          data-ready={ready || undefined}
          onLoad={() => setReady(true)}
        />
      ) : (
        <span className="g-photo-word hanzi">{word}</span>
      )}
      {showWord && pic && <span className="g-photo-cap hanzi">{word}</span>}
    </span>
  );
}
