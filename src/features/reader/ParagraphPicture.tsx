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
 * the photo, and a tap there lights that line in the text under the photo and
 * opens its English — every piece of writing on the page is a line there, so
 * nothing needs saying twice. That is how a sound effect or a sign drawn into
 * the art, which has no bubble to point at, gets its meaning. The spots are
 * drawn faintly, not left to hover, since the iPad has none.
 *
 * In the easier retelling (`retold`), the page is read in its words: each
 * bubble, caption and footnote is covered with a paper patch carrying the
 * easier line, so the comic reads as a comic at the learner's level. Sound
 * effects and writing in the art stay as drawn — they are the same in both.
 */
export function ParagraphPicture({
  picture,
  size,
  marks,
  onMark,
  retold,
}: {
  picture: TextPicture;
  size: 'beside' | 'large';
  marks?: PictureMark[];
  onMark?: (i: number) => void;
  /** the easier retelling: its lines are laid over the book's on the page */
  retold?: boolean;
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
          {spots.map((m) => {
            const patch = retold && m.line.kind !== 'sfx' && m.line.kind !== 'sign';
            return (
              <button
                key={m.i}
                className="rd-pic-spot"
                data-patch={patch || undefined}
                data-on={said?.i === m.i || undefined}
                // A patch reaches a little past the box read off the photo, so no edge of the book's lettering shows round it.
                style={
                  patch
                    ? { left: `${m.box[0] - 1}%`, top: `${m.box[1] - 0.6}%`, width: `${m.box[2] + 2}%`, minHeight: `${m.box[3] + 1.2}%` }
                    : { left: `${m.box[0]}%`, top: `${m.box[1]}%`, width: `${m.box[2]}%`, height: `${m.box[3]}%` }
                }
                onClick={() => (setSaid(m), onMark!(m.i))}
                aria-label={`${m.label}: show what it says`}
              >
                {patch && (
                  <span className="hanzi" lang="zh">
                    {m.line.zh}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <button className="rd-pic-frame" style={size === 'large' ? { aspectRatio: ratio } : undefined} onClick={() => setOpen(true)} aria-label="Show the picture larger">
          <img src={src} alt="" width={picture.w} height={picture.h} loading="lazy" decoding="async" />
        </button>
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
