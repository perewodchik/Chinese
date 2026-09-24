import { useState } from 'react';
import { picturesFor, type Picture, type WordPart } from '../../data/pictures';
import './pictures.css';

/**
 * What a word looks like: a real photo of the thing, and for a compound, the
 * sum it is made of — 火 fire + 车 car = 火车 train.
 *
 * The sum is the point for compounds. 电脑 is "electric brain" before it is
 * "computer", and a learner who has seen the brain will not forget which two
 * characters the computer is written with. Parts that are grammar rather than
 * things — the 们 of 我们 — are shown as words, never with a picture forced
 * onto them.
 *
 * Every box has its size before its photo arrives, so opening a word never
 * shifts what is under it. Nothing is drawn over a photo; the characters sit
 * under it.
 */
export function WordPicture({ word, compact }: { word: string; compact?: boolean }) {
  const p = picturesFor(word);
  if (!p) return null;
  if (p.parts && p.parts.length > 1) {
    return <WordSum word={word} picture={p.picture} parts={p.parts} compact={compact} />;
  }
  if (!p.picture) return null;
  return (
    <figure className="wp-photo" data-compact={compact || undefined}>
      <Photo picture={p.picture} alt={word} />
      {!compact && <Credit picture={p.picture} />}
    </figure>
  );
}

function WordSum({
  word,
  picture,
  parts,
  compact,
}: {
  word: string;
  picture: Picture | null;
  parts: WordPart[];
  compact?: boolean;
}) {
  // A grid rather than a row of boxes: the photos share one row, so the + and
  // = between them sit level with the photos' middles at any width, and the
  // characters and glosses share the rows under them.
  const cols = [...parts.map(() => 'minmax(0, 1fr) 18px'), 'minmax(0, 1.35fr)'].join(' ');
  const maxWidth = Math.min(compact ? 420 : 9999, parts.length * (118 + 18) + 160);
  const cell = (col: number, row: number) => ({ gridColumn: col, gridRow: row });
  return (
    <figure
      className="wp-sum"
      data-compact={compact || undefined}
      aria-label={`${parts.map((x) => x.gloss).join(' + ')} = ${word}`}
    >
      <div className="wp-grid" style={{ gridTemplateColumns: cols, maxWidth }}>
        {parts.map((part, i) => {
          const col = i * 2 + 1;
          return (
            <PartCells key={i} col={col} cell={cell} op={i < parts.length - 1 ? '+' : '='} part={part} />
          );
        })}
        {picture ? (
          <>
            <span className="wp-img wp-result" style={cell(parts.length * 2 + 1, 1)}>
              <Photo picture={picture} alt={word} />
            </span>
            <span className="wp-han hanzi wp-result" style={cell(parts.length * 2 + 1, 2)}>
              {word}
            </span>
          </>
        ) : (
          // No photo for the whole: the word itself stands where it would be.
          <span className="wp-solo hanzi wp-result" data-len={Math.min(4, [...word].length)} style={cell(parts.length * 2 + 1, 1)}>
            <span>{word}</span>
          </span>
        )}
      </div>
      {!compact && (
        <figcaption className="tiny muted wp-credit">
          Photos from Wikimedia Commons ·{' '}
          <a href="/images/words/CREDITS.md" target="_blank" rel="noreferrer">
            credits
          </a>
        </figcaption>
      )}
    </figure>
  );
}

function PartCells({
  col,
  cell,
  op,
  part,
}: {
  col: number;
  cell: (col: number, row: number) => { gridColumn: number; gridRow: number };
  op: string;
  part: WordPart;
}) {
  return (
    <>
      {part.picture ? (
        <span className="wp-img" style={cell(col, 1)}>
          <Photo picture={part.picture} alt={part.gloss} />
        </span>
      ) : (
        // A part that is not a thing — 们, 么, 意 — is its character, not an empty frame.
        <span className="wp-solo hanzi" data-grammar={part.grammar || undefined} style={cell(col, 1)}>
          <span>{part.ch}</span>
        </span>
      )}
      <span className="wp-op" aria-hidden style={cell(col + 1, 1)}>
        {op}
      </span>
      <span className="wp-han hanzi" style={cell(col, 2)}>
        {part.ch}
      </span>
      <span className="wp-gloss" data-grammar={part.grammar || undefined} style={cell(col, 3)}>
        {part.gloss}
      </span>
    </>
  );
}

/** One photo in a box that already has its shape; fades in when it arrives. */
function Photo({ picture, alt }: { picture: Picture; alt: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="wp-blank" aria-hidden />;
  return (
    <img
      src={picture.src}
      alt={alt}
      title={`Photo: ${picture.by} · ${picture.lic}`}
      loading="lazy"
      decoding="async"
      width={picture.w}
      height={picture.h}
      data-ready={ready || undefined}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
    />
  );
}

function Credit({ picture }: { picture: Picture }) {
  return (
    <figcaption className="tiny muted wp-credit">
      Photo: {picture.by} ·{' '}
      <a href={picture.page} target="_blank" rel="noreferrer">
        {picture.lic}
      </a>
    </figcaption>
  );
}
