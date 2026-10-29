import { useState } from 'react';
import { pictureUrl } from '../../api/pictures';
import type { TextPicture } from '../../domain/pictures';
import { Modal } from '../../ui/Modal';

/**
 * A paragraph's picture, in a box the size of the picture from the start, so
 * the text never moves when it arrives: large above the paragraph, or small
 * beside its first lines, the text running round it. A tap shows it larger.
 */
export function ParagraphPicture({ picture, size }: { picture: TextPicture; size: 'beside' | 'large' }) {
  const [open, setOpen] = useState(false);
  if (!picture.key || !picture.w || !picture.h) return null;
  const src = pictureUrl(picture.key);
  const ratio = `${picture.w} / ${picture.h}`;
  // Beside, it sits inside the paragraph, where a figure may not go.
  const Box = size === 'beside' ? 'span' : 'figure';
  return (
    <Box className="rd-pic no-print" data-size={size}>
      <button className="rd-pic-frame" style={size === 'large' ? { aspectRatio: ratio } : undefined} onClick={() => setOpen(true)} aria-label="Show the picture larger">
        <img src={src} alt="" width={picture.w} height={picture.h} loading="lazy" decoding="async" />
      </button>
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
