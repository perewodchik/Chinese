import { useState } from 'react';
import { pictureUrl } from '../../api/pictures';
import type { TextPicture } from '../../domain/pictures';
import type { TextLine } from '../../domain/text';
import { Modal } from '../../ui/Modal';

/** A line of a comic, where it is on its page's photo. */
export interface PictureMark {
  i: number;
  box: NonNullable<TextLine['box']>;
  label: string;
  line: TextLine;
}

/**
 * A paragraph's picture, in a box the size of the picture from the start, so
 * the text never moves when it arrives: large above the paragraph, or small
 * beside its first lines, the text running round it. A tap shows it larger.
 *
 * A comic's page photo carries its lines' places (`marks`): each is a spot on
 * the photo, and a tap there says under the photo what is written there —
 * the Chinese, its pinyin, what it means — and lights the line in the text.
 * That is how a sound effect or a sign drawn into the art, which has no
 * bubble to point at, gets its meaning. The spots are drawn faintly, not left
 * to hover, since the iPad has none; the room for what a tap says is there
 * from the start, so the text never moves when it is filled.
 */
export function ParagraphPicture({
  picture,
  size,
  marks,
  onMark,
}: {
  picture: TextPicture;
  size: 'beside' | 'large';
  marks?: PictureMark[];
  onMark?: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<PictureMark | null>(null);
  if (!picture.key || !picture.w || !picture.h) return null;
  const src = pictureUrl(picture.key);
  const ratio = `${picture.w} / ${picture.h}`;
  // Beside, it sits inside the paragraph, where a figure may not go.
  const Box = size === 'beside' ? 'span' : 'figure';
  const spots = size === 'large' && onMark ? (marks ?? []) : [];
  return (
    <Box className="rd-pic no-print" data-size={size}>
      {spots.length ? (
        <div className="rd-pic-frame rd-pic-page" style={{ aspectRatio: ratio }}>
          <button className="rd-pic-zoom" onClick={() => setOpen(true)} aria-label="Show the page larger">
            <img src={src} alt="" width={picture.w} height={picture.h} loading="lazy" decoding="async" />
          </button>
          {spots.map((m) => (
            <button
              key={m.i}
              className="rd-pic-spot"
              data-on={said?.i === m.i || undefined}
              style={{ left: `${m.box[0]}%`, top: `${m.box[1]}%`, width: `${m.box[2]}%`, height: `${m.box[3]}%` }}
              onClick={() => (setSaid(m), onMark!(m.i))}
              aria-label={`${m.label}: show what it says`}
            />
          ))}
        </div>
      ) : (
        <button className="rd-pic-frame" style={size === 'large' ? { aspectRatio: ratio } : undefined} onClick={() => setOpen(true)} aria-label="Show the picture larger">
          <img src={src} alt="" width={picture.w} height={picture.h} loading="lazy" decoding="async" />
        </button>
      )}
      {spots.length > 0 && (
        <figcaption className="rd-pic-say" aria-live="polite">
          {said ? (
            <>
              <span className="hanzi rd-pic-say-zh" lang="zh">
                {said.line.zh}
              </span>
              {said.line.py && <span className="rd-pic-say-py">{said.line.py}</span>}
              <span className="rd-pic-say-en">{said.line.en}</span>
            </>
          ) : (
            <span className="rd-pic-say-hint">Tap the writing on the page to see what it says.</span>
          )}
        </figcaption>
      )}
      {open && (
        <Modal title="Picture" onClose={() => setOpen(false)} wide>
          <div className="rd-pic-large" style={{ aspectRatio: ratio }}>
            <img src={src} alt="" width={picture.w} height={picture.h} />
          </div>
        </Modal>
      )}
    </Box>
  );
}
