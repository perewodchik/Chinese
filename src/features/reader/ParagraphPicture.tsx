import { useState } from 'react';
import { pictureUrl } from '../../api/pictures';
import type { TextPicture } from '../../domain/pictures';
import { Modal } from '../../ui/Modal';

/**
 * The picture above a paragraph, in a box the size of the picture from the
 * start, so the text under it never moves when it arrives. A tap shows it
 * larger.
 */
export function ParagraphPicture({ picture }: { picture: TextPicture }) {
  const [open, setOpen] = useState(false);
  if (!picture.key || !picture.w || !picture.h) return null;
  const src = pictureUrl(picture.key);
  const ratio = `${picture.w} / ${picture.h}`;
  return (
    <figure className="rd-pic no-print">
      <button className="rd-pic-frame" style={{ aspectRatio: ratio }} onClick={() => setOpen(true)} aria-label="Show the picture larger">
        <img src={src} alt="" width={picture.w} height={picture.h} loading="lazy" decoding="async" />
      </button>
      {open && (
        <Modal title="Picture" onClose={() => setOpen(false)} wide>
          <div className="rd-pic-large" style={{ aspectRatio: ratio }}>
            <img src={src} alt="" width={picture.w} height={picture.h} />
          </div>
        </Modal>
      )}
    </figure>
  );
}
